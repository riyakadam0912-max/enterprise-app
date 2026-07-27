import { PartialType } from '@nestjs/mapped-types';
import { CreateCampaignLeadDto } from './create-campaign-lead.dto';

export class UpdateCampaignLeadDto extends PartialType(CreateCampaignLeadDto) {}
