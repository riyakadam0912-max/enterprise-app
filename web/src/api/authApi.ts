import { apiClient } from './apiClient';

export type UserRole = 'ADMIN' | 'HR' | 'MANAGER' | 'EMPLOYEE';

export interface AuthPayload {
  user: {
    id: number;
    name: string;
    email: string;
  };
  role: UserRole;
  roles: string[];
  permissions: string[];
  employeeId: number | null;
  organizationId: number | null;
}

export interface LoginResponse extends AuthPayload {
  message: string;
}

export interface LogoutResponse {
  message: string;
}

export async function loginUser(email: string, password: string): Promise<LoginResponse> {
  try {
    return await apiClient<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  } catch (error: unknown) {
    throw error instanceof Error ? error : new Error('Login failed');
  }
}

export async function getCurrentUser(): Promise<AuthPayload> {
  try {
    return await apiClient<AuthPayload>('/auth/me');
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Unable to determine current user: ${String(error)}`);
  }
}

export async function logoutUser(): Promise<LogoutResponse> {
  try {
    return await apiClient<LogoutResponse>('/auth/logout', {
      method: 'POST',
    });
  } catch (error: unknown) {
    throw error instanceof Error ? error : new Error('Logout failed');
  }
}
