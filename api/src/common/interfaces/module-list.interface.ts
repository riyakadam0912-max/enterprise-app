export interface ModulePaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface ModuleListResult<T> {
  items: T[];
  meta: ModulePaginationMeta;
}
