import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CreatePayrollCycleDto } from './dto/create-payroll-cycle.dto';
import { CreateSalaryStructureDto } from './dto/create-salary-structure.dto';
import { CreateTaxDeclarationDto } from './dto/create-tax-declaration.dto';
import { MarkPayrollEntryPaidDto } from './dto/mark-payroll-entry-paid.dto';
import { UpdateSalaryStructureDto } from './dto/update-salary-structure.dto';
import { PayrollService } from './payroll.service';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('Payroll')
@ApiBearerAuth()
@Controller('payroll')
export class PayrollController {
  constructor(private readonly service: PayrollService) {}

  // Salary Structure endpoints
  @Roles(Role.ADMIN, Role.HR)
  @ApiOperation({ summary: 'POST salary-structures' })
  @ApiResponse({ status: 201, description: 'POST request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @ApiBody({ type: CreateSalaryStructureDto })
  @Post('salary-structures')
  createSalaryStructure(@Body() dto: CreateSalaryStructureDto) {
    return this.service.createSalaryStructure(dto);
  }

  @Roles(Role.ADMIN, Role.HR)
  @ApiOperation({ summary: 'GET salary-structures' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('salary-structures')
  listSalaryStructures() {
    return this.service.listSalaryStructures();
  }

  @Roles(Role.ADMIN, Role.HR)
  @ApiOperation({ summary: 'GET salary-structures/employee/:employeeId' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('salary-structures/employee/:employeeId')
  getSalaryStructureByEmployee(@Param('employeeId', ParseIntPipe) employeeId: number) {
    return this.service.getSalaryStructureByEmployee(employeeId);
  }

  @Roles(Role.ADMIN, Role.HR)
  @ApiOperation({ summary: 'PATCH salary-structures/employee/:employeeId' })
  @ApiResponse({ status: 200, description: 'PATCH request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @ApiBody({ type: UpdateSalaryStructureDto })
  @Patch('salary-structures/employee/:employeeId')
  updateSalaryStructure(
    @Param('employeeId', ParseIntPipe) employeeId: number,
    @Body() dto: UpdateSalaryStructureDto,
  ) {
    return this.service.updateSalaryStructure(employeeId, dto);
  }

  // Payroll Cycle endpoints
  @Roles(Role.ADMIN, Role.HR)
  @ApiOperation({ summary: 'POST cycles' })
  @ApiResponse({ status: 201, description: 'POST request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @ApiBody({ type: CreatePayrollCycleDto })
  @Post('cycles')
  createCycle(@Body() dto: CreatePayrollCycleDto) {
    return this.service.createCycle(dto);
  }

  @Roles(Role.ADMIN, Role.HR)
  @ApiOperation({ summary: 'GET cycles' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('cycles')
  listCycles() {
    return this.service.listCycles();
  }

  @Roles(Role.ADMIN, Role.HR)
  @ApiOperation({ summary: 'PATCH cycles/:id/run' })
  @ApiResponse({ status: 200, description: 'PATCH request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Patch('cycles/:id/run')
  runCycle(@Param('id', ParseIntPipe) id: number) {
    return this.service.runCycle(id);
  }

  @Roles(Role.ADMIN, Role.HR)
  @ApiOperation({ summary: 'GET cycles/:id/entries' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('cycles/:id/entries')
  getCycleEntries(@Param('id', ParseIntPipe) id: number) {
    return this.service.getCycleEntries(id);
  }

  // Payroll Entry endpoints
  @Roles(Role.ADMIN, Role.HR)
  @ApiOperation({ summary: 'PATCH entries/:id/pay' })
  @ApiResponse({ status: 200, description: 'PATCH request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @ApiBody({ type: MarkPayrollEntryPaidDto })
  @Patch('entries/:id/pay')
  markEntryPaid(@Param('id', ParseIntPipe) id: number, @Body() dto: MarkPayrollEntryPaidDto) {
    return this.service.markEntryPaid(id, dto);
  }

  // Tax Declaration endpoints
  @Roles(Role.ADMIN, Role.HR, Role.EMPLOYEE)
  @ApiOperation({ summary: 'POST tax-declarations' })
  @ApiResponse({ status: 201, description: 'POST request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @ApiBody({ type: CreateTaxDeclarationDto })
  @Post('tax-declarations')
  createTaxDeclaration(@Body() dto: CreateTaxDeclarationDto) {
    return this.service.createTaxDeclaration(dto);
  }

  @Roles(Role.ADMIN, Role.HR, Role.EMPLOYEE)
  @ApiOperation({ summary: 'GET tax-declarations/:employeeId/:year' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('tax-declarations/:employeeId/:year')
  getTaxDeclaration(
    @Param('employeeId', ParseIntPipe) employeeId: number,
    @Param('year', ParseIntPipe) year: number,
  ) {
    return this.service.getTaxDeclaration(employeeId, year);
  }

  @Roles(Role.ADMIN, Role.HR)
  @ApiOperation({ summary: 'PATCH tax-declarations/:id/approve' })
  @ApiResponse({ status: 200, description: 'PATCH request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Patch('tax-declarations/:id/approve')
  approveTaxDeclaration(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { approvedBy: number },
  ) {
    return this.service.approveTaxDeclaration(id, body.approvedBy);
  }

  // Payslip endpoints
  @Roles(Role.ADMIN, Role.HR)
  @ApiOperation({ summary: 'POST cycles/:cycleId/generate-payslips' })
  @ApiResponse({ status: 201, description: 'POST request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Post('cycles/:cycleId/generate-payslips')
  generatePayslips(@Param('cycleId', ParseIntPipe) cycleId: number) {
    return this.service.generatePayslips(cycleId);
  }

  @Roles(Role.ADMIN, Role.HR, Role.EMPLOYEE)
  @ApiOperation({ summary: 'GET payslips/:payslipId' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('payslips/:payslipId')
  getPayslip(@Param('payslipId', ParseIntPipe) payslipId: number) {
    return this.service.getPayslip(payslipId);
  }

  @Roles(Role.ADMIN, Role.HR, Role.EMPLOYEE)
  @ApiOperation({ summary: 'GET payslips/employee/:employeeId' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('payslips/employee/:employeeId')
  getEmployeePayslips(
    @Param('employeeId', ParseIntPipe) employeeId: number,
  ) {
    return this.service.getEmployeePayslips(employeeId);
  }

  @Roles(Role.ADMIN, Role.HR, Role.EMPLOYEE)
  @ApiOperation({ summary: 'GET payslips/:payslipId/download' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('payslips/:payslipId/download')
  downloadPayslip(@Param('payslipId', ParseIntPipe) payslipId: number) {
    return this.service.downloadPayslip(payslipId);
  }

  // Form 16 endpoints
  @Roles(Role.ADMIN, Role.HR)
  @ApiOperation({ summary: 'POST form16/employee/:employeeId/:year' })
  @ApiResponse({ status: 201, description: 'POST request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Post('form16/employee/:employeeId/:year')
  generateForm16(
    @Param('employeeId', ParseIntPipe) employeeId: number,
    @Param('year', ParseIntPipe) year: number,
  ) {
    return this.service.generateForm16(employeeId, year);
  }

  @Roles(Role.ADMIN, Role.HR, Role.EMPLOYEE)
  @ApiOperation({ summary: 'GET form16/employee/:employeeId/:year' })
  @ApiResponse({ status: 200, description: 'GET request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Get('form16/employee/:employeeId/:year')
  getForm16(
    @Param('employeeId', ParseIntPipe) employeeId: number,
    @Param('year', ParseIntPipe) year: number,
  ) {
    return this.service.getForm16(employeeId, year);
  }
}
