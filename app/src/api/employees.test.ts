import { api } from './client';
import { removeEmployee, updateEmployee } from './employees';

jest.mock('./client', () => ({
  api: { patch: jest.fn(), delete: jest.fn() },
  unwrap: (value: unknown) => value,
}));

const mockedApi = api as unknown as { patch: jest.Mock; delete: jest.Mock };

beforeEach(() => jest.clearAllMocks());

test('updates and removes an employee through the management endpoints', async () => {
  mockedApi.patch.mockResolvedValue({ data: { id: 4, name: 'Updated User' } });
  mockedApi.delete.mockResolvedValue({ data: { id: 4 } });
  await updateEmployee(4, { name: 'Updated User', department: 'Finance' });
  await removeEmployee(4);
  expect(mockedApi.patch).toHaveBeenCalledWith('/employees/4', { name: 'Updated User', department: 'Finance' });
  expect(mockedApi.delete).toHaveBeenCalledWith('/employees/4');
});