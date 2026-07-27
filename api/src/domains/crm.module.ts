import { Module } from '@nestjs/common';
import { LeadsModule } from '../leads/leads.module';
import { ContactsModule } from '../contacts/contacts.module';
import { DealsModule } from '../deals/deals.module';
import { CampaignLeadsModule } from '../campaign-leads/campaign-leads.module';
import { MarketingCampaignsModule } from '../marketing-campaigns/marketing-campaigns.module';
import { TicketsModule } from '../tickets/tickets.module';
import { QuotesModule } from '../quotes/quotes.module';

@Module({
  imports: [
    LeadsModule,
    ContactsModule,
    DealsModule,
    CampaignLeadsModule,
    MarketingCampaignsModule,
    TicketsModule,
    QuotesModule,
  ],
  exports: [
    LeadsModule,
    ContactsModule,
    DealsModule,
    CampaignLeadsModule,
    MarketingCampaignsModule,
    TicketsModule,
    QuotesModule,
  ],
})
export class CrmModule {}
