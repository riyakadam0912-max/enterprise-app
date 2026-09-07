'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View, TextInput } from 'react-native';
import { apiError } from '@/src/api/client';
import { reportsDashboard } from '@/src/api/reports';
import { StatePanel } from '@/src/components/StatePanel';
import { useAuth } from '@/src/providers/AuthProvider';
import { tokens } from '@/src/theme/tokens';

type Point = { label: string; value: number; secondary?: number };
type ReportsFilters = { month?: string; department?: string; employeeId?: string; role?: string };

const POPULAR_DEPARTMENTS = ['Engineering', 'Sales', 'HR', 'Finance', 'Operations', 'Marketing'];

function getMonthValue(offset: number) {
  const date = new Date();
  date.setMonth(date.getMonth() + offset);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function toMonthInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export default function Reports() {
  const router = useRouter();
  const { session } = useAuth();
  const allowed = ['HR', 'ADMIN', 'MANAGER', 'SUPER_ADMIN'].includes(session?.role ?? '');
  const [month, setMonth] = useState(toMonthInputValue());
  const [department, setDepartment] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  
  const filters: ReportsFilters = useMemo(() => {
    return {
      month: month || undefined,
      department: department || undefined,
      employeeId: employeeId || undefined,
    };
  }, [month, department, employeeId]);
  
  const query = useQuery({
    queryKey: ['reports', 'dashboard', filters],
    queryFn: () => reportsDashboard(filters),
    enabled: allowed,
  });
  
  const handleClearFilters = () => {
    setMonth(toMonthInputValue());
    setDepartment('');
    setEmployeeId('');
  };

  const hasActiveFilters = department || employeeId || month !== toMonthInputValue();
  
  if (!allowed) return <View style={styles.page}><Text style={styles.title}>Reports</Text><StatePanel kind="denied" message="You do not have permission to view organization reports." /></View>;
  if (query.isLoading) return <View style={styles.page}><StatePanel kind="loading" message="Loading reports..." /></View>;
  if (query.isError || !query.data) return <View style={styles.page}><StatePanel kind="error" message={apiError(query.error)} onRetry={() => void query.refetch()} /></View>;
  
  const data = query.data;
  const charts = data.charts ?? {};
  const attendance = (charts.attendanceTrend ?? []).map((item) => ({ label: item.date, value: item.present, secondary: item.absent }));
  const payroll = (charts.payrollCost ?? []).map((item) => ({ label: item.month, value: item.netPay, secondary: item.deductions }));
  const growth = (charts.employeeGrowth ?? []).map((item) => ({ label: item.month, value: item.count }));
  const performance = charts.performanceDistribution ?? [];
  
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>Back</Text>
      </Pressable>
      <Text style={styles.title}>Reports</Text>
      <Text style={styles.subtitle}>Organization analytics within your authorized scope.</Text>
      
      {/* Quick Filter Chips */}
      <View style={styles.chipsContainer}>
        <Text style={styles.chipsLabel}>Quick Filters</Text>
        
        {/* Time Period Chips */}
        <View style={styles.chipsRow}>
          <Pressable 
            style={[styles.chip, month === getMonthValue(0) && styles.chipActive]}
            onPress={() => setMonth(getMonthValue(0))}
          >
            <Text style={[styles.chipText, month === getMonthValue(0) && styles.chipTextActive]}>This Month</Text>
          </Pressable>
          
          <Pressable 
            style={[styles.chip, month === getMonthValue(-1) && styles.chipActive]}
            onPress={() => setMonth(getMonthValue(-1))}
          >
            <Text style={[styles.chipText, month === getMonthValue(-1) && styles.chipTextActive]}>Last Month</Text>
          </Pressable>
          
          <Pressable 
            style={[styles.chip, month === getMonthValue(-3) && styles.chipActive]}
            onPress={() => setMonth(getMonthValue(-3))}
          >
            <Text style={[styles.chipText, month === getMonthValue(-3) && styles.chipTextActive]}>Q-3</Text>
          </Pressable>
        </View>
        
        {/* Department Chips */}
        <View style={styles.chipsRow}>
          {POPULAR_DEPARTMENTS.slice(0, 3).map((dept) => (
            <Pressable 
              key={dept}
              style={[styles.chip, department === dept && styles.chipActive]}
              onPress={() => setDepartment(department === dept ? '' : dept)}
            >
              <Text style={[styles.chipText, department === dept && styles.chipTextActive]}>
                {dept}
              </Text>
            </Pressable>
          ))}
        </View>
        
        <View style={styles.chipsRow}>
          {POPULAR_DEPARTMENTS.slice(3).map((dept) => (
            <Pressable 
              key={dept}
              style={[styles.chip, department === dept && styles.chipActive]}
              onPress={() => setDepartment(department === dept ? '' : dept)}
            >
              <Text style={[styles.chipText, department === dept && styles.chipTextActive]}>
                {dept}
              </Text>
            </Pressable>
          ))}
        </View>
        
        {/* Clear Filters Chip */}
        {hasActiveFilters && (
          <Pressable 
            style={styles.chipClear}
            onPress={handleClearFilters}
          >
            <Text style={styles.chipClearText}>✕ Clear All</Text>
          </Pressable>
        )}
      </View>
      
      {/* Advanced Filters Section */}
      <View style={styles.filterSection}>
        <Text style={styles.filterLabel}>Advanced Filters</Text>
        
        <View style={styles.filterInput}>
          <Text style={styles.filterInputLabel}>Month</Text>
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM"
            value={month}
            onChangeText={setMonth}
            placeholderTextColor={tokens.colors.muted}
          />
        </View>
        
        <View style={styles.filterInput}>
          <Text style={styles.filterInputLabel}>Department</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter department"
            value={department}
            onChangeText={setDepartment}
            placeholderTextColor={tokens.colors.muted}
          />
        </View>
        
        <View style={styles.filterInput}>
          <Text style={styles.filterInputLabel}>Employee ID</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter employee ID"
            value={employeeId}
            onChangeText={setEmployeeId}
            placeholderTextColor={tokens.colors.muted}
            keyboardType="number-pad"
          />
        </View>
      </View>
      
      <Text style={styles.heading}>Overview</Text>
      <View style={styles.grid}>
        {[['Employees', data.summaryCards?.totalEmployees], ['Present today', data.summaryCards?.presentToday], ['Payroll cost', data.summaryCards?.monthlyPayrollCost], ['Attrition', data.summaryCards?.attritionRate == null ? undefined : `${data.summaryCards.attritionRate}%`]].map(([label, value]) => (
          <View key={String(label)} style={styles.metric}>
            <Text style={styles.muted}>{String(label)}</Text>
            <Text style={styles.value}>{String(value ?? 0)}</Text>
          </View>
        ))}
      </View>
      
      <ChartCard title="Attendance Trend" subtitle="Present vs absent by day">
        <TrendChart points={attendance} />
      </ChartCard>
      
      <ChartCard title="Payroll Cost Trend" subtitle="Net pay and deductions by month">
        <GroupedBarChart points={payroll} primaryColor="#0ea5e9" secondaryColor="#fb7185" primaryLabel="Net pay" secondaryLabel="Deductions" />
      </ChartCard>
      
      <ChartCard title="Employee Growth" subtitle="Headcount movement over recent months">
        <SingleBarChart points={growth} color="#059669" />
      </ChartCard>
      
      <ChartCard title="Performance Distribution" subtitle="Rating buckets with counts">
        <DistributionChart points={performance.map((item) => ({ label: item.bucket, value: item.count }))} />
      </ChartCard>
      
      <Text style={styles.heading}>Attendance Summary</Text>
      <View style={styles.card}>
        {[['Total days', data.attendanceSummary?.totalDays], ['Present days', data.attendanceSummary?.presentDays], ['Absent days', data.attendanceSummary?.absentDays], ['Late count', data.attendanceSummary?.lateCount], ['Overtime hours', data.attendanceSummary?.overtimeHours]].map(([label, value]) => (
          <Text key={String(label)} style={styles.detail}>{String(label)}: {String(value ?? 0)}</Text>
        ))}
      </View>
    </ScrollView>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) { return <View style={styles.chartCard}><Text style={styles.chartTitle}>{title}</Text><Text style={styles.chartSubtitle}>{subtitle}</Text>{children}</View>; }
function TrendChart({ points }: { points: Point[] }) { const max = Math.max(...points.flatMap((item) => [item.value, item.secondary ?? 0]), 1); return points.length ? <View>{points.slice(-8).map((item) => <View key={item.label} style={styles.chartRow}><Text style={styles.axisLabel}>{item.label}</Text><View style={styles.chartTrack}><View style={[styles.bar, { width: `${Math.max((item.value / max) * 100, item.value ? 4 : 0)}%`, backgroundColor: '#0891b2' }]} /><View style={[styles.secondaryBar, { width: `${Math.max(((item.secondary ?? 0) / max) * 100, item.secondary ? 4 : 0)}%` }]} /></View><Text style={styles.chartValue}>{item.value}/{item.secondary ?? 0}</Text></View>)}</View> : <Text style={styles.muted}>No attendance trend data.</Text>; }
function GroupedBarChart({ points, primaryColor, secondaryColor, primaryLabel, secondaryLabel }: { points: Point[]; primaryColor: string; secondaryColor: string; primaryLabel: string; secondaryLabel: string }) { const max = Math.max(...points.flatMap((item) => [item.value, item.secondary ?? 0]), 1); return points.length ? <View><View style={styles.legend}><Text style={[styles.legendText, { color: primaryColor }]}>● {primaryLabel}</Text><Text style={[styles.legendText, { color: secondaryColor }]}>● {secondaryLabel}</Text></View>{points.slice(-6).map((item) => <View key={item.label} style={styles.chartRow}><Text style={styles.axisLabel}>{item.label}</Text><View style={styles.chartTrack}><View style={[styles.bar, { width: `${Math.max((item.value / max) * 100, item.value ? 4 : 0)}%`, backgroundColor: primaryColor }]} /><View style={[styles.secondaryBar, { width: `${Math.max(((item.secondary ?? 0) / max) * 100, item.secondary ? 4 : 0)}%`, backgroundColor: secondaryColor }]} /></View><Text style={styles.chartValue}>{Math.round(item.value)}</Text></View>)}</View> : <Text style={styles.muted}>No payroll trend data.</Text>; }
function SingleBarChart({ points, color }: { points: Point[]; color: string }) { const max = Math.max(...points.map((item) => item.value), 1); return points.length ? <View>{points.slice(-8).map((item) => <View key={item.label} style={styles.chartRow}><Text style={styles.axisLabel}>{item.label}</Text><View style={styles.chartTrack}><View style={[styles.bar, { width: `${Math.max((item.value / max) * 100, item.value ? 4 : 0)}%`, backgroundColor: color }]} /></View><Text style={styles.chartValue}>{item.value}</Text></View>)}</View> : <Text style={styles.muted}>No employee growth data.</Text>; }
function DistributionChart({ points }: { points: Point[] }) { const total = points.reduce((sum, item) => sum + item.value, 0) || 1; return points.length ? <View style={styles.distribution}>{points.map((item, index) => <View key={item.label} style={styles.distributionItem}><View style={[styles.distributionDot, { backgroundColor: ['#dc2626', '#f97316', '#eab308', '#16a34a'][index % 4] }]} /><Text style={styles.detail}>{item.label}: {item.value} ({Math.round((item.value / total) * 100)}%)</Text></View>)}</View> : <Text style={styles.muted}>No performance distribution data.</Text>; }

const styles = { 
  page: { padding: tokens.spacing.page, backgroundColor: tokens.colors.page, flexGrow: 1 }, 
  back: { color: tokens.colors.info, fontWeight: '700' as const }, 
  title: { ...tokens.type.title, color: tokens.colors.ink, marginTop: 18 }, 
  subtitle: { color: tokens.colors.muted, marginTop: 5, marginBottom: 18 }, 
  heading: { ...tokens.type.section, color: tokens.colors.ink, marginTop: 22, marginBottom: 10 }, 
  grid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 10 }, 
  metric: { minWidth: '46%' as const, flex: 1, backgroundColor: tokens.colors.surface, borderRadius: tokens.radius.card, padding: 15 }, 
  value: { color: tokens.colors.ink, fontWeight: '800' as const, fontSize: 19, marginTop: 6 }, 
  muted: { color: tokens.colors.muted, marginTop: 6 }, 
  chartCard: { backgroundColor: tokens.colors.surface, borderRadius: tokens.radius.card, padding: tokens.spacing.card, marginTop: tokens.spacing.section, borderWidth: 1, borderColor: '#e2e8f0' }, 
  chartTitle: { color: tokens.colors.ink, fontWeight: '800' as const, fontSize: 17 }, 
  chartSubtitle: { color: tokens.colors.muted, fontSize: 12, marginTop: 3, marginBottom: 14 }, 
  chartRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, marginBottom: 10 }, 
  axisLabel: { color: tokens.colors.muted, width: 72, fontSize: 11 }, 
  chartTrack: { flex: 1, height: 18, justifyContent: 'center' as const, gap: 2 }, 
  bar: { height: 7, borderRadius: 5 }, 
  secondaryBar: { height: 5, borderRadius: 5, backgroundColor: '#ef4444' }, 
  chartValue: { color: tokens.colors.text, width: 42, textAlign: 'right' as const, fontSize: 11, fontWeight: '700' as const }, 
  legend: { flexDirection: 'row' as const, gap: 14, marginBottom: 10 }, 
  legendText: { fontSize: 11, fontWeight: '700' as const }, 
  distribution: { gap: 9 }, 
  distributionItem: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 }, 
  distributionDot: { width: 10, height: 10, borderRadius: 5 }, 
  card: { backgroundColor: tokens.colors.surface, borderRadius: tokens.radius.card, padding: tokens.spacing.card }, 
  detail: { color: tokens.colors.text, marginBottom: 9 },
  filterSection: { backgroundColor: tokens.colors.surface, borderRadius: tokens.radius.card, padding: tokens.spacing.card, marginBottom: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  filterLabel: { fontWeight: '700' as const, color: tokens.colors.ink, fontSize: 14, marginBottom: 12 },
  filterInput: { marginBottom: 12 },
  filterInputLabel: { fontSize: 12, fontWeight: '600' as const, color: tokens.colors.text, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: tokens.radius.card, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: tokens.colors.ink, backgroundColor: tokens.colors.page },
  chipsContainer: { marginBottom: 20 },
  chipsLabel: { fontWeight: '700' as const, color: tokens.colors.ink, fontSize: 14, marginBottom: 10 },
  chipsRow: { flexDirection: 'row' as const, gap: 8, marginBottom: 10, flexWrap: 'wrap' as const },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1' },
  chipActive: { backgroundColor: '#0ea5e9', borderColor: '#0284c7' },
  chipText: { fontSize: 12, fontWeight: '600' as const, color: tokens.colors.text },
  chipTextActive: { color: '#ffffff', fontWeight: '700' as const },
  chipClear: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#fee2e2', borderWidth: 1, borderColor: '#fca5a5' },
  chipClearText: { fontSize: 12, fontWeight: '600' as const, color: '#dc2626' },
};
