import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
export class CreateDynamicFormDto {
  @ApiProperty({ example: 'sample-formName' })
  formName!: string;
  @ApiPropertyOptional({ example: 'sample-formCode' })
  formCode?: string;
  @ApiPropertyOptional({ example: 'sample-description' })
  description?: string;
  @ApiPropertyOptional({ example: 'sample-createdBy' })
  createdBy?: string;
  @ApiPropertyOptional({ example: 'ACTIVE' })
  status?: string;
  @ApiPropertyOptional({ example: 'sample-formType' })
  formType?: string;
  @ApiPropertyOptional({ example: 'sample-targetModule' })
  targetModule?: string;
  @ApiPropertyOptional({ example: 'sample-createdOn' })
  createdOn?: string;
}
