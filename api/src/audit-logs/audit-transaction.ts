import { AsyncLocalStorage } from 'node:async_hooks';
import type { Prisma } from '@prisma/client';
const transactions = new AsyncLocalStorage<{
  owner: object;
  client: Prisma.TransactionClient;
}>();
export function runWithAuditTransaction<T>(
  owner: object,
  client: Prisma.TransactionClient,
  callback: () => T,
): T {
  return transactions.run({ owner, client }, callback);
}
export function getAuditTransaction(
  owner: object,
): Prisma.TransactionClient | undefined {
  const current = transactions.getStore();
  return current?.owner === owner ? current.client : undefined;
}
