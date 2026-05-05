import axios, { type AxiosError } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '/api/v1';

export const axiosClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

axiosClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token') ?? localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }

  return config;
});

axiosClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('access_token');
      localStorage.removeItem('role');
      localStorage.removeItem('employeeId');
      localStorage.removeItem('currentUser');
      window.location.href = '/login';
    }

    return Promise.reject(error);
  },
);
