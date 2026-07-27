import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FileManagementService } from '../file-management.service';
import type { FileUserContext } from '../file-management.types';

@Injectable()
export class FileAccessGuard implements CanActivate {
  constructor(private readonly fileManagementService: FileManagementService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      params?: { id?: string };
      user?: Partial<FileUserContext>;
      managedFile?: unknown;
    }>();
    const fileId = Number(request.params?.id);

    if (!Number.isInteger(fileId) || fileId < 1) {
      return true;
    }

    const file = await this.fileManagementService.findRecordById(
      fileId,
      request.user || {},
    );
    if (!file) {
      throw new NotFoundException('File not found');
    }

    const allowed = this.fileManagementService.canUserAccessFile(
      file,
      request.user,
    );
    if (!allowed) {
      throw new ForbiddenException('You do not have access to this file');
    }

    request.managedFile = file;
    return true;
  }
}
