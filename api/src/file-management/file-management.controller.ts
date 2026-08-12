import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  StreamableFile,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  ParseIntPipe,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../common/types/request';
import type { AuthUser } from '../common/types/auth';
import { FileAccessGuard } from './guards/file-access.guard';
import { FileManagementService } from './file-management.service';
import { FileUserContext } from './file-management.types';
import { FileQueryDto } from './dto/file-query.dto';
import { UpdateFileDto } from './dto/update-file.dto';
import { UploadFileDto } from './dto/upload-file.dto';

function mapAuthUserToFileContext(user: AuthUser): FileUserContext {
  return {
    userId: user.userId,
    role: user.role,
    roles: user.roles,
    employeeId: user.employeeId,
    userName: user.name,
    organizationId: user.organizationId,
    isPlatformAdmin: user.isPlatformAdmin,
    isSuperAdmin: user.isSuperAdmin,
  };
}

@UseGuards(JwtAuthGuard)
@ApiTags('System - Files')
@ApiBearerAuth()
@Controller('files')
export class FileManagementController {
  constructor(private readonly fileManagementService: FileManagementService) {}

  @ApiOperation({ summary: 'Upload a file' })
  @ApiConsumes('multipart/form-data')
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 25 * 1024 * 1024 },
    }),
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadFileDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.fileManagementService.uploadFile(
      file,
      body,
      mapAuthUserToFileContext(request.user),
    );
  }

  @ApiOperation({ summary: 'Upload multiple files' })
  @ApiConsumes('multipart/form-data')
  @Post('upload-multiple')
  @UseInterceptors(
    FilesInterceptor('files', 20, {
      storage: memoryStorage(),
      limits: { fileSize: 25 * 1024 * 1024 },
    }),
  )
  async uploadMultiple(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() body: UploadFileDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.fileManagementService.uploadFiles(
      files,
      body,
      mapAuthUserToFileContext(request.user),
    );
  }

  @ApiOperation({ summary: 'Get file dashboard metrics' })
  @Get('dashboard')
  async dashboard(@Req() request: AuthenticatedRequest) {
    return this.fileManagementService.dashboard(
      mapAuthUserToFileContext(request.user),
    );
  }

  @ApiOperation({ summary: 'List files' })
  @Get()
  async findAll(
    @Query() query: FileQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.fileManagementService.findAll(
      query,
      mapAuthUserToFileContext(request.user),
    );
  }

  @ApiOperation({ summary: 'List files by entity' })
  @Get('entity/:entityType/:entityId')
  async findByEntity(
    @Param('entityType') entityType: string,
    @Param('entityId', ParseIntPipe) entityId: number,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.fileManagementService.findByEntity(
      entityType,
      entityId,
      mapAuthUserToFileContext(request.user),
    );
  }

  @ApiOperation({ summary: 'Preview a file inline' })
  @Get('preview/:id')
  @UseGuards(FileAccessGuard)
  async preview(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ): Promise<StreamableFile> {
    return this.fileManagementService.preview(
      id,
      mapAuthUserToFileContext(request.user),
    );
  }

  @ApiOperation({ summary: 'Download a file' })
  @Get('download/:id')
  @UseGuards(FileAccessGuard)
  async download(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ): Promise<StreamableFile> {
    return this.fileManagementService.download(
      id,
      mapAuthUserToFileContext(request.user),
      false,
    );
  }

  @ApiOperation({ summary: 'Get a file by id' })
  @Get(':id')
  @UseGuards(FileAccessGuard)
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.fileManagementService.findOne(
      id,
      mapAuthUserToFileContext(request.user),
    );
  }

  @ApiOperation({ summary: 'Update file metadata' })
  @Patch(':id')
  @UseGuards(FileAccessGuard)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateFileDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.fileManagementService.updateFile(
      id,
      body,
      mapAuthUserToFileContext(request.user),
    );
  }

  @ApiOperation({ summary: 'Delete a file' })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(FileAccessGuard)
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.fileManagementService.remove(
      id,
      mapAuthUserToFileContext(request.user),
    );
  }
}
