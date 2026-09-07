import { api } from './client';
import { applyLeave, leaveRequest, rejectLeave, removeLeaveRequest, updateLeaveRequest } from './leave';

jest.mock('./client', () => ({
  api: { post: jest.fn(), get: jest.fn(), patch: jest.fn(), delete: jest.fn() },
  unwrap: (value: unknown) => value,
}));

const mockedApi = api as unknown as { post: jest.Mock; get: jest.Mock; patch: jest.Mock; delete: jest.Mock };

beforeEach(() => jest.clearAllMocks());

test('submits a supported leave type and preserves its dates', async () => {
  mockedApi.post.mockResolvedValue({ data: { id: 3, status: 'PENDING_MANAGER' } });
  await applyLeave({ leaveType: 'PAID', startDate: '2026-09-10', endDate: '2026-09-11', reason: 'Personal work' });
  expect(mockedApi.post).toHaveBeenCalledWith('/ess/leave/apply', { leaveType: 'PAID', startDate: '2026-09-10', endDate: '2026-09-11', reason: 'Personal work' });
});

test('supports leave detail, edit, cancellation, and reasoned rejection', async () => {
  mockedApi.get.mockResolvedValue({ data: { id: 3 } });
  mockedApi.patch.mockResolvedValue({ data: { id: 3, status: 'REJECTED' } });
  mockedApi.delete.mockResolvedValue({ data: { id: 3 } });
  await leaveRequest(3);
  await updateLeaveRequest(3, { leaveType: 'SICK', startDate: '2026-09-12', endDate: '2026-09-12' });
  await rejectLeave(3, 'Insufficient balance');
  await removeLeaveRequest(3);
  expect(mockedApi.get).toHaveBeenCalledWith('/leave-requests/3');
  expect(mockedApi.patch).toHaveBeenNthCalledWith(1, '/leave-requests/3', { leaveType: 'SICK', startDate: '2026-09-12', endDate: '2026-09-12' });
  expect(mockedApi.patch).toHaveBeenNthCalledWith(2, '/leave-requests/3/reject', { reason: 'Insufficient balance' });
  expect(mockedApi.delete).toHaveBeenCalledWith('/leave-requests/3');
});