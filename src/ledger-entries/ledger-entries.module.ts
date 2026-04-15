import { Module } from '@nestjs/common';
import { LedgerEntriesService } from './ledger-entries.service';
import { LedgerEntriesController } from './ledger-entries.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports:     [PrismaModule],
  controllers: [LedgerEntriesController],
  providers:   [LedgerEntriesService],
})
export class LedgerEntriesModule {}
