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
});
