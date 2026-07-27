import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  UseInterceptors,
  UploadedFile,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { FileAttachmentsService } from './file-attachments.service';
import { FILE_ATTACHMENT_UPLOAD_ROOT } from './file-attachments.constants';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../common/types/request';

@UseGuards(JwtAuthGuard)
@ApiTags('System - File Attachments')
@ApiBearerAuth()
@Controller('file-attachments')
export class FileAttachmentsController {
  constructor(
    private readonly fileAttachmentsService: FileAttachmentsService,
  ) {}

  @ApiOperation({ summary: 'POST upload' })
  @ApiResponse({ status: 201, description: 'POST request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          if (!existsSync(FILE_ATTACHMENT_UPLOAD_ROOT)) {
            mkdirSync(FILE_ATTACHMENT_UPLOAD_ROOT, { recursive: true });
          }
          cb(null, FILE_ATTACHMENT_UPLOAD_ROOT);
        },
        filename: (_req, file, cb) => {
          const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    }),
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Query('entityType') entityType: string,
    @Query('entityId', ParseIntPipe) entityId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    const fileUrl = `/tmp/${file.filename}`;

    return this.fileAttachmentsService.create(
      file.originalname,
      fileUrl,
      entityType,
      entityId,
      req.user.userId,
      req.user,
    );
  }

  @ApiOperation({ summary: 'GET /' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get()
  findAll(@Req() req: AuthenticatedRequest) {
    return this.fileAttachmentsService.findAll(req.user);
  }

  @ApiOperation({ summary: 'GET entity' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('entity')
  findByEntity(
    @Query('type') entityType: string,
    @Query('id', ParseIntPipe) entityId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.fileAttachmentsService.findByEntity(
      entityType,
      entityId,
      req.user,
    );
  }

  @ApiOperation({ summary: 'DELETE :id' })
  @ApiResponse({ status: 200, description: 'DELETE request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.fileAttachmentsService.remove(id, req.user);
  }
}
