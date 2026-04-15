import { Module } from '@nestjs/common';
import { MarketingCampaignsController } from './marketing-campaigns.controller';
import { MarketingCampaignsService } from './marketing-campaigns.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [MarketingCampaignsController],
  providers: [MarketingCampaignsService],
})
export class MarketingCampaignsModule {}
