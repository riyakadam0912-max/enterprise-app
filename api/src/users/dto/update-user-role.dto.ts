import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../../common/enums/role.enum';

export class UpdateUserRoleDto {
  @IsEnum(Role)
  @ApiProperty({ enum: Role, example: Role.EMPLOYEE })
  role!: Role;
}
