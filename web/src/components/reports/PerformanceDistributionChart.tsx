'use client';

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type { PerformanceDistributionPoint } from '@/api/reportsApi';

const COLORS = ['#dc2626', '#f97316', '#eab308', '#16a34a'];

interface Props {
  data: PerformanceDistributionPoint[];
}

export default function PerformanceDistributionChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          dataKey="count"
          nameKey="bucket"
          cx="50%"
          cy="50%"
          outerRadius={95}
          label={(props) => {
            const bucket = (props.payload as { bucket?: string } | undefined)?.bucket ?? '';
            return `${bucket}: ${props.value ?? 0}`;
          }}
        >
          {data.map((entry, idx) => (
            <Cell key={entry.bucket} fill={COLORS[idx % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}
