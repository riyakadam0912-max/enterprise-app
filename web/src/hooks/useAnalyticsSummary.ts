import { useQuery } from '@tanstack/react-query';
import { getAnalyticsSummary } from '@/api/analyticsApi';

export function useAnalyticsSummary() {
  return useQuery({
    queryKey: ['analytics'],
    queryFn: getAnalyticsSummary,
    staleTime: 10 * 60 * 1000,
  });
}