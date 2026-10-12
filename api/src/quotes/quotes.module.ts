import { Module } from '@nestjs/common';
import { QuotesService } from './quotes.service';
import { QuotesController } from './quotes.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { PublicQuotesController } from './public-quotes.controller';
import { PublicQuotesService } from './public-quotes.service';

@Module({
  imports: [PrismaModule],
  controllers: [QuotesController, PublicQuotesController],
  providers: [QuotesService, PublicQuotesService],
})
export class QuotesModule {}
