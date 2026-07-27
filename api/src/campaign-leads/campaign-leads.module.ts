import { Module } from '@nestjs/common';
import { CampaignLeadsController } from './campaign-leads.controller';
import { CampaignLeadsService } from './campaign-leads.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CampaignLeadsController],
  providers: [CampaignLeadsService],
})
export class CampaignLeadsModule {}
