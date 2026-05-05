import { apiClient } from './apiClient';

export type UserRole = 'ADMIN' | 'HR' | 'MANAGER' | 'EMPLOYEE';

export interface LoginResponse {
  message: string;
  access_token: string;
  refresh_token?: string;
  user: {
    id: number;
    name: string;
    email: string;
  };
  role: UserRole;
  employeeId: number | null;
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
