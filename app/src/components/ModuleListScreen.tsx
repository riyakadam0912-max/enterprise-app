import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Share, Text, TextInput, View } from 'react-native';
import { apiError } from '@/src/api/client';
import { useAuth } from '@/src/providers/AuthProvider';
import { can } from '@/src/utils/permissions';
import { StatePanel } from '@/src/components/StatePanel';
import { tokens } from '@/src/theme/tokens';

type Item = Record<string, unknown>;
export type ListFilter = { key: string; label: string; options: string[] };
export type ListSort = { key: string; label: string };
export type ListLoadParams = { search: string; filters: Record<string, string>; sortKey?: string; sortDirection: 'asc' | 'desc'; page: number; pageSize: number };
type ModuleListProps = { title: string; subtitle: string; queryKey: string[]; load: (...args: never[]) => Promise<unknown>; renderItem: (item: Item, index: number) => React.ReactNode; renderActions?: (item: Item) => React.ReactNode; headerAction?: React.ReactNode; searchKeys?: string[]; filters?: ListFilter[]; sortOptions?: ListSort[]; pageSize?: number; canAccess?: boolean; permission?: string; unauthorizedMessage?: string; emptyMessage?: string };

export function ModuleListScreen({ title, subtitle, queryKey, load, renderItem, renderActions, headerAction, searchKeys = [], filters = [], sortOptions = [], pageSize = 10, canAccess, permission, unauthorizedMessage = 'You do not have permission to view this workspace.', emptyMessage = 'No records in this workspace.' }: ModuleListProps) {
  const { session } = useAuth();
  const inferredPermission = permission ?? ({ contacts: 'contact.read', deals: 'deal.read', employees: 'employee.read', expenses: 'expense.read', invoices: 'invoice.read', leads: 'lead.read', projects: 'project.read', tasks: 'task.read', timesheets: 'timesheet.read', quotes: 'quote.read', ledger: 'ledger.read', payments: 'payment.read', payslips: 'payroll.read', notifications: 'notification.read' } as Record<string, string>)[queryKey[0]];
  const authorized = canAccess ?? (inferredPermission ? can(session, inferredPermission) : true);
  const [search, setSearch] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [sortKey, setSortKey] = useState(sortOptions[0]?.key);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const query = useQuery({ queryKey: [...queryKey, { search, activeFilters, sortKey, sortDirection }], queryFn: async () => { const value = await load(); if (Array.isArray(value)) return value as Item[]; if (value && typeof value === 'object' && 'items' in value && Array.isArray((value as { items: unknown[] }).items)) return (value as { items: unknown[] }).items as Item[]; return []; }, enabled: authorized });
  const allItems = query.data ?? [];
  const filtered = allItems.filter((item) => { const needle = search.trim().toLowerCase(); const matchesSearch = !needle || searchKeys.length === 0 || searchKeys.some((key) => String(item[key] ?? '').toLowerCase().includes(needle)); return matchesSearch && filters.every((filter) => !activeFilters[filter.key] || String(item[filter.key] ?? '') === activeFilters[filter.key]); }).sort((left, right) => { if (!sortKey) return 0; const comparison = String(left[sortKey] ?? '').localeCompare(String(right[sortKey] ?? ''), undefined, { numeric: true, sensitivity: 'base' }); return sortDirection === 'asc' ? comparison : -comparison; });
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const items = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const exportItems = async () => { const columns = Array.from(new Set(filtered.flatMap((item) => Object.keys(item).filter((key) => typeof item[key] !== 'object')))); const csv = [columns.join(','), ...filtered.map((item) => columns.map((key) => `"${String(item[key] ?? '').replaceAll('"', '""')}"`).join(','))].join('\n'); await Share.share({ message: csv, title: `${title}.csv` }); };
  const updateFilter = (key: string, value: string) => { setActiveFilters((current) => ({ ...current, [key]: current[key] === value ? '' : value })); setPage(1); };
  if (!authorized) return <View style={styles.page}><Text style={styles.title}>{title}</Text><StatePanel kind="denied" message={unauthorizedMessage} /></View>;
  return <ScrollView refreshControl={<RefreshControl refreshing={query.isFetching} onRefresh={() => query.refetch()} />} contentContainerStyle={styles.page}>
    <View style={styles.header}><View style={styles.headerText}><Text style={styles.title}>{title}</Text><Text style={styles.subtitle}>{subtitle}</Text></View>{headerAction}</View>
    {query.isLoading ? <StatePanel kind="loading" message={`Loading ${title.toLowerCase()}...`} /> : null}
    {query.isError ? <StatePanel kind="error" message={apiError(query.error)} onRetry={() => void query.refetch()} /> : null}
    {!query.isLoading && !query.isError ? <>
      <View style={styles.tools}>
        {searchKeys.length > 0 ? <TextInput value={search} onChangeText={(value) => { setSearch(value); setPage(1); }} placeholder={`Search ${title.toLowerCase()}`} style={styles.search} /> : null}
        {filters.map((filter) => <View key={filter.key} style={styles.filterGroup}><Text style={styles.toolLabel}>{filter.label}</Text><View style={styles.chips}>{filter.options.map((option) => <Pressable key={option} onPress={() => updateFilter(filter.key, option)} style={[styles.chip, activeFilters[filter.key] === option && styles.chipActive]}><Text style={activeFilters[filter.key] === option ? styles.chipTextActive : styles.chipText}>{option}</Text></Pressable>)}</View></View>)}
        {sortOptions.length > 0 ? <View style={styles.sortRow}><Text style={styles.toolLabel}>Sort</Text>{sortOptions.map((option) => <Pressable key={option.key} onPress={() => sortKey === option.key ? setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc') : setSortKey(option.key)} style={[styles.chip, sortKey === option.key && styles.chipActive]}><Text style={sortKey === option.key ? styles.chipTextActive : styles.chipText}>{option.label}{sortKey === option.key ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : ''}</Text></Pressable>)}</View> : null}
        <View style={styles.utilityRow}><Text style={styles.resultCount}>{filtered.length} result{filtered.length === 1 ? '' : 's'}</Text><Pressable onPress={exportItems} disabled={filtered.length === 0}><Text style={styles.exportText}>Export CSV</Text></Pressable></View>
      </View>
      {items.length === 0 ? <StatePanel kind="empty" message={emptyMessage} /> : items.map((item, index) => <View key={String(item.id ?? index)}>{renderItem(item, (safePage - 1) * pageSize + index)}{renderActions ? renderActions(item) : null}</View>)}
      {totalPages > 1 ? <View style={styles.pagination}><Pressable disabled={safePage === 1} onPress={() => setPage(safePage - 1)}><Text style={safePage === 1 ? styles.disabled : styles.retry}>Previous</Text></Pressable><Text style={styles.muted}>Page {safePage} of {totalPages}</Text><Pressable disabled={safePage === totalPages} onPress={() => setPage(safePage + 1)}><Text style={safePage === totalPages ? styles.disabled : styles.retry}>Next</Text></Pressable></View> : null}
    </> : null}
  </ScrollView>;
}

export function RecordCard({ item, titleKey, detailKeys }: { item: Item; titleKey: string; detailKeys: string[] }) { return <View style={{ backgroundColor: tokens.colors.surface, borderRadius: tokens.radius.card, padding: tokens.spacing.card, marginBottom: tokens.spacing.control }}><Text style={{ color: tokens.colors.ink, fontWeight: '700', fontSize: 16 }}>{String(item[titleKey] ?? 'Untitled')}</Text>{detailKeys.map((key) => item[key] != null ? <Text key={key} style={{ color: tokens.colors.muted, marginTop: 5 }}>{key}: {String(item[key])}</Text> : null)}</View>; }

const styles = { page: { padding: tokens.spacing.page, backgroundColor: tokens.colors.page, flexGrow: 1 } as const, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: tokens.spacing.control } as const, headerText: { flex: 1 } as const, title: { ...tokens.type.title, color: tokens.colors.ink } as const, subtitle: { color: tokens.colors.muted, marginTop: 5, marginBottom: 18 } as const, tools: { backgroundColor: tokens.colors.surface, borderRadius: tokens.radius.card, padding: 14, marginBottom: tokens.spacing.section } as const, search: { borderWidth: 1, borderColor: tokens.colors.border, borderRadius: tokens.radius.control, padding: tokens.spacing.control, color: tokens.colors.ink } as const, filterGroup: { marginTop: tokens.spacing.control } as const, toolLabel: { color: tokens.colors.text, ...tokens.type.label, marginBottom: 6 } as const, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 } as const, chip: { borderWidth: 1, borderColor: tokens.colors.border, borderRadius: tokens.radius.chip, paddingHorizontal: 10, paddingVertical: 8 } as const, chipActive: { backgroundColor: tokens.colors.ink, borderColor: tokens.colors.ink } as const, chipText: { color: tokens.colors.text, fontSize: 12, fontWeight: '700' } as const, chipTextActive: { color: '#fff', fontSize: 12, fontWeight: '700' } as const, sortRow: { marginTop: tokens.spacing.control } as const, utilityRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 } as const, resultCount: { color: tokens.colors.muted, fontSize: 12 } as const, exportText: { color: tokens.colors.primaryPressed, fontWeight: '800' } as const, state: { backgroundColor: tokens.colors.surface, borderRadius: tokens.radius.card, padding: 22, marginBottom: tokens.spacing.control } as const, muted: { color: tokens.colors.muted, textAlign: 'center' } as const, errorBox: { backgroundColor: tokens.colors.dangerSoft, padding: 15, borderRadius: tokens.radius.control, marginBottom: tokens.spacing.control } as const, error: { color: tokens.colors.danger } as const, retry: { color: tokens.colors.info, fontWeight: '800' } as const, disabled: { color: '#94a3b8', fontWeight: '800' } as const, pagination: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16 } as const };
