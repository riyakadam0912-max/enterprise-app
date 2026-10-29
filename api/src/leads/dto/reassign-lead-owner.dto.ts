import { IsInt, IsOptional } from 'class-validator';

export class ReassignLeadOwnerDto {
  @IsOptional()
  @IsInt()
  ownerUserId?: number | null;
}
