"use client";

import { useState, useMemo, useCallback } from 'react';
import { AlertTriangle, TrendingDown, Package, DollarSign, Clock, ArrowRight, ExternalLink, CheckCircle2, X, ChevronDown, ChevronUp, Bell, BarChart3, Zap, Search, Filter, Copy, Download, ArrowUpRight, Sparkles } from 'lucide-react';
import { SavingsChart, VendorChart } from './charts';

// --- Mock Data ---
const recentBOMs = [
  {
    id: 'BOM-2847', name: 'Gripper Assembly v3.2', engineer: 'Sarah Chen', approvedAt: '2 hours ago', status: 'analyzed', newParts: 5, totalSavings: 342.50,
    items: [
      { partNumber: 'MCM-91251A123', description: '18-8 SS Socket Head Cap Screw, M5 x 0.8mm, 20mm', qty: 24, mcmaster: 12.47, grainger: 9.85, digikey: null, mouser: null, bestVendor: 'Grainger', savings: 62.88 },
      { partNumber: 'MCM-5234K57', description: 'Aluminum 6061 Round Bar, 1" Dia x 12"', qty: 4, mcmaster: 28.90, grainger: 22.15, digikey: null, mouser: null, bestVendor: 'Grainger', savings: 27.00 },
      { partNumber: 'DK-1N4148W-FDICT', description: 'Diode Small Signal 100V 0.15A', qty: 50, mcmaster: null, grainger: null, digikey: 0.11, mouser: 0.09, bestVendor: 'Mouser', savings: 1.00 },
      { partNumber: 'MCM-6100K134', description: 'Linear Motion Shaft, 8mm Dia, 200mm', qty: 8, mcmaster: 18.75, grainger: 16.20, digikey: null, mouser: null, bestVendor: 'Grainger', savings: 20.40 },
      { partNumber: 'MCM-57155K371', description: 'Compression Spring, 0.5" OD x 1" L', qty: 16, mcmaster: 8.42, grainger: null, digikey: null, mouser: null, bestVendor: 'McMaster-Carr', savings: 0 },
    ]
  },
  {
    id: 'BOM-2843', name: 'Drive Motor Mount Rev B', engineer: 'James Park', approvedAt: '1 day ago', status: 'analyzed', newParts: 3, totalSavings: 156.20,
    items: [
      { partNumber: 'MCM-94180A351', description: '18-8 SS Flat Washer, M8', qty: 48, mcmaster: 5.63, grainger: 3.89, digikey: null, mouser: null, bestVendor: 'Grainger', savings: 83.52 },
      { partNumber: 'MCM-1346K43', description: 'Shaft Collar, 12mm Bore, 2-Piece', qty: 8, mcmaster: 14.25, grainger: 11.50, digikey: null, mouser: null, bestVendor: 'Grainger', savings: 22.00 },
      { partNumber: 'GRN-6YF81', description: 'Bearing, Ball, 6204-2RS', qty: 4, mcmaster: 24.17, grainger: 18.50, digikey: null, mouser: null, bestVendor: 'Grainger', savings: 22.68 },
    ]
  },
  {
    id: 'BOM-2839', name: 'Sensor Array Board v1.4', engineer: 'Lisa Wong', approvedAt: '3 days ago', status: 'ordered', newParts: 12, totalSavings: 89.40, items: []
  },
  {
    id: 'BOM-2835', name: 'Chassis Frame v2.1', engineer: 'Mike Torres', approvedAt: '5 days ago', status: 'ordered', newParts: 8, totalSavings: 215.80, items: []
  },
];

const stats = { totalSavingsMonth: 2847.30, bomsAnalyzed: 14, avgSavingsPerBom: 203.38, avgTimeToNotify: '< 30s' };

