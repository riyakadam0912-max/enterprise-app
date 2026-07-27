import { PartialType } from '@nestjs/mapped-types';
import { CreateMarketingCampaignDto } from './create-marketing-campaign.dto';

export class UpdateMarketingCampaignDto extends PartialType(
  CreateMarketingCampaignDto,
) {}
