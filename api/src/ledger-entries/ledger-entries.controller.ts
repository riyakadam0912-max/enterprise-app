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
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { Permission } from '../common/enums/permissions.enum';
import type { AuthenticatedRequest } from '../common/types/request';
import { LedgerEntriesService } from './ledger-entries.service';
import { CreateLedgerEntryDto } from './dto/create-ledger-entry.dto';
import { UpdateLedgerEntryDto } from './dto/update-ledger-entry.dto';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiTags('Finance - Ledger Entries')
@ApiBearerAuth()
@Controller('ledger-entries')
export class LedgerEntriesController {
  constructor(private readonly ledgerEntriesService: LedgerEntriesService) {}

  @ApiOperation({ summary: 'POST /' })
  @ApiResponse({ status: 201, description: 'POST request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @ApiBody({ type: CreateLedgerEntryDto })
  @RequirePermissions(Permission.LEDGER_CREATE)
  @Post()
  create(@Body() dto: CreateLedgerEntryDto, @Req() req: AuthenticatedRequest) {
    return this.ledgerEntriesService.create(dto, req.user.userId, req.user);
  }

  @ApiOperation({ summary: 'POST import' })
  @ApiResponse({ status: 201, description: 'POST request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Post('import')
  @RequirePermissions(Permission.LEDGER_IMPORT)
  @HttpCode(HttpStatus.OK)
  importRecords(
    @Req() req: AuthenticatedRequest,
    @Body() body: { records: Array<Record<string, unknown>> },
  ) {
    return this.ledgerEntriesService.importRecords(
      body.records,
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
    return this.ledgerEntriesService.findAll(req.user);
  }

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
    return this.ledgerEntriesService.findOne(id, req.user);
  }

  @ApiOperation({ summary: 'PATCH :id' })
  @ApiResponse({ status: 200, description: 'PATCH request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @ApiBody({ type: UpdateLedgerEntryDto })
  @RequirePermissions(Permission.LEDGER_UPDATE)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateLedgerEntryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.ledgerEntriesService.update(id, dto, req.user);
  }

  @ApiOperation({ summary: 'DELETE :id' })
  @ApiResponse({ status: 200, description: 'DELETE request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Delete(':id')
  @RequirePermissions(Permission.LEDGER_DELETE)
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.ledgerEntriesService.remove(id, req.user);
  }
}
