import { apiClient } from './apiClient';
import type { Product } from '@/types/entities';

export function getProducts(): Promise<Product[]> {
  return apiClient<Product[]>('/products');
}