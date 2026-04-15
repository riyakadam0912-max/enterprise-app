import { PartialType } from '@nestjs/mapped-types';
import { CreateLedgerEntryDto } from './create-ledger-entry.dto';

export class UpdateLedgerEntryDto extends PartialType(CreateLedgerEntryDto) {}
