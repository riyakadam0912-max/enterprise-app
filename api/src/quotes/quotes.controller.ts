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
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { QuotesService } from './quotes.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../common/types/request';
import { SendQuoteDto } from './dto/send-quote.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('CRM - Quotes')
@ApiBearerAuth()
@Controller('quotes')
export class QuotesController {
  constructor(private readonly quotesService: QuotesService) {}
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.MANAGER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'POST /' })
  @ApiResponse({ status: 201, description: 'POST request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @ApiBody({ type: CreateQuoteDto })
  @Post()
  create(@Body() dto: CreateQuoteDto, @Req() req: AuthenticatedRequest) {
    return this.quotesService.create(dto, req.user);
  }

  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.MANAGER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'GET /' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get()
  findAll(@Req() req: AuthenticatedRequest) {
    return this.quotesService.findAll(req.user);
  }

  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.MANAGER, Role.EMPLOYEE)
  @Get(':id/pdf')
  async pdf(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
    @Res() response: Response,
  ) {
    const buffer = await this.quotesService.generatePdf(id, req.user);
    response.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="quote-${id}.pdf"`,
      'Content-Length': buffer.length.toString(),
    });
    response.end(buffer);
  }

  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.MANAGER, Role.EMPLOYEE)
  @Post(':id/public-link')
  createPublicLink(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.quotesService.createPublicLink(id, req.user);
  }

  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.MANAGER, Role.EMPLOYEE)
  @Post(':id/send')
  send(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SendQuoteDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.quotesService.sendByEmail(
      id,
      dto.recipient,
      dto.subject,
      dto.message,
      req.user,
    );
  }

  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.MANAGER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'GET :id' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.quotesService.findOne(id, req.user);
  }

  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.MANAGER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'PATCH :id' })
  @ApiResponse({ status: 200, description: 'PATCH request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @ApiBody({ type: UpdateQuoteDto })
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateQuoteDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.quotesService.update(id, dto, req.user);
  }

  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
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
    return this.quotesService.remove(id, req.user);
  }

  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.MANAGER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'POST :id/convert-to-invoice' })
  @ApiResponse({ status: 201, description: 'POST request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Post(':id/convert-to-invoice')
  convertToInvoice(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.quotesService.convertToInvoice(id, req.user.userId, req.user);
  }
}
