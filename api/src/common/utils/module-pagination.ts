import type { ModulePaginationMeta } from '../interfaces/module-list.interface';
import type { ModuleQueryDto } from '../dto/module-query.dto';

export function buildModulePaginationMeta(
  total: number,
  page: number,
  limit: number,
): ModulePaginationMeta {
  const normalizedLimit = Math.max(1, limit);
  const totalPages = Math.max(1, Math.ceil(total / normalizedLimit));
  const normalizedPage = Math.min(Math.max(1, page), totalPages);

  return {
    page: normalizedPage,
    limit: normalizedLimit,
    total,
    totalPages,
    hasNextPage: normalizedPage < totalPages,
    hasPreviousPage: normalizedPage > 1,
  };
}

export function normalizeModuleQuery(
  query?: Partial<ModuleQueryDto>,
): Required<Pick<ModuleQueryDto, 'page' | 'limit' | 'sortDirection'>> &
  Pick<ModuleQueryDto, 'search' | 'sortBy'> {
  return {
    page: query?.page && query.page > 0 ? query.page : 1,
    limit: query?.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20,
    search: query?.search?.trim() || undefined,
    sortBy: query?.sortBy?.trim() || undefined,
    sortDirection: query?.sortDirection === 'asc' ? 'asc' : 'desc',
  };
}
