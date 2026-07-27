import { Module } from '@nestjs/common';
import { InvoicesModule } from '../invoices/invoices.module';
import { PaymentsModule } from '../payments/payments.module';
import { LedgerEntriesModule } from '../ledger-entries/ledger-entries.module';
import { ExpensesModule } from '../expenses/expenses.module';

@Module({
  imports: [
    InvoicesModule,
    PaymentsModule,
    LedgerEntriesModule,
    ExpensesModule,
  ],
  exports: [
    InvoicesModule,
    PaymentsModule,
    LedgerEntriesModule,
    ExpensesModule,
  ],
})
export class FinanceModule {}
