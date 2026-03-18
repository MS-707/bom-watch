"use client";

import dynamic from 'next/dynamic';
import { BarChart3, TrendingUp } from 'lucide-react';

const ResponsiveContainer = dynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false });
const AreaChart = dynamic(() => import('recharts').then(m => m.AreaChart), { ssr: false });
const Area = dynamic(() => import('recharts').then(m => m.Area), { ssr: false });
const XAxis = dynamic(() => import('recharts').then(m => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then(m => m.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then(m => m.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then(m => m.Tooltip), { ssr: false });
const PieChart = dynamic(() => import('recharts').then(m => m.PieChart), { ssr: false });
const Pie = dynamic(() => import('recharts').then(m => m.Pie), { ssr: false });
const Cell = dynamic(() => import('recharts').then(m => m.Cell), { ssr: false });

const monthlySavings = [
  { month: 'Oct', savings: 890 },
  { month: 'Nov', savings: 1240 },
  { month: 'Dec', savings: 1680 },
  { month: 'Jan', savings: 2100 },
  { month: 'Feb', savings: 2340 },
  { month: 'Mar', savings: 2847 },
];

const vendorSpend = [
  { name: 'McMaster-Carr', value: 68, color: '#f97316' },
  { name: 'Grainger', value: 22, color: '#10b981' },
  { name: 'DigiKey', value: 7, color: '#3b82f6' },
  { name: 'Mouser', value: 3, color: '#a855f7' },
];

export function SavingsChart() {
  return (
    <div className="md:col-span-2 bg-white/[0.03] rounded-xl border border-white/[0.06] p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium text-white/80">Savings Trend</h3>
          <p className="text-[11px] text-white/30 mt-0.5">Monthly procurement savings over time</p>
        </div>
        <span className="text-[10px] font-mono text-emerald-400/60 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">+18% MoM</span>
      </div>
      <div style={{ width: '100%', height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={monthlySavings}>
            <defs>
              <linearGradient id="savingsGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="month" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} tickLine={false} />
            <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
            <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px', color: 'white' }} formatter={(value) => [`$${Number(value).toLocaleString()}`, 'Savings']} />
            <Area type="monotone" dataKey="savings" stroke="#10b981" strokeWidth={2} fill="url(#savingsGrad)" animationDuration={1500} animationEasing="ease-out" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function VendorChart() {
  return (
    <div className="bg-white/[0.03] rounded-xl border border-white/[0.06] p-5">
      <div className="mb-4">
        <h3 className="text-sm font-medium text-white/80">Vendor Distribution</h3>
        <p className="text-[11px] text-white/30 mt-0.5">Current spend by vendor</p>
      </div>
      <div style={{ width: '100%', height: 160 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={vendorSpend} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value" animationDuration={1200} animationEasing="ease-out">
              {vendorSpend.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
              ))}
            </Pie>
            <Tooltip formatter={(value) => `${value}%`} contentStyle={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px', color: 'white' }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-2 gap-1.5 mt-2">
        {vendorSpend.map((v, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: v.color }}></span>
            <span className="text-[10px] text-white/40 truncate">{v.name}</span>
            <span className="text-[10px] font-mono text-white/60 ml-auto">{v.value}%</span>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-white/[0.06]">
        <p className="text-[10px] text-amber-400/70">⚠ 68% McMaster → shift fasteners to Grainger for ~$4.2K/qtr savings</p>
      </div>
    </div>
  );
}
