'use client';

import { motion } from 'framer-motion';
import { Building2, CheckCircle2, ShieldCheck, TrendingUp, Users } from 'lucide-react';
import { Card } from '@/components/ui/card';

const stats = [
  { label: 'Organizations', value: '128', subtitle: '+12 this month', icon: Building2, tone: 'from-indigo-500 to-blue-500' },
  { label: 'Active Users', value: '2.4K', subtitle: '+8.2% week over week', icon: Users, tone: 'from-emerald-500 to-teal-500' },
  { label: 'Healthy Tenants', value: '115', subtitle: '90% uptime', icon: CheckCircle2, tone: 'from-violet-500 to-fuchsia-500' },
  { label: 'Security Events', value: '24', subtitle: '3 require review', icon: ShieldCheck, tone: 'from-amber-500 to-orange-500' },
];

export function SuperAdminOverviewCards() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04, duration: 0.2 }}>
            <Card className="overflow-hidden border-slate-200/80 bg-white/80 p-5 shadow-[0_16px_45px_-24px_rgba(15,23,42,0.35)] backdrop-blur">
              <div className={`mb-4 h-11 w-11 rounded-2xl bg-linear-to-br ${stat.tone} p-3 text-white`}>
                <Icon className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-slate-500">{stat.label}</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{stat.value}</p>
              <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                {stat.subtitle}
              </p>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
