import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { Permission } from '../common/enums/permissions.enum';
import type { AuthenticatedRequest } from '../common/types/request';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomersService } from './customers.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiTags('CRM - Customers')
@ApiBearerAuth()
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @RequirePermissions(Permission.CUSTOMER_READ)
  findAll(@Req() req: AuthenticatedRequest) {
    return this.customersService.findAll(req.user);
  }

  @Get(':id')
  @RequirePermissions(Permission.CUSTOMER_READ)
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: AuthenticatedRequest) {
    return this.customersService.findOne(id, req.user);
  }

  @Post()
  @RequirePermissions(Permission.CUSTOMER_CREATE)
  @ApiBody({ type: CreateCustomerDto })
  create(@Body() dto: CreateCustomerDto, @Req() req: AuthenticatedRequest) {
    return this.customersService.create(dto, req.user);
  }

  @Patch(':id')
  @RequirePermissions(Permission.CUSTOMER_UPDATE)
  @ApiBody({ type: UpdateCustomerDto })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCustomerDto, @Req() req: AuthenticatedRequest) {
    return this.customersService.update(id, dto, req.user);
  }

  @Delete(':id')
  @RequirePermissions(Permission.CUSTOMER_DELETE)
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: AuthenticatedRequest) {
    return this.customersService.remove(id, req.user);
  }
}
