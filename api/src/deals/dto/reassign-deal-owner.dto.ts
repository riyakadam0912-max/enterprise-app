import { IsInt, IsOptional } from 'class-validator';

export class ReassignDealOwnerDto {
  @IsOptional()
  @IsInt()
  ownerUserId?: number | null;
}
