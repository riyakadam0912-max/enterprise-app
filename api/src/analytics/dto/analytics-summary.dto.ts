import { Type } from 'class-transformer';
import { IsNumber, IsObject, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AbsenteeismSummaryDto {
  @ApiProperty({ example: 120 })
  @IsNumber()
  totalEmployees!: number;

  @ApiProperty({ example: 104 })
  @IsNumber()
  presentCount!: number;

  @ApiProperty({ example: 13.33 })
  @IsNumber()
  absenteeismRate!: number;
}

export class BurnRateSummaryDto {
  @ApiProperty({ example: 245000 })
  @IsNumber()
  payroll!: number;

  @ApiProperty({ example: 42000 })
  @IsNumber()
  expenses!: number;

  @ApiProperty({ example: 287000 })
  @IsNumber()
  total!: number;
}

export class RevenueVelocitySummaryDto {
  @ApiProperty({ example: 18.42 })
  @IsNumber()
  averageDays!: number;
}

export class AnalyticsSummaryDto {
  @ApiProperty({ type: AbsenteeismSummaryDto })
  @ValidateNested()
  @Type(() => AbsenteeismSummaryDto)
  @IsObject()
  absenteeism!: AbsenteeismSummaryDto;

  @ApiProperty({ type: BurnRateSummaryDto })
  @ValidateNested()
  @Type(() => BurnRateSummaryDto)
  @IsObject()
  burnRate!: BurnRateSummaryDto;

  @ApiProperty({ type: RevenueVelocitySummaryDto })
  @ValidateNested()
  @Type(() => RevenueVelocitySummaryDto)
  @IsObject()
  revenueVelocity!: RevenueVelocitySummaryDto;
}
