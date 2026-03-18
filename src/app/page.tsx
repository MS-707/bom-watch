import { AlertTriangle, TrendingDown, Package, DollarSign, Clock, ArrowRight, ExternalLink, CheckCircle2, XCircle } from 'lucide-react';

// Mock data - replace with real Arena API data during hackathon
const recentBOMs = [
  {
    id: 'BOM-2847',
    name: 'Gripper Assembly v3.2',
    engineer: 'Sarah Chen',
    approvedAt: '2 hours ago',
    status: 'analyzed',
    newParts: 5,
    totalSavings: 342.50,
    items: [
      { partNumber: 'MCM-91251A123', description: '18-8 SS Socket Head Cap Screw, M5 x 0.8mm, 20mm', qty: 24, mcmaster: 12.47, grainger: 9.85, digikey: null, mouser: null, bestVendor: 'Grainger', savings: 62.88 },
      { partNumber: 'MCM-5234K57', description: 'Aluminum 6061 Round Bar, 1" Dia x 12"', qty: 4, mcmaster: 28.90, grainger: 22.15, digikey: null, mouser: null, bestVendor: 'Grainger', savings: 27.00 },
      { partNumber: 'DK-1N4148W-FDICT', description: 'Diode Small Signal 100V 0.15A', qty: 50, mcmaster: null, grainger: null, digikey: 0.11, mouser: 0.09, bestVendor: 'Mouser', savings: 1.00 },
      { partNumber: 'MCM-6100K134', description: 'Linear Motion Shaft, 8mm Dia, 200mm', qty: 8, mcmaster: 18.75, grainger: 16.20, digikey: null, mouser: null, bestVendor: 'Grainger', savings: 20.40 },
      { partNumber: 'MCM-57155K371', description: 'Compression Spring, 0.5" OD x 1" L', qty: 16, mcmaster: 8.42, grainger: null, digikey: null, mouser: null, bestVendor: 'McMaster-Carr', savings: 0 },
    ]
  },
  {
    id: 'BOM-2843',
    name: 'Drive Motor Mount Rev B',
    engineer: 'James Park',
    approvedAt: '1 day ago',
    status: 'analyzed',
    newParts: 3,
    totalSavings: 156.20,
    items: [
      { partNumber: 'MCM-94180A351', description: '18-8 SS Flat Washer, M8', qty: 48, mcmaster: 5.63, grainger: 3.89, digikey: null, mouser: null, bestVendor: 'Grainger', savings: 83.52 },
      { partNumber: 'MCM-1346K43', description: 'Shaft Collar, 12mm Bore, 2-Piece', qty: 8, mcmaster: 14.25, grainger: 11.50, digikey: null, mouser: null, bestVendor: 'Grainger', savings: 22.00 },
      { partNumber: 'GRN-6YF81', description: 'Bearing, Ball, 6204-2RS', qty: 4, mcmaster: 24.17, grainger: 18.50, digikey: null, mouser: null, bestVendor: 'Grainger', savings: 22.68 },
    ]
  },
  {
    id: 'BOM-2839',
    name: 'Sensor Array Board v1.4',
    engineer: 'Lisa Wong',
    approvedAt: '3 days ago',
    status: 'ordered',
    newParts: 12,
    totalSavings: 89.40,
    items: []
  }
];

