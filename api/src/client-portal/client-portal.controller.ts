import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import type { AuthenticatedRequest } from '../common/types/request';
import { CreateClientUserDto } from './dto/create-client-user.dto';
import { ClientPortalService } from './client-portal.service';

@ApiTags('Client Portal')
@Controller('client-portal')
export class ClientPortalController {
  constructor(private readonly service: ClientPortalService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.COMPLIANCE_MANAGER, Role.MANAGER)
  @ApiBearerAuth()
  @Get('users')
  list(@Req() req: AuthenticatedRequest) {
    return this.service.list(req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.COMPLIANCE_MANAGER, Role.MANAGER)
  @ApiBearerAuth()
  @Post('users')
  @ApiBody({ type: CreateClientUserDto })
  create(@Body() dto: CreateClientUserDto, @Req() req: AuthenticatedRequest) {
    return this.service.create(dto, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.COMPLIANCE_MANAGER, Role.MANAGER)
  @ApiBearerAuth()
  @Get('users/:id')
  get(@Param('id', ParseIntPipe) id: number, @Req() req: AuthenticatedRequest) {
    return this.service.get(id, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.COMPLIANCE_MANAGER, Role.MANAGER)
  @ApiBearerAuth()
  @Patch('users/:id/projects')
  updateProjects(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { projectIds: number[] },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.updateProjects(id, body.projectIds, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Roles(Role.CLIENT)
  @ApiBearerAuth()
  @Get('me/projects')
  myProjects(@Req() req: AuthenticatedRequest) {
    return this.service.myProjects(req.user);
  }

  @Post('invitations/accept')
  acceptInvitation(@Body() body: { token: string; password: string }) {
    return this.service.acceptInvitation(body.token, body.password);
  }
}
