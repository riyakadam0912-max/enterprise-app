import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import type { AuthenticatedRequest } from '../common/types/request';
import { BusinessUnitsService } from './business-units.service';
import { CreateBusinessUnitDto } from './dto/create-business-unit.dto';
import { UpdateBusinessUnitDto } from './dto/update-business-unit.dto';
import { SwitchBusinessUnitDto } from './dto/switch-business-unit.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('System - Business Units')
@ApiBearerAuth()
@Controller()
export class BusinessUnitsController {
  constructor(private readonly businessUnitsService: BusinessUnitsService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me/business-units')
  @ApiOperation({ summary: 'List Business Units accessible to the authenticated user' })
  async listAccessible(@Req() req: AuthenticatedRequest) {
    const organizationId = req.organizationId ?? req.user.organizationId;
    if (organizationId == null) {
      throw new ForbiddenException('Select an organization first');
    }
    return this.businessUnitsService.getAccessibleBusinessUnitsForUser(
      req.user,
      organizationId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/business-units/switch')
  @ApiOperation({ summary: 'Switch the active Business Unit context' })
  @ApiBody({ type: SwitchBusinessUnitDto })
  async switchContext(
    @Body() dto: SwitchBusinessUnitDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const organizationId = req.organizationId ?? req.user.organizationId;
    if (organizationId == null) {
      throw new ForbiddenException('Select an organization before switching Business Units');
    }
    const target =
      dto && typeof dto.businessUnitId === 'number' ? dto.businessUnitId : null;
    const resolved =
      await this.businessUnitsService.resolveUserScopedBusinessUnit(
        req.user,
        target,
        organizationId,
      );
    return {
      success: true,
      businessUnitId: resolved.businessUnitId,
      allBusinessUnits: resolved.allBusinessUnits,
      message: resolved.businessUnitId == null && resolved.allBusinessUnits
        ? 'Switched to All Units view'
        : resolved.businessUnitId != null
          ? 'Switched Business Unit context'
          : 'No Business Unit context available',
    };
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.HR)
  @Get('organizations/:organizationId/business-units')
  @ApiOperation({ summary: 'List Business Units for an organization' })
  list(
    @Param('organizationId', ParseIntPipe) organizationId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.businessUnitsService.list(organizationId, req.user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.HR)
  @Post('organizations/:organizationId/business-units')
  @ApiOperation({ summary: 'Create a Business Unit' })
  @ApiBody({ type: CreateBusinessUnitDto })
  create(
    @Param('organizationId', ParseIntPipe) organizationId: number,
    @Body() dto: CreateBusinessUnitDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.businessUnitsService.create(organizationId, dto, req.user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.HR)
  @Get('business-units/:id')
  @ApiOperation({ summary: 'Get a Business Unit' })
  get(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    const organizationId = req.organizationId ?? req.user.organizationId;
    if (organizationId == null) {
      throw new ForbiddenException('Select an organization before viewing Business Units');
    }
    return this.businessUnitsService.get(id, organizationId, req.user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.HR)
  @Patch('business-units/:id')
  @ApiOperation({ summary: 'Update a Business Unit' })
  @ApiBody({ type: UpdateBusinessUnitDto })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBusinessUnitDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const organizationId = req.organizationId ?? req.user.organizationId;
    if (organizationId == null) {
      throw new Error('Select an organization before modifying Business Units');
    }
    return this.businessUnitsService.update(id, organizationId, dto, req.user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.HR)
  @Delete('business-units/:id')
  @ApiOperation({ summary: 'Delete a leaf Business Unit' })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    const organizationId = req.organizationId ?? req.user.organizationId;
    if (organizationId == null) {
      throw new Error('Select an organization before modifying Business Units');
    }
    return this.businessUnitsService.remove(id, organizationId, req.user);
  }
}