export default function Dashboard() {
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [expandedBom, setExpandedBom] = useState<string | null>('BOM-2847');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [copiedBom, setCopiedBom] = useState<string | null>(null);

  const filteredBOMs = useMemo(() => {
    return recentBOMs.filter(bom => {
      const matchesSearch = searchQuery === '' || 
        bom.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        bom.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        bom.engineer.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || bom.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [searchQuery, statusFilter]);

  const statusCounts = useMemo(() => ({
    all: recentBOMs.length,
    analyzed: recentBOMs.filter(b => b.status === 'analyzed').length,
    ordered: recentBOMs.filter(b => b.status === 'ordered').length,
  }), []);

  const copyBomData = useCallback((bom: typeof recentBOMs[0]) => {
    const lines = bom.items.map(item => 
      `${item.partNumber}\t${item.description}\t${item.qty}\t${item.mcmaster || '-'}\t${item.grainger || '-'}\t${item.digikey || '-'}\t${item.mouser || '-'}\t${item.bestVendor}\t$${item.savings.toFixed(2)}`
    );
    const header = 'Part Number\tDescription\tQty\tMcMaster\tGrainger\tDigiKey\tMouser\tBest Vendor\tSavings';
    const text = [header, ...lines].join('\n');
    navigator.clipboard.writeText(text);
    setCopiedBom(bom.id);
    setTimeout(() => setCopiedBom(null), 2000);
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="border-b border-white/10 bg-[#0a0a0a]/80 backdrop-blur-md sticky top-0 z-50">
        {/* Accent gradient line */}
        <div className="h-[2px] bg-gradient-to-r from-emerald-500/80 via-blue-500/60 to-purple-500/40" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <Package className="w-4 h-4 text-white/60" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-medium text-white tracking-tight">BOM Watch</h1>
                <p className="text-[10px] sm:text-[11px] text-white/40 font-mono tracking-widest">PROCUREMENT INTELLIGENCE</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <a href="https://app.bom.arena.com" target="_blank" rel="noopener" className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-all duration-200 font-mono">
                Arena PLM <ArrowUpRight className="w-3 h-3" />
              </a>
              <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                <span className="text-[10px] sm:text-[11px] font-medium text-emerald-400 font-mono hidden sm:inline">ARENA CONNECTED</span>
                <span className="text-[10px] font-medium text-emerald-400 font-mono sm:hidden">LIVE</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { icon: DollarSign, label: 'Monthly Savings', value: `$${stats.totalSavingsMonth.toLocaleString()}`, sub: '↑ 18% vs last month', subColor: 'text-emerald-400/70', accent: true },
            { icon: Package, label: 'BOMs Analyzed', value: stats.bomsAnalyzed.toString(), sub: 'This month', subColor: 'text-white/30', accent: false },
            { icon: TrendingDown, label: 'Avg Savings / BOM', value: `$${stats.avgSavingsPerBom}`, sub: 'Grainger saves most', subColor: 'text-white/30', accent: false },
            { icon: Zap, label: 'Detection Speed', value: stats.avgTimeToNotify, sub: 'After BOM approval', subColor: 'text-white/30', accent: false },
          ].map((stat, i) => (
            <div key={i} className={`rounded-xl p-4 border transition-all duration-300 cursor-default hover:scale-[1.02] ${stat.accent ? 'bg-emerald-500/[0.04] border-emerald-500/15 hover:border-emerald-500/25 hover:bg-emerald-500/[0.07]' : 'bg-white/[0.03] border-white/[0.06] hover:border-white/10 hover:bg-white/[0.05]'}`}>
              <div className="flex items-center gap-2 mb-2">
                <stat.icon className={`w-3.5 h-3.5 ${stat.accent ? 'text-emerald-400' : 'text-white/30'}`} />
                <span className="text-[10px] font-mono text-white/40 uppercase tracking-wider">{stat.label}</span>
              </div>
              <p className={`text-2xl font-light tracking-tight ${stat.accent ? 'text-emerald-400' : 'text-white'}`}>{stat.value}</p>
              <p className={`text-[11px] mt-1 ${stat.subColor}`}>{stat.sub}</p>
            </div>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          <SavingsChart />
          <VendorChart />
        </div>

        {/* Alert Banner */}
        {!alertDismissed && (
          <div className="bg-amber-500/[0.08] border border-amber-500/20 rounded-xl p-4 mb-6 flex items-start gap-3 animate-in">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Bell className="w-4 h-4 text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-mono text-amber-400/70 uppercase tracking-wider">New BOM Detected</span>
                <span className="text-[10px] text-white/30">2 hours ago</span>
              </div>
              <p className="font-medium text-white">Gripper Assembly v3.2</p>
              <p className="text-sm text-white/50 mt-0.5">5 new OTS parts · Estimated savings: <span className="text-emerald-400 font-medium">$342.50</span> · Engineer: Sarah Chen</p>
              <div className="flex gap-2 mt-3">
                <button onClick={() => { setExpandedBom('BOM-2847'); setAlertDismissed(true); }} className="px-3 py-1.5 bg-amber-500/20 text-amber-300 text-xs font-medium rounded-lg hover:bg-amber-500/30 transition-colors border border-amber-500/20">
                  View Analysis
                </button>
                <button onClick={() => setAlertDismissed(true)} className="px-3 py-1.5 text-white/40 text-xs font-medium rounded-lg hover:text-white/60 hover:bg-white/5 transition-colors">
                  Dismiss
                </button>
              </div>
            </div>
            <button onClick={() => setAlertDismissed(true)} className="text-white/20 hover:text-white/40 transition-colors p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* BOM List */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-medium text-white/80">Recent BOM Changes</h2>
              <span className="text-[10px] font-mono text-white/20 bg-white/[0.04] px-2 py-0.5 rounded-full">{recentBOMs.length} total</span>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-white/30 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search BOMs, engineers..." 
                  className="bg-white/[0.03] border border-white/[0.06] rounded-lg pl-8 pr-3 py-2 sm:py-1.5 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-500/30 focus:bg-white/[0.05] focus:ring-1 focus:ring-emerald-500/20 w-full sm:w-56 transition-all duration-200" 
                />
              </div>
              <div className="flex gap-1">
                {(['all', 'analyzed', 'ordered'] as const).map(s => (
                  <button key={s} onClick={() => setStatusFilter(s)} className={`flex-1 sm:flex-none px-2.5 py-2 sm:py-1.5 text-[10px] font-mono rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5 ${statusFilter === s ? 'bg-white/10 text-white border border-white/20' : 'text-white/30 hover:text-white/50 hover:bg-white/[0.03] border border-transparent'}`}>
                    {s === 'all' ? 'ALL' : s.toUpperCase()}
                    <span className={`text-[9px] px-1.5 py-px rounded-full ${statusFilter === s ? 'bg-white/15 text-white/70' : 'bg-white/[0.05] text-white/20'}`}>
                      {statusCounts[s]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {filteredBOMs.length === 0 && (
            <div className="text-center py-16 text-white/30">
              <Search className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium text-white/40">No BOMs match your search</p>
              <p className="text-xs text-white/20 mt-1">Try a different keyword or clear filters</p>
            </div>
          )}

          <div className="space-y-3">
            {filteredBOMs.map((bom) => (
              <div key={bom.id} className="bg-white/[0.02] rounded-xl border border-white/[0.06] overflow-hidden hover:border-white/10 transition-all duration-300 group/card">
                <button onClick={() => setExpandedBom(expandedBom === bom.id ? null : bom.id)} className="w-full px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 cursor-pointer hover:bg-white/[0.02] transition-colors duration-200">
                  <div className="flex items-start sm:items-center gap-4 text-left min-w-0">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <span className="text-[11px] font-mono text-white/30">{bom.id}</span>
                        <h3 className="font-medium text-white text-sm truncate">{bom.name}</h3>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium whitespace-nowrap ${bom.status === 'analyzed' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                          {bom.status.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs text-white/30 mt-0.5">{bom.engineer} · {bom.approvedAt} · {bom.newParts} new parts</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-4 pl-0 sm:pl-4">
                    <div className="text-left sm:text-right">
                      <p className="text-lg font-light text-emerald-400">${bom.totalSavings.toFixed(2)}</p>
                      <p className="text-[10px] text-white/30 font-mono">SAVINGS</p>
                    </div>
                    <div className={`transition-transform duration-300 ${expandedBom === bom.id ? 'rotate-180' : ''}`}>
                      <ChevronDown className="w-4 h-4 text-white/20 group-hover/card:text-white/40 transition-colors" />
                    </div>
                  </div>
                </button>

                {/* Expanded Price Table */}
                {expandedBom === bom.id && bom.items.length > 0 && (
                  <div className="border-t border-white/[0.06] animate-in">
                    {/* Action bar */}
                    <div className="px-4 sm:px-5 py-2.5 flex items-center justify-between border-b border-white/[0.04] bg-white/[0.01]">
                      <div className="sm:hidden flex items-center gap-1.5 text-[10px] text-white/20">
                        <ArrowRight className="w-3 h-3" />
                        <span>Scroll for full table</span>
                      </div>
                      <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-white/20">
                        <Sparkles className="w-3 h-3" />
                        <span>AI-analyzed price comparison</span>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); copyBomData(bom); }}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono text-white/30 hover:text-white/60 hover:bg-white/[0.05] transition-all duration-200"
                      >
                        {copiedBom === bom.id ? (
                          <><CheckCircle2 className="w-3 h-3 text-emerald-400" /><span className="text-emerald-400">Copied!</span></>
                        ) : (
                          <><Copy className="w-3 h-3" /><span>Copy to clipboard</span></>
                        )}
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-white/[0.06]">
                            <th className="px-5 py-2.5 text-left text-[10px] font-mono text-white/30 uppercase tracking-wider">Part</th>
                            <th className="px-3 py-2.5 text-center text-[10px] font-mono text-white/30 uppercase tracking-wider">Qty</th>
                            <th className="px-3 py-2.5 text-right text-[10px] font-mono text-white/30 uppercase tracking-wider">McMaster</th>
                            <th className="px-3 py-2.5 text-right text-[10px] font-mono text-white/30 uppercase tracking-wider">Grainger</th>
                            <th className="px-3 py-2.5 text-right text-[10px] font-mono text-white/30 uppercase tracking-wider">DigiKey</th>
                            <th className="px-3 py-2.5 text-right text-[10px] font-mono text-white/30 uppercase tracking-wider">Mouser</th>
                            <th className="px-3 py-2.5 text-left text-[10px] font-mono text-white/30 uppercase tracking-wider">Best</th>
                            <th className="px-3 py-2.5 text-right text-[10px] font-mono text-white/30 uppercase tracking-wider">Saved</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bom.items.map((item, i) => {
                            const prices = [item.mcmaster, item.grainger, item.digikey, item.mouser].filter((p): p is number => p !== null && p !== undefined);
                            const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
                            const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
                            const PriceCell = ({ val }: { val: number | null }) => (
                              <td className={`px-3 py-3 text-right text-xs font-mono ${val === minPrice && prices.length > 1 ? 'text-emerald-400 font-medium bg-emerald-500/[0.06]' : val === maxPrice && val !== minPrice ? 'text-red-400/50' : val ? 'text-white/40' : 'text-white/10'}`}>
                                {val ? `$${val.toFixed(2)}` : '—'}
                              </td>
                            );
                            return (
                              <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors duration-150">
                                <td className="px-5 py-3">
                                  <p className="font-mono text-[11px] text-white/30">{item.partNumber}</p>
                                  <p className="text-xs text-white/60 truncate max-w-[280px]">{item.description}</p>
                                </td>
                                <td className="px-3 py-3 text-center text-xs text-white/40 font-mono">{item.qty}</td>
                                <PriceCell val={item.mcmaster} />
                                <PriceCell val={item.grainger} />
                                <PriceCell val={item.digikey} />
                                <PriceCell val={item.mouser} />
                                <td className="px-3 py-3">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    {item.bestVendor}
                                  </span>
                                </td>
                                <td className="px-3 py-3 text-right text-xs font-mono font-medium text-emerald-400">
                                  {item.savings > 0 ? `$${item.savings.toFixed(2)}` : '—'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-white/[0.06]">
                            <td colSpan={7} className="px-5 py-3 text-right text-xs text-white/40 font-mono">TOTAL SAVINGS</td>
                            <td className="px-3 py-3 text-right text-sm font-mono font-bold text-emerald-400">${bom.totalSavings.toFixed(2)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    
                    {/* AI Summary */}
                    <div className="px-5 py-4 bg-white/[0.02] border-t border-white/[0.04]">
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center flex-shrink-0 mt-0.5 border border-blue-500/10">
                          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                        </div>
                        <div>
                          <p className="text-[10px] font-mono text-blue-400/70 uppercase tracking-wider mb-1">Claude AI Analysis</p>
                          <p className="text-xs text-white/50 leading-relaxed">
                            This BOM introduces {bom.items.length} new OTS parts. {bom.items.filter(i => i.bestVendor === 'Grainger').length} have cheaper alternatives on Grainger (avg 21% savings on fasteners and raw materials). 
                            <span className="text-white/70"> Recommend consolidating Grainger items into a single order for free shipping threshold ($50+).</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {expandedBom === bom.id && bom.items.length === 0 && (
                  <div className="border-t border-white/[0.06] px-5 py-8 text-center animate-in">
                    <CheckCircle2 className="w-10 h-10 text-emerald-400/20 mx-auto mb-3" />
                    <p className="text-sm font-medium text-white/50">Order placed — analysis complete</p>
                    <p className="text-xs text-white/25 mt-1.5 max-w-sm mx-auto">
                      Saved <span className="text-emerald-400/60 font-medium">${bom.totalSavings.toFixed(2)}</span> across {bom.newParts} parts by switching vendors based on BOM Watch recommendations.
                    </p>
                    <div className="flex items-center justify-center gap-4 mt-4">
                      <span className="text-[10px] font-mono text-white/15 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Ordered {bom.approvedAt}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* How It Works */}
        <div className="bg-white/[0.02] rounded-xl border border-white/[0.06] p-5 sm:p-6 mb-6">
          <div className="flex items-center gap-2 mb-5">
            <h2 className="text-sm font-medium text-white/80">How BOM Watch Works</h2>
            <span className="text-[9px] font-mono text-white/15 bg-white/[0.03] px-2 py-0.5 rounded-full">4 STEPS</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {[
              { icon: Bell, title: 'Detect', desc: 'Arena webhook fires when a new BOM is approved or ECO released', color: '#f59e0b', step: '01' },
              { icon: BarChart3, title: 'Analyze', desc: 'Claude AI identifies new OTS parts and classifies by category', color: '#3b82f6', step: '02' },
              { icon: Search, title: 'Compare', desc: 'Live pricing fetched from McMaster, Grainger, DigiKey, Mouser & more', color: '#a855f7', step: '03' },
              { icon: DollarSign, title: 'Save', desc: 'Slack alert + dashboard with vendor recommendations and savings', color: '#10b981', step: '04' },
            ].map((step, i) => (
              <div key={i} className="relative group p-3 -m-3 rounded-xl hover:bg-white/[0.03] transition-all duration-300">
                <span className="text-[10px] font-mono text-white/10 mb-2 block">{step.step}</span>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300" style={{ background: `${step.color}15`, border: `1px solid ${step.color}30` }}>
                  <step.icon className="w-5 h-5" style={{ color: step.color }} />
                </div>
                <h3 className="font-medium text-white text-sm mb-1">{step.title}</h3>
                <p className="text-xs text-white/40 leading-relaxed">{step.desc}</p>
                {i < 3 && <ArrowRight className="w-4 h-4 text-white/10 absolute -right-5 top-12 hidden md:block" />}
              </div>
            ))}
          </div>
        </div>

        {/* Footer bar */}
        <div className="bg-white/[0.02] rounded-xl border border-white/[0.06] p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
          <div className="flex items-start sm:items-center gap-3 flex-1">
            <Zap className="w-4 h-4 text-emerald-400/30 flex-shrink-0 mt-0.5 sm:mt-0" />
            <p className="text-xs text-white/40 flex-1">
              <span className="text-white/60 font-medium">Integration ready.</span> Connect Arena PLM webhook, Slack notifications, and vendor APIs. Built on Next.js + Vercel + Claude AI.
            </p>
          </div>
          <span className="text-[10px] font-mono text-emerald-400/30 bg-emerald-500/[0.06] px-2 py-0.5 rounded-full border border-emerald-500/10 self-end sm:self-auto">v0.3.0</span>
        </div>
      </main>

      <footer className="border-t border-white/[0.04] mt-8 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-1">
          <p className="text-[10px] sm:text-[11px] text-white/20 font-mono">BOM WATCH · MYTRA HACKATHON 2026</p>
          <p className="text-[10px] sm:text-[11px] text-white/20">Powered by Arena PLM + Claude AI + Vercel</p>
        </div>
      </footer>
    </div>
  );
}
