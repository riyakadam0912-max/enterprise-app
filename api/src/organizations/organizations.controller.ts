import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  ParseIntPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBody,
  ApiConsumes,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrganizationsService } from './organizations.service';
import type { AuthenticatedRequest } from '../common/types/request';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { Permission } from '../common/enums/permissions.enum';

@UseGuards(JwtAuthGuard)
@ApiTags('System - Organizations')
@ApiBearerAuth()
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @ApiOperation({
    summary: 'Get the authenticated organization admin organization',
  })
  @Get('me')
  getMyOrganization(@Req() req: AuthenticatedRequest) {
    return this.organizationsService.getMyOrganization(req.user);
  }

  @ApiOperation({
    summary: 'List organizations accessible to a child organization admin',
  })
  @Get('accessible')
  getAccessibleOrganizations(@Req() req: AuthenticatedRequest) {
    return this.organizationsService.getAccessibleOrganizations(req.user);
  }

  @ApiOperation({
    summary: 'Update the authenticated organization admin organization',
  })
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission.ADMIN_MANAGE)
  @Patch('me')
  updateMyOrganization(
    @Body() dto: UpdateOrganizationDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.organizationsService.updateMyOrganization(dto, req.user);
  }

  @ApiOperation({ summary: 'Get super admin platform statistics' })
  @ApiResponse({ status: 200, description: 'Platform statistics returned.' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden: requires platform admin.',
  })
  @Get('platform-stats')
  getPlatformStats(@Req() req: AuthenticatedRequest) {
    return this.organizationsService.getPlatformStats(req.user);
  }

  @ApiOperation({ summary: 'List organizations available to the current user' })
  @ApiResponse({ status: 200, description: 'Organizations list returned.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @Get()
  listOrganizations(
    @Req() req: AuthenticatedRequest,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('parentId') parentId?: string,
  ) {
    return this.organizationsService.listOrganizationsForUser(req.user, {
      search,
      status,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      parentId: parentId ? Number(parentId) : undefined,
    });
  }

  @ApiOperation({ summary: 'Get organization details' })
  @Get(':id')
  getOrganization(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.organizationsService.getOrganization(Number(id), req.user);
  }

  @ApiOperation({ summary: 'Create a new organization with a primary admin' })
  @ApiResponse({ status: 201, description: 'Organization created.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiBody({ type: CreateOrganizationDto })
  @Post()
  createOrganization(
    @Body() dto: CreateOrganizationDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.organizationsService.createOrganization(dto, req.user);
  }

  @Patch(':id')
  updateOrganization(
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.organizationsService.updateOrganization(
      Number(id),
      dto,
      req.user,
    );
  }

  @ApiOperation({ summary: 'Upload an organization logo' })
  @ApiConsumes('multipart/form-data')
  @Post(':id/logo')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  uploadOrganizationLogo(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.organizationsService.uploadOrganizationLogo(id, file, req.user);
  }

  @Patch(':id/suspend')
  suspendOrganization(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.organizationsService.setOrganizationStatus(
      Number(id),
      'SUSPENDED',
      req.user,
    );
  }

  @Patch(':id/activate')
  activateOrganization(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.organizationsService.setOrganizationStatus(
      Number(id),
      'ACTIVE',
      req.user,
    );
  }

  @Delete(':id')
  deleteOrganization(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.organizationsService.deleteOrganization(Number(id), req.user);
  }
}
