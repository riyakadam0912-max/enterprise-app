import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Length, Max, Min, ValidateNested } from 'class-validator';

class GeneralSettingsDto {
  @IsOptional() @IsString() @Length(2, 100) platformName?: string;
  @IsOptional() @IsString() @Length(2, 100) supportEmail?: string;
  @IsOptional() @IsString() @Length(2, 80) defaultTimezone?: string;
  @IsOptional() @IsIn(['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD']) defaultCurrency?: string;
  @IsOptional() @IsIn(['en-IN', 'en-US', 'en-GB']) defaultLocale?: string;
}

class SecuritySettingsDto {
  @IsOptional() @IsInt() @Min(8) @Max(128) minimumPasswordLength?: number;
  @IsOptional() @IsInt() @Min(5) @Max(10080) sessionTimeoutMinutes?: number;
  @IsOptional() @IsBoolean() requireTwoFactor?: boolean;
}

class NotificationSettingsDto {
  @IsOptional() @IsBoolean() emailEnabled?: boolean;
  @IsOptional() @IsBoolean() smsEnabled?: boolean;
  @IsOptional() @IsBoolean() criticalAlertsEnabled?: boolean;
}

class FeatureSettingsDto {
  @IsOptional() @IsBoolean() maintenanceMode?: boolean;
  @IsOptional() @IsBoolean() allowOrganizationSignup?: boolean;
}

export class UpdatePlatformSettingsDto {
  @IsOptional() @ValidateNested() @Type(() => GeneralSettingsDto) general?: GeneralSettingsDto;
  @IsOptional() @ValidateNested() @Type(() => SecuritySettingsDto) security?: SecuritySettingsDto;
  @IsOptional() @ValidateNested() @Type(() => NotificationSettingsDto) notifications?: NotificationSettingsDto;
  @IsOptional() @ValidateNested() @Type(() => FeatureSettingsDto) features?: FeatureSettingsDto;
}
