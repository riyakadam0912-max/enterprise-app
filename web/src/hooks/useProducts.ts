'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  getProducts, getProduct, createProduct, updateProduct, deleteProduct,
  getProductCategories,
  Product, ProductCategory, CreateProductPayload, UpdateProductPayload,
} from '@/api/productsApi';

export function useProducts() {
  const [products, setProducts]   = useState<Product[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true); setError(null);
    try { setProducts(await getProducts()); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to fetch products'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);
  return { products, loading, error, refetch: fetchProducts };
}

export function useProduct(id: number) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getProduct(id)
      .then(setProduct)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to fetch product'))
      .finally(() => setLoading(false));
  }, [id]);

  return { product, loading, error };
}

export function useProductCategories() {
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    getProductCategories()
      .then(setCategories)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { categories, loading };
}

export async function addProduct(data: CreateProductPayload)               { return createProduct(data); }
export async function editProduct(id: number, data: UpdateProductPayload)  { return updateProduct(id, data); }
export async function removeProduct(id: number)                            { return deleteProduct(id); }
