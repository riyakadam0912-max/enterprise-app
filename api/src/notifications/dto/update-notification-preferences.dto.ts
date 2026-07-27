import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({ example: true })
  emailEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({ example: true })
  pushEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({ example: true })
  inAppEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({ example: true })
  mentionNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({ example: true })
  approvalNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({ example: true })
  reminderNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({ example: true })
  criticalBypassMute?: boolean;
}
