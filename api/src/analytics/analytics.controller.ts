import { CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';
import {
  Controller,
  Get,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { RolesGuard } from '../common/guards/roles.guard';
import { AnalyticsService } from './analytics.service';
import {
  AnalyticsSummaryDto,
  SuperAdminSummaryDto,
} from './dto/analytics-summary.dto';
import type { AuthenticatedRequest } from '../common/types/request';

@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(CacheInterceptor)
@ApiTags('Analytics - Executive')
@ApiBearerAuth()
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @ApiOperation({ summary: 'GET summary' })
  @ApiOkResponse({
    type: AnalyticsSummaryDto,
    description: 'Executive analytics summary returned.',
  })
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.HR, Role.MANAGER)
  @Get('summary')
  @CacheKey('analytics:summary')
  @CacheTTL(600)
  getSummary(@Req() req: AuthenticatedRequest): Promise<AnalyticsSummaryDto> {
    return this.analyticsService.getSummary(req.user);
  }

  @ApiOperation({ summary: 'GET Super Admin platform summary' })
  @ApiOkResponse({
    type: SuperAdminSummaryDto,
    description: 'Cross-tenant platform summary for Super Admin dashboard.',
  })
  @Roles(Role.SUPER_ADMIN)
  @Get('super-admin-summary')
  @CacheKey('analytics:super-admin-summary')
  @CacheTTL(30)
  getSuperAdminSummary(): Promise<SuperAdminSummaryDto> {
    return this.analyticsService.getSuperAdminSummary();
  }
}