const stats = {
  totalSavingsMonth: 2847.30,
  bomsAnalyzed: 14,
  avgSavingsPerBom: 203.38,
  partsTracked: 847,
  topVendorSavings: 'Grainger',
  avgTimeToNotify: '< 30 sec'
};

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <Package className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">BOM Watch</h1>
                <p className="text-sm text-gray-500">Procurement Intelligence · Powered by Claude AI</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                Arena Connected
              </span>
              <span className="text-sm text-gray-400">Last sync: 2 min ago</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-green-600" />
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Monthly Savings</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">${stats.totalSavingsMonth.toLocaleString()}</p>
            <p className="text-xs text-green-600 mt-1">↑ 18% vs last month</p>
          </div>
          <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <Package className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">BOMs Analyzed</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.bomsAnalyzed}</p>
            <p className="text-xs text-gray-500 mt-1">This month</p>
          </div>
          <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="w-4 h-4 text-orange-600" />
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Avg Savings/BOM</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">${stats.avgSavingsPerBom}</p>
            <p className="text-xs text-gray-500 mt-1">{stats.topVendorSavings} saves most</p>
          </div>
          <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-purple-600" />
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Time to Alert</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.avgTimeToNotify}</p>
            <p className="text-xs text-gray-500 mt-1">After BOM approval</p>
          </div>
        </div>

        {/* Active Alert */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-amber-800">New BOM detected: Gripper Assembly v3.2</p>
            <p className="text-sm text-amber-700 mt-1">5 new OTS parts identified · Estimated savings: <strong>$342.50</strong> across alternative vendors · Engineer: Sarah Chen · Approved 2 hours ago</p>
            <div className="flex gap-2 mt-2">
              <button className="px-3 py-1.5 bg-amber-600 text-white text-xs font-medium rounded-lg hover:bg-amber-700 transition">View Analysis</button>
              <button className="px-3 py-1.5 bg-white text-amber-700 text-xs font-medium rounded-lg border border-amber-300 hover:bg-amber-100 transition">Dismiss</button>
            </div>
          </div>
        </div>

        {/* BOM List */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent BOM Changes</h2>
          <div className="space-y-4">
            {recentBOMs.map((bom) => (
              <div key={bom.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {/* BOM Header */}
                <div className="px-6 py-4 flex items-center justify-between border-b border-gray-100">
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono text-gray-400">{bom.id}</span>
                        <h3 className="font-semibold text-gray-900">{bom.name}</h3>
                      </div>
                      <p className="text-sm text-gray-500">By {bom.engineer} · {bom.approvedAt}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs text-gray-500">{bom.newParts} new parts</p>
                      <p className="text-lg font-bold text-green-600">${bom.totalSavings.toFixed(2)} savings</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      bom.status === 'analyzed' ? 'bg-blue-100 text-blue-700' :
                      bom.status === 'ordered' ? 'bg-green-100 text-green-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {bom.status === 'analyzed' ? '🔍 Analyzed' : bom.status === 'ordered' ? '✅ Ordered' : bom.status}
                    </span>
                  </div>
                </div>

                {/* Price Comparison Table */}
                {bom.items.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-left">
                          <th className="px-6 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Part</th>
                          <th className="px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide text-center">Qty</th>
                          <th className="px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide text-right">McMaster</th>
                          <th className="px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide text-right">Grainger</th>
                          <th className="px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide text-right">DigiKey</th>
                          <th className="px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide text-right">Mouser</th>
                          <th className="px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Best</th>
                          <th className="px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide text-right">Savings</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {bom.items.map((item, i) => {
                          const prices = [item.mcmaster, item.grainger, item.digikey, item.mouser].filter((p): p is number => p !== null && p !== undefined);
                          const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
                          return (
                            <tr key={i} className="hover:bg-gray-50 transition">
                              <td className="px-6 py-3">
                                <p className="font-mono text-xs text-gray-400">{item.partNumber}</p>
                                <p className="text-sm text-gray-700 truncate max-w-xs">{item.description}</p>
                              </td>
                              <td className="px-4 py-3 text-center text-gray-600">{item.qty}</td>
                              <td className={`px-4 py-3 text-right ${item.mcmaster === minPrice ? 'font-bold text-green-600' : item.mcmaster ? 'text-gray-600' : 'text-gray-300'}`}>
                                {item.mcmaster ? `$${item.mcmaster.toFixed(2)}` : '—'}
                              </td>
                              <td className={`px-4 py-3 text-right ${item.grainger === minPrice ? 'font-bold text-green-600' : item.grainger ? 'text-gray-600' : 'text-gray-300'}`}>
                                {item.grainger ? `$${item.grainger.toFixed(2)}` : '—'}
                              </td>
                              <td className={`px-4 py-3 text-right ${item.digikey === minPrice ? 'font-bold text-green-600' : item.digikey ? 'text-gray-600' : 'text-gray-300'}`}>
                                {item.digikey ? `$${item.digikey.toFixed(2)}` : '—'}
                              </td>
                              <td className={`px-4 py-3 text-right ${item.mouser === minPrice ? 'font-bold text-green-600' : item.mouser ? 'text-gray-600' : 'text-gray-300'}`}>
                                {item.mouser ? `$${item.mouser.toFixed(2)}` : '—'}
                              </td>
                              <td className="px-4 py-3">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                  {item.bestVendor}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right font-semibold text-green-600">
                                {item.savings > 0 ? `$${item.savings.toFixed(2)}` : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* How It Works */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">How BOM Watch Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { icon: '🔔', title: 'Detect', desc: 'Arena webhook fires when a new BOM is approved or an ECO is released' },
              { icon: '🧠', title: 'Analyze', desc: 'Claude AI identifies new OTS parts and classifies them by category' },
              { icon: '🔍', title: 'Compare', desc: 'Live pricing fetched from McMaster, Grainger, DigiKey, Mouser & more' },
              { icon: '💰', title: 'Save', desc: 'Slack alert + dashboard with vendor recommendations and total savings' },
            ].map((step, i) => (
              <div key={i} className="text-center p-4">
                <div className="text-3xl mb-2">{step.icon}</div>
                <h3 className="font-semibold text-gray-900 mb-1">{step.title}</h3>
                <p className="text-xs text-gray-500">{step.desc}</p>
                {i < 3 && <ArrowRight className="w-4 h-4 text-gray-300 mx-auto mt-3 hidden md:block" />}
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 mt-8 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs text-gray-400">BOM Watch · Mytra Hackathon 2026 · Powered by Arena PLM + Claude AI + Vercel</p>
        </div>
      </footer>
    </div>
  );
}
