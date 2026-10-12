import { apiClient } from './apiClient';
import type { Product } from '@/types/entities';

export type ProductInput = {
  name: string;
  description?: string;
  price: number;
  sku?: string;
  categoryId?: number;
  taxRate?: number;
  isActive?: boolean;
};

export function getProducts(): Promise<Product[]> {
  return apiClient<Product[]>('/products');
}

export function createProduct(data: ProductInput): Promise<Product> {
  return apiClient<Product>('/products', { method: 'POST', body: JSON.stringify(data) });
}