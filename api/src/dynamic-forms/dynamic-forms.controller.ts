import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import { DynamicFormsService } from './dynamic-forms.service';
import { CreateDynamicFormDto } from './dto/create-dynamic-form.dto';
import { UpdateDynamicFormDto } from './dto/update-dynamic-form.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { AuthUser } from '../common/types/auth';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('Work - Dynamic Forms')
@ApiBearerAuth()
@Controller('dynamic-forms')
export class DynamicFormsController {
  constructor(private readonly service: DynamicFormsService) {}

  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'GET by-target-module' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('by-target-module')
  findByTargetModule(@Req() req: { user: AuthUser }) {
    return this.service.findByTargetModule(req.user);
  }

  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'POST /' })
  @ApiResponse({ status: 201, description: 'POST request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @ApiBody({ type: CreateDynamicFormDto })
  @Post()
  create(@Body() dto: CreateDynamicFormDto, @Req() req: { user: AuthUser }) {
    return this.service.create(dto, req.user);
  }

  @Roles(Role.ADMIN, Role.HR, Role.MANAGER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'GET /' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get()
  findAll(@Req() req: { user: AuthUser }) {
    return this.service.findAll(req.user);
  }

  @Roles(Role.ADMIN, Role.HR, Role.MANAGER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'GET :id' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: { user: AuthUser }) {
    return this.service.findOne(+id, req.user);
  }

  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'PATCH :id' })
  @ApiResponse({ status: 200, description: 'PATCH request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @ApiBody({ type: UpdateDynamicFormDto })
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDynamicFormDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.service.update(+id, dto, req.user);
  }

  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'DELETE :id' })
  @ApiResponse({ status: 200, description: 'DELETE request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: { user: AuthUser }) {
    return this.service.remove(+id, req.user);
  }
}
