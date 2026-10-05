import { currentUser } from '@/src/api/auth';
import { contextStore, tokenStore } from '@/src/api/client';
import { initializeAuthSession } from '@/src/providers/AuthProvider';

jest.mock('@/src/api/auth', () => ({
  currentUser: jest.fn(),
  login: jest.fn(),
  logout: jest.fn(),
}));

jest.mock('@/src/api/client', () => ({
  contextStore: {
    setOrg: jest.fn(),
    setBU: jest.fn(),
  },
  tokenStore: {
    getAccess: jest.fn(),
    clear: jest.fn(),
  },
  normalizePersistedId: jest.fn((value: number | string | null | undefined) => {
    if (value == null || value === '') return null;
    const normalized = Number(value);
    return Number.isFinite(normalized) && normalized > 0 ? normalized : null;
  }),
  setSessionExpiredHandler: jest.fn(),
}));

const mockedCurrentUser = jest.mocked(currentUser);
const mockedTokenStore = jest.mocked(tokenStore);
const mockedContextStore = jest.mocked(contextStore);

describe('initializeAuthSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('clears session and returns null when the authenticated bootstrap fails', async () => {
    mockedTokenStore.getAccess.mockResolvedValue('token-123');
    mockedCurrentUser.mockRejectedValue(new Error('Network unavailable'));

    await expect(initializeAuthSession()).resolves.toBeNull();

    expect(mockedTokenStore.clear).toHaveBeenCalledTimes(1);
    expect(mockedContextStore.setOrg).toHaveBeenCalledWith(null);
    expect(mockedContextStore.setBU).toHaveBeenCalledWith(null);
  });

  test('clears a stale persisted organization when the active session has no valid org scope', async () => {
    mockedTokenStore.getAccess.mockResolvedValue('token-123');
    mockedCurrentUser.mockResolvedValue({
      user: { id: 7, name: 'Maya', email: 'maya@example.com' },
      role: 'EMPLOYEE',
      roles: ['EMPLOYEE'],
      permissions: [],
      employeeId: 11,
      organizationId: null,
      organizationName: null,
      organizationSlug: null,
      organizationLogo: null,
      isSuperAdmin: false,
      isPlatformAdmin: false,
    });

    await expect(initializeAuthSession()).resolves.toMatchObject({ organizationId: null });

    expect(mockedContextStore.setOrg).toHaveBeenCalledWith(null);
    expect(mockedContextStore.setBU).toHaveBeenCalledWith(null);
  });
});
