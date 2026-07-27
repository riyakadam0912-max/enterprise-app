import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrganizationsService } from './organizations.service';
import type { AuthenticatedRequest } from '../common/types/request';

@UseGuards(JwtAuthGuard)
@ApiTags('System - Organizations')
@ApiBearerAuth()
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @ApiOperation({ summary: 'List organizations available to the current user' })
  @ApiResponse({ status: 200, description: 'Organizations list returned.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @Get()
  listOrganizations(@Req() req: AuthenticatedRequest) {
    return this.organizationsService.listOrganizationsForUser(req.user);
  }
}
