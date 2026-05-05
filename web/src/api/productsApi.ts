import { apiClient } from './apiClient';
import type { Category as ProductCategory, Product } from '@/types/entities';

export type { ProductCategory, Product };

export interface CreateProductPayload {
  name:        string;
  description?: string;
  price:       number;
  sku?:        string;
  categoryId?: number;
  taxRate?:    number;
  isActive?:   boolean;
}

export type UpdateProductPayload = Partial<CreateProductPayload>;

export function getProducts(): Promise<Product[]>                           { return apiClient<Product[]>('/products'); }
export function getProduct(id: number): Promise<Product>                    { return apiClient<Product>(`/products/${id}`); }
export function createProduct(data: CreateProductPayload): Promise<Product> { return apiClient<Product>('/products', { method: 'POST', body: JSON.stringify(data) }); }
export function updateProduct(id: number, data: UpdateProductPayload): Promise<Product> { return apiClient<Product>(`/products/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }
export function deleteProduct(id: number): Promise<void>                    { return apiClient<void>(`/products/${id}`, { method: 'DELETE' }); }

export function getProductCategories(): Promise<ProductCategory[]>          { return apiClient<ProductCategory[]>('/products/categories'); }
export function createProductCategory(name: string): Promise<ProductCategory> { return apiClient<ProductCategory>('/products/categories', { method: 'POST', body: JSON.stringify({ name }) }); }
