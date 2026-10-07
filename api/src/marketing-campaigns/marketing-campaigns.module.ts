import { Module } from '@nestjs/common';
import { MarketingCampaignsController } from './marketing-campaigns.controller';
import { MarketingCampaignsService } from './marketing-campaigns.service';
import { MarketingPostsController } from './marketing-posts.controller';
import { MarketingPostsService } from './marketing-posts.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [MarketingCampaignsController, MarketingPostsController],
  providers: [MarketingCampaignsService, MarketingPostsService],
})
export class MarketingCampaignsModule {}
