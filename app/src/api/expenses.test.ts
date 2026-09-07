import { api } from './client';
import { approveExpense, createExpense, rejectExpense, removeExpense, updateExpense } from './expenses';

jest.mock('./client', () => ({
  api: { post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
  unwrap: (value: unknown) => value,
}));

const mockedApi = api as unknown as { post: jest.Mock; patch: jest.Mock; delete: jest.Mock };

beforeEach(() => jest.clearAllMocks());

test('creates an expense with the mobile claim payload', async () => {
  mockedApi.post.mockResolvedValue({ data: { id: 7, amount: 125, currency: 'INR' } });
  await expect(createExpense({ description: 'Taxi', amount: 125, currency: 'INR' })).resolves.toEqual({ id: 7, amount: 125, currency: 'INR' });
  expect(mockedApi.post).toHaveBeenCalledWith('/expenses', { description: 'Taxi', amount: 125, currency: 'INR' });
});

test('routes expense workflow actions to their backend endpoints', async () => {
  mockedApi.patch.mockResolvedValue({ data: { id: 7, status: 'APPROVED' } });
  mockedApi.delete.mockResolvedValue({ data: { id: 7 } });
  await approveExpense(7, 'manager');
  await rejectExpense(8, 'Missing receipt');
  await updateExpense(9, { description: 'Updated taxi' });
  await removeExpense(10);
  expect(mockedApi.patch).toHaveBeenNthCalledWith(1, '/expenses/7/manager-approve');
  expect(mockedApi.patch).toHaveBeenNthCalledWith(2, '/expenses/8/reject', { reason: 'Missing receipt' });
  expect(mockedApi.patch).toHaveBeenNthCalledWith(3, '/expenses/9', { description: 'Updated taxi' });
  expect(mockedApi.delete).toHaveBeenCalledWith('/expenses/10');
});