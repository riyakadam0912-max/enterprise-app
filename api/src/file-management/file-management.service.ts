import {
  Injectable,
  Inject,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  FILE_MODULE_NAME,
  FILE_STORAGE_PROVIDER,
} from './file-management.constants';
import { FileUserContext } from './file-management.types';
import * as StorageProviderModule from './storage/storage-provider.interface';
import {
  assertSupportedFile,
  buildStorageFolder,
  createStoredFileName,
  getCategoryFromMime,
  normalizeTags,
  parseBooleanLike,
  sanitizeFileName,
} from './utils/file-management.utils';
import { StreamableFile } from '@nestjs/common';
import { Readable } from 'stream';
import { extname } from 'path';
import { File, Prisma } from '@prisma/client';

type UploadedFileInput = Express.Multer.File;

type FileListQuery = {
  search?: string;
  module?: string;
  entityType?: string;
  entityId?: number;
  category?: string;
  uploadedBy?: number;
  isPublic?: string;
  page?: number;
  limit?: number;
};

@Injectable()
export class FileManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
    private readonly configService: ConfigService,
    @Inject(FILE_STORAGE_PROVIDER)
    private readonly storageProvider: StorageProviderModule.StorageProvider,
  ) {}

  private validateOrganization(user?: Partial<FileUserContext>): number {
    if (!user?.organizationId) {
      throw new ForbiddenException('User has no associated organization');
    }
    return user.organizationId;
  }

  async uploadFile(
    file: UploadedFileInput,
    dto: {
      module: string;
      entityType: string;
      entityId: number;
      category?: string;
      tags?: string;
      isPublic?: string;
      replaceFileId?: number;
    },
    user: FileUserContext,
  ) {
    return this.writeFileRecord(file, dto, user);
  }

  async uploadFiles(
    files: UploadedFileInput[],
    dto: {
      module: string;
      entityType: string;
      entityId: number;
      category?: string;
      tags?: string;
      isPublic?: string;
    },
    user: FileUserContext,
  ) {
    const results: Array<
      Awaited<ReturnType<FileManagementService['uploadFile']>>
    > = [];
    for (const file of files) {
      results.push(await this.writeFileRecord(file, dto, user));
    }
    return results;
  }

  async findAll(query: FileListQuery = {}, user?: Partial<FileUserContext>) {
    const organizationId = this.validateOrganization(user);
    const where: Prisma.FileWhereInput = {
      deletedAt: null,
      organizationId,
    };

    if (query.search) {
      where.OR = [
        { originalName: { contains: query.search, mode: 'insensitive' } },
        { module: { contains: query.search, mode: 'insensitive' } },
        { entityType: { contains: query.search, mode: 'insensitive' } },
        { category: { contains: query.search, mode: 'insensitive' } },
        { tags: { hasSome: [query.search] } },
      ];
    }

    if (query.module) where.module = query.module;
    if (query.entityType) where.entityType = query.entityType;
    if (query.entityId) where.entityId = query.entityId;
    if (query.category) where.category = query.category;
    if (query.uploadedBy) where.uploadedBy = query.uploadedBy;
    if (query.isPublic !== undefined)
      where.isPublic = parseBooleanLike(query.isPublic);

    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));

    const [items, total] = await this.prisma.$transaction([
      this.prisma.file.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.file.count({ where }),
    ]);

    const visibleItems = items.filter((item) =>
      this.canUserAccessFile(item, user),
    );
    return {
      items: visibleItems.map((item) => this.toResponse(item)),
      total,
      page,
      limit,
    };
  }

  async findByEntity(
    entityType: string,
    entityId: number,
    user?: Partial<FileUserContext>,
  ) {
    const organizationId = this.validateOrganization(user);
    const files = await this.prisma.file.findMany({
      where: {
        entityType,
        entityId,
        deletedAt: null,
        organizationId,
      },
      orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
    });

    return files
      .filter((file) => this.canUserAccessFile(file, user))
      .map((file) => this.toResponse(file));
  }

  async findRecordById(id: number, user: Partial<FileUserContext>) {
    const organizationId = this.validateOrganization(user);
    return this.prisma.file.findFirst({
      where: {
        id,
        deletedAt: null,
        organizationId,
      },
    });
  }

  async findOne(id: number, user?: Partial<FileUserContext>) {
    const organizationId = this.validateOrganization(user);
    const scopedUser: Partial<FileUserContext> = { ...user, organizationId };
    const file = await this.findRecordById(id, scopedUser);
    if (!file) {
      throw new NotFoundException('File not found');
    }
    if (!this.canUserAccessFile(file, user)) {
      throw new ForbiddenException('You do not have access to this file');
    }
    return this.toResponse(file);
  }

  async updateFile(
    id: number,
    dto: {
      originalName?: string;
      category?: string;
      tags?: string;
      isPublic?: string;
      metadata?: string;
    },
    user?: Partial<FileUserContext>,
  ) {
    const organizationId = this.validateOrganization(user);
    const scopedUser: Partial<FileUserContext> = { ...user, organizationId };
    const file = await this.findRecordById(id, scopedUser);
    if (!file) throw new NotFoundException('File not found');
    if (!this.canUserAccessFile(file, user))
      throw new ForbiddenException('You do not have access to this file');

    const updated = await this.prisma.file.update({
      where: { id, organizationId },
      data: {
        originalName: dto.originalName?.trim() || file.originalName,
        category: dto.category ?? file.category,
        tags: dto.tags ? normalizeTags(dto.tags) : file.tags,
        isPublic:
          dto.isPublic !== undefined
            ? parseBooleanLike(dto.isPublic)
            : file.isPublic,
        metadata: dto.metadata
          ? this.parseJson(dto.metadata)
          : this.toInputJsonValue(file.metadata),
      },
    });

    await this.writeActivity(
      updated.id,
      'UPDATE',
      user?.userId ?? null,
      updated.organizationId,
      { previousName: file.originalName, nextName: updated.originalName },
    );
    await this.auditLogsService.logUpdate({
      module: FILE_MODULE_NAME,
      entityType: 'File',
      entityId: updated.id,
      userId: user?.userId ?? null,
      userName: user?.userName ?? null,
      userRole: user?.role ?? null,
      action: 'UPDATE',
      oldValue: file,
      newValue: updated,
      description: `${user?.role ?? user?.userName ?? 'System'} updated file ${updated.id}`,
    });

    return this.toResponse(updated);
  }

  async remove(id: number, user?: Partial<FileUserContext>) {
    const organizationId = this.validateOrganization(user);
    const scopedUser: Partial<FileUserContext> = { ...user, organizationId };
    const file = await this.findRecordById(id, scopedUser);
    if (!file) throw new NotFoundException('File not found');
    if (!this.canUserAccessFile(file, user))
      throw new ForbiddenException('You do not have access to this file');

    await this.storageProvider.delete(file.path).catch(() => undefined);
    const removed = await this.prisma.file.update({
      where: { id, organizationId },
      data: {
        status: 'DELETED',
        deletedAt: new Date(),
      },
    });

    await this.writeActivity(
      file.id,
      'DELETE',
      user?.userId ?? null,
      file.organizationId,
      { path: file.path },
    );
    await this.auditLogsService.logDelete({
      module: FILE_MODULE_NAME,
      entityType: 'File',
      entityId: file.id,
      userId: user?.userId ?? null,
      userName: user?.userName ?? null,
      userRole: user?.role ?? null,
      action: 'DELETE',
      description: `${user?.role ?? user?.userName ?? 'System'} deleted file ${file.id}`,
    });

    return this.toResponse(removed);
  }

  async download(
    id: number,
    user?: Partial<FileUserContext>,
    inline = false,
  ): Promise<StreamableFile> {
    const organizationId = this.validateOrganization(user);
    const scopedUser: Partial<FileUserContext> = { ...user, organizationId };
    await this.findOne(id, scopedUser);
    const record = await this.findRecordById(id, scopedUser);
    if (!record) throw new NotFoundException('File not found');

    const stream = await this.storageProvider.getReadStream({
      storedPath: record.path,
    });
    await this.bumpAccessCounters(
      record.id,
      'DOWNLOAD',
      user?.userId ?? null,
      record.organizationId,
    );

    return new StreamableFile(stream as Readable, {
      type: record.mimeType,
      disposition: `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(sanitizeFileName(record.originalName))}"`,
    });
  }

  async preview(
    id: number,
    user?: Partial<FileUserContext>,
  ): Promise<StreamableFile> {
    const organizationId = this.validateOrganization(user);
    const scopedUser: Partial<FileUserContext> = { ...user, organizationId };
    const record = await this.findRecordById(id, scopedUser);
    if (!record) throw new NotFoundException('File not found');
    if (!this.canUserAccessFile(record, user))
      throw new ForbiddenException('You do not have access to this file');

    const stream = await this.storageProvider.getReadStream({
      storedPath: record.path,
    });
    await this.bumpAccessCounters(
      record.id,
      'PREVIEW',
      user?.userId ?? null,
      record.organizationId,
    );

    return new StreamableFile(stream as Readable, {
      type: record.mimeType,
      disposition: `inline; filename="${encodeURIComponent(sanitizeFileName(record.originalName))}"`,
    });
  }

  async dashboard(user?: Partial<FileUserContext>) {
    const organizationId = this.validateOrganization(user);
    const baseWhere: Prisma.FileWhereInput = {
      deletedAt: null,
      organizationId,
    };

    const [totalFiles, totalStorage, recentFiles, mostDownloaded, byCategory] =
      await Promise.all([
        this.prisma.file.count({ where: baseWhere }),
        this.prisma.file.aggregate({ where: baseWhere, _sum: { size: true } }),
        this.prisma.file.findMany({
          where: baseWhere,
          orderBy: { createdAt: 'desc' },
          take: 8,
        }),
        this.prisma.file.findMany({
          where: baseWhere,
          orderBy: { downloadCount: 'desc' },
          take: 8,
        }),
        this.prisma.file.groupBy({
          by: ['category'],
          where: baseWhere,
          _count: { category: true },
        }),
      ]);

    return {
      totalFiles,
      totalStorageBytes: totalStorage._sum.size ?? 0,
      recentFiles: recentFiles
        .filter((file) => this.canUserAccessFile(file, user))
        .map((file) => this.toResponse(file)),
      mostDownloaded: mostDownloaded
        .filter((file) => this.canUserAccessFile(file, user))
        .map((file) => this.toResponse(file)),
      byCategory: byCategory.map((item) => ({
        category: item.category,
        count: item._count.category,
      })),
    };
  }

  canUserAccessFile(
    file: Pick<
      File,
      | 'isPublic'
      | 'uploadedBy'
      | 'module'
      | 'entityType'
      | 'entityId'
      | 'category'
      | 'status'
    >,
    user?: Partial<FileUserContext>,
  ): boolean {
    if (!file || file.status === 'DELETED') return false;
    if (file.isPublic) return true;
    if (!user?.userId) return false;

    const role = String(user.role ?? '').toUpperCase();
    if (['SUPER_ADMIN', 'ADMIN', 'COMPLIANCE_MANAGER', 'HR'].includes(role))
      return true;
    if (file.uploadedBy === user.userId) return true;

    if (
      file.entityType === 'Employee' &&
      user.employeeId &&
      file.entityId === user.employeeId
    ) {
      return true;
    }

    if (
      role === 'MANAGER' &&
      ['projects', 'tasks', 'leave', 'expenses'].includes(
        file.module.toLowerCase(),
      )
    ) {
      return true;
    }

    if (
      role === 'EMPLOYEE' &&
      ['general_attachment', 'general'].includes(file.category.toLowerCase())
    ) {
      return true;
    }

    return false;
  }

  async replaceFile(
    sourceFileId: number,
    file: UploadedFileInput,
    dto: {
      module: string;
      entityType: string;
      entityId: number;
      category?: string;
      tags?: string;
      isPublic?: string;
    },
    user: FileUserContext,
  ) {
    const organizationId = this.validateOrganization(user);
    const current = await this.findRecordById(sourceFileId, user);
    if (!current) throw new NotFoundException('File not found');
    if (!this.canUserAccessFile(current, user))
      throw new ForbiddenException('You do not have access to this file');

    await this.prisma.file.update({
      where: { id: current.id, organizationId },
      data: { status: 'ARCHIVED' },
    });
    const uploaded = await this.writeFileRecord(
      file,
      { ...dto, replaceFileId: current.id },
      user,
      current,
    );
    return uploaded;
  }

  private async writeFileRecord(
    file: UploadedFileInput,
    dto: {
      module: string;
      entityType: string;
      entityId: number;
      category?: string;
      tags?: string;
      isPublic?: string;
      replaceFileId?: number;
    },
    user: FileUserContext,
    previous?: File,
  ) {
    if (!file) throw new BadRequestException('A file is required');
    const organizationId = this.validateOrganization(user);

    assertSupportedFile(file.originalname, file.mimetype);

    const category = dto.category ?? getCategoryFromMime(file.mimetype);
    const folder = buildStorageFolder(
      dto.module,
      dto.entityType,
      dto.entityId,
      category,
    );
    const storedName = createStoredFileName(file.originalname);
    const storageResult = await this.storageProvider.upload({
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
      folder,
      storedName,
    });

    const nextVersion = previous ? previous.version + 1 : 1;
    const record = await this.prisma.file.create({
      data: {
        organizationId,
        originalName: sanitizeFileName(file.originalname),
        storedName: storageResult.storedName,
        mimeType: file.mimetype,
        extension: extname(file.originalname).toLowerCase(),
        size: storageResult.size,
        path: storageResult.storedPath,
        url: `/${storageResult.storedPath}`,
        storageProvider: this.storageProvider.name,
        uploadedBy: user.userId,
        module: dto.module,
        entityType: dto.entityType,
        entityId: dto.entityId,
        category,
        tags: normalizeTags(dto.tags),
        isPublic: parseBooleanLike(dto.isPublic),
        checksum: storageResult.checksum,
        version: nextVersion,
        status: 'ACTIVE',
        familyId: previous?.familyId ?? undefined,
        parentFileId: previous?.id ?? null,
        thumbnailUrl: file.mimetype.startsWith('image/')
          ? `/${storageResult.storedPath}`
          : null,
        previewUrl:
          file.mimetype === 'application/pdf' ||
          file.mimetype.startsWith('image/')
            ? `/${storageResult.storedPath}`
            : null,
      },
    });

    await this.writeActivity(
      record.id,
      previous ? 'REPLACE' : 'UPLOAD',
      user.userId,
      organizationId,
      {
        module: dto.module,
        entityType: dto.entityType,
        entityId: dto.entityId,
        category,
        storedPath: storageResult.storedPath,
      },
    );

    await this.auditLogsService.logCustomAction({
      module: FILE_MODULE_NAME,
      entityType: 'File',
      entityId: record.id,
      userId: user.userId,
      userName: user.userName ?? null,
      userRole: user.role ?? null,
      action: previous ? 'REPLACE_FILE' : 'UPLOAD_FILE',
      description: `${user.role ?? user.userName ?? 'System'} ${previous ? 'replaced' : 'uploaded'} file ${record.originalName}`,
    });

    return this.toResponse(record);
  }

  private async bumpAccessCounters(
    fileId: number,
    action: 'DOWNLOAD' | 'PREVIEW',
    userId: number | null,
    organizationId: number,
  ) {
    await this.prisma.$transaction([
      this.prisma.file.update({
        where: { id: fileId, organizationId },
        data: {
          lastAccessedAt: new Date(),
          ...(action === 'DOWNLOAD'
            ? { downloadCount: { increment: 1 } }
            : { previewCount: { increment: 1 } }),
        },
      }),
      this.prisma.fileActivity.create({
        data: {
          organizationId,
          fileId,
          userId: userId ?? undefined,
          action,
        },
      }),
    ]);
  }

  private async writeActivity(
    fileId: number,
    action: string,
    userId: number | null,
    organizationId: number,
    metadata?: Record<string, unknown>,
  ) {
    await this.prisma.fileActivity.create({
      data: {
        organizationId,
        fileId,
        userId: userId ?? undefined,
        action,
        metadata: this.toInputJsonValue(metadata),
      },
    });
  }

  private toInputJsonValue(
    value: Record<string, unknown> | Prisma.JsonValue | null | undefined,
  ): Prisma.InputJsonValue | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }

    return value as Prisma.InputJsonValue;
  }

  private parseJson(value: string) {
    try {
      return JSON.parse(value) as Prisma.InputJsonValue;
    } catch {
      throw new BadRequestException('metadata must be valid JSON');
    }
  }

  private toResponse(file: File) {
    return {
      ...file,
      downloadUrl: `/files/download/${file.id}`,
      previewUrl: `/files/preview/${file.id}`,
      signedDownloadUrl: `/files/download/${file.id}?signature=${file.checksum ?? file.id}&expires=${Math.floor(Date.now() / 1000) + 3600}`,
    };
  }
}
