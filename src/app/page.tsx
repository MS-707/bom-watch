"use client";

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { AlertTriangle, TrendingDown, Package, DollarSign, Clock, ArrowRight, ExternalLink, CheckCircle2, X, ChevronDown, Bell, BarChart3, Zap, Search, Copy, Download, ArrowUpRight, Sparkles, RefreshCw, Loader2, Plus, ShoppingCart, ClipboardList, HelpCircle } from 'lucide-react';
import { SavingsChart, VendorChart } from './charts';
import { ManualBomDrawer } from './manual-bom';
import { OnboardingOverlay } from './onboarding-overlay';
import { DataToggle, type DataSource } from './data-toggle';

// --- Types ---
interface VendorDetail {
  inStock: boolean;
  stockQty: number | null;
  url: string;
  leadTimeDays: number | null;
}

interface MarketIntel {
  bestPrice: number | null;
  bestSource: string | null;
  sourceUrl: string | null;
  allFindings: Array<{ distributor: string; price: number; url: string }>;
}

interface ClaudeIntel {
  bestPrice: number | null;
  bestSource: string | null;
  sourceUrl: string | null;
  insight: string;
  alternatives: Array<{ distributor: string; price: number; url: string; note?: string }>;
}

type PriceSource = 'api' | 'estimated' | 'ai' | null;

interface BomItem {
  partNumber: string;
  description: string;
  qty: number;
  mcmaster: number | null;
  grainger: number | null;
  digikey: number | null;
  mouser: number | null;
  vendorSources?: {
    mcmaster: PriceSource;
    grainger: PriceSource;
    digikey: PriceSource;
    mouser: PriceSource;
  };
  bestVendor: string;
  savings: number;
  details?: { [vendor: string]: VendorDetail };
  marketIntel?: MarketIntel;
  claudeIntel?: ClaudeIntel;
}

interface Bom {
  id: string;
  name: string;
  engineer: string;
  approvedAt: string;
  status: string;
  newParts: number;
  totalSavings: number;
  items: BomItem[];
}

interface Stats {
  totalSavingsMonth: number;
  bomsAnalyzed: number;
  avgSavingsPerBom: number;
  avgTimeToNotify: string;
}

// --- Fallback Mock Data — showcases McMaster API + OEMSecrets distributor pricing ---
const fallbackBOMs: Bom[] = [
  {
    id: 'BOM-3001', name: 'Z-Drive Fastener Kit — ECO-00005', engineer: 'Rebecca', approvedAt: '2 hours ago', status: 'analyzed', newParts: 6, totalSavings: 1088.34,
    items: [
      { partNumber: '91263A828', description: 'Zinc-Plated Alloy Steel Hex Drive Flat Head Screw — M4 x 0.7mm, 10mm', qty: 110, mcmaster: 8.31, grainger: 6.83, digikey: null, mouser: null, vendorSources: { mcmaster: 'api', grainger: 'estimated', digikey: null, mouser: null }, bestVendor: 'Grainger', savings: 162.80, details: { mcmaster: { inStock: true, stockQty: null, url: 'https://www.mcmaster.com/91263A828', leadTimeDays: 1 }, grainger: { inStock: true, stockQty: 441, url: 'https://www.grainger.com/search?searchQuery=91263A828', leadTimeDays: 3 } } },
      { partNumber: '90128A264', description: 'Zinc-Plated Alloy Steel Socket Head Screw — M6 x 1mm, 20mm Long', qty: 220, mcmaster: 15.27, grainger: 12.41, digikey: null, mouser: null, vendorSources: { mcmaster: 'api', grainger: 'estimated', digikey: null, mouser: null }, bestVendor: 'Grainger', savings: 629.20, details: { mcmaster: { inStock: true, stockQty: null, url: 'https://www.mcmaster.com/90128A264', leadTimeDays: 1 }, grainger: { inStock: true, stockQty: 318, url: 'https://www.grainger.com/search?searchQuery=90128A264', leadTimeDays: 3 } } },
      { partNumber: '94361A527', description: 'Short-Thread Alloy Steel Shoulder Screw — 6mm Dia, 30mm, M5 Thread', qty: 22, mcmaster: 7.40, grainger: 6.21, digikey: null, mouser: null, vendorSources: { mcmaster: 'api', grainger: 'estimated', digikey: null, mouser: null }, bestVendor: 'Grainger', savings: 26.18, details: { mcmaster: { inStock: true, stockQty: null, url: 'https://www.mcmaster.com/94361A527', leadTimeDays: 1 } } },
      { partNumber: '90576A817', description: 'Medium-Strength Steel Nylon-Insert Locknut — Zinc-Plated, M12 x 1.75mm', qty: 22, mcmaster: 11.23, grainger: 9.52, digikey: null, mouser: null, vendorSources: { mcmaster: 'api', grainger: 'estimated', digikey: null, mouser: null }, bestVendor: 'Grainger', savings: 37.62, details: { mcmaster: { inStock: true, stockQty: null, url: 'https://www.mcmaster.com/90576A817', leadTimeDays: 1 } } },
      { partNumber: '90154A478', description: 'External Retaining Ring — 20mm Shaft, Zinc-Chromate-Plated Spring Steel', qty: 66, mcmaster: 14.77, grainger: 12.42, digikey: null, mouser: null, vendorSources: { mcmaster: 'api', grainger: 'estimated', digikey: null, mouser: null }, bestVendor: 'Grainger', savings: 155.10, details: { mcmaster: { inStock: true, stockQty: null, url: 'https://www.mcmaster.com/90154A478', leadTimeDays: 1 } } },
      { partNumber: '1804N174', description: 'Blue Die Spring — 25mm Hole Diameter, 25mm Long, Medium Duty', qty: 44, mcmaster: 8.56, grainger: 7.06, digikey: null, mouser: null, vendorSources: { mcmaster: 'api', grainger: 'estimated', digikey: null, mouser: null }, bestVendor: 'Grainger', savings: 66.00, details: { mcmaster: { inStock: true, stockQty: null, url: 'https://www.mcmaster.com/1804N174', leadTimeDays: 1 } } },
    ]
  },
  {
    id: 'BOM-3002', name: 'Motor Controller Board v2 — ECO-00012', engineer: 'James Park', approvedAt: '6 hours ago', status: 'analyzed', newParts: 5, totalSavings: 48.50,
    items: [
      { partNumber: 'STM32F407VGT6', description: 'MCU 32-Bit ARM Cortex-M4F 168MHz 1MB Flash LQFP-100', qty: 10, mcmaster: null, grainger: null, digikey: 12.50, mouser: 11.80, vendorSources: { mcmaster: null, grainger: null, digikey: 'api', mouser: 'api' }, bestVendor: 'Mouser', savings: 7.00, details: { digikey: { inStock: true, stockQty: 2428, url: 'https://www.digikey.com/en/products/detail/stmicroelectronics/STM32F407VGT6/2747885', leadTimeDays: 2 }, mouser: { inStock: true, stockQty: 19, url: 'https://www.mouser.com/ProductDetail/STMicroelectronics/STM32F407VGT6', leadTimeDays: 2 } }, claudeIntel: { bestPrice: 1.25, bestSource: 'Verified Electronics', sourceUrl: null, insight: 'AI web search: Found at 27 distributors, 63 with stock. Best: $1.25 at Verified Electronics.', alternatives: [{ distributor: 'Weyland Electronics', price: 1.42, url: '', note: '8,968 in stock' }, { distributor: 'Origin Data Global', price: 1.55, url: '', note: '53,760 in stock' }] } },
      { partNumber: 'LM2596S-ADJ', description: 'Buck Converter IC, Adjustable 1.2-37V 3A TO-263-5', qty: 20, mcmaster: null, grainger: null, digikey: 3.25, mouser: 2.98, vendorSources: { mcmaster: null, grainger: null, digikey: 'api', mouser: 'api' }, bestVendor: 'Mouser', savings: 5.40, details: { digikey: { inStock: true, stockQty: 5200, url: 'https://www.digikey.com/en/products/detail/texas-instruments/LM2596S-ADJ-NOPB/363711', leadTimeDays: 2 }, mouser: { inStock: true, stockQty: 3100, url: 'https://www.mouser.com/ProductDetail/Texas-Instruments/LM2596S-ADJ-NOPB', leadTimeDays: 2 } } },
      { partNumber: 'TLP281-4', description: 'Optocoupler Phototransistor Output 4-Channel 16-DIP', qty: 30, mcmaster: null, grainger: null, digikey: 2.45, mouser: 2.30, vendorSources: { mcmaster: null, grainger: null, digikey: 'api', mouser: 'api' }, bestVendor: 'Mouser', savings: 4.50, details: { digikey: { inStock: true, stockQty: 8900, url: 'https://www.digikey.com/en/products/detail/toshiba-semiconductor/TLP281-4/4308186', leadTimeDays: 2 }, mouser: { inStock: true, stockQty: 6200, url: 'https://www.mouser.com/ProductDetail/Toshiba/TLP281-4', leadTimeDays: 2 } } },
      { partNumber: 'IRLZ44NPBF', description: 'N-Channel MOSFET 55V 47A TO-220AB', qty: 40, mcmaster: null, grainger: null, digikey: 1.85, mouser: 1.72, vendorSources: { mcmaster: null, grainger: null, digikey: 'api', mouser: 'api' }, bestVendor: 'Mouser', savings: 5.20, details: { digikey: { inStock: true, stockQty: 12000, url: 'https://www.digikey.com/en/products/detail/infineon-technologies/IRLZ44NPBF/811795', leadTimeDays: 2 }, mouser: { inStock: true, stockQty: 8500, url: 'https://www.mouser.com/ProductDetail/Infineon-Technologies/IRLZ44NPBF', leadTimeDays: 2 } } },
      { partNumber: 'MCP2551-I/SN', description: 'CAN Bus Transceiver 1Mbps 8-SOIC', qty: 15, mcmaster: null, grainger: null, digikey: 1.95, mouser: 1.78, vendorSources: { mcmaster: null, grainger: null, digikey: 'api', mouser: 'api' }, bestVendor: 'Mouser', savings: 2.55, details: { digikey: { inStock: true, stockQty: 15000, url: 'https://www.digikey.com/en/products/detail/microchip-technology/MCP2551-I-SN/680765', leadTimeDays: 2 }, mouser: { inStock: true, stockQty: 9800, url: 'https://www.mouser.com/ProductDetail/Microchip-Technology/MCP2551-I-SN', leadTimeDays: 2 } } },
    ]
  },
];

const fallbackStats: Stats = { totalSavingsMonth: 1136.84, bomsAnalyzed: 2, avgSavingsPerBom: 568.42, avgTimeToNotify: '2' };

export default function Dashboard() {
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [expandedBom, setExpandedBom] = useState<string | null>('BOM-3001');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [copiedBom, setCopiedBom] = useState<string | null>(null);
  const [boms, setBoms] = useState<Bom[]>(fallbackBOMs);
  const [stats, setStats] = useState<Stats>(fallbackStats);
  const [isLoading, setIsLoading] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [manualBomOpen, setManualBomOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<DataSource>('demo');
  const [manualBomCounter, setManualBomCounter] = useState(0);
  const [expandedPart, setExpandedPart] = useState<string | null>(null);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [liveApiCount, setLiveApiCount] = useState(0);
  const [liveApiNames, setLiveApiNames] = useState<string[]>([]);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [decisions, setDecisions] = useState<Record<string, 'accepted' | 'skipped' | null>>(() => {
    if (typeof window !== 'undefined') {
      try { return JSON.parse(localStorage.getItem('bom-watch-decisions') || '{}'); } catch { return {}; }
    }
    return {};
  });

  // --- Decision toggle for per-part accept/skip ---
  const toggleDecision = useCallback((key: string, value: 'accepted' | 'skipped') => {
    setDecisions(prev => ({
      ...prev,
      [key]: prev[key] === value ? null : value,
    }));
  }, []);

  // --- Persist decisions to localStorage ---
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('bom-watch-decisions', JSON.stringify(decisions));
    }
  }, [decisions]);

  // --- Change 5: Compute stats from actual BOMs ---
  const computedStats = useMemo(() => {
    const analyzedBoms = boms.filter(b => b.status === 'analyzed' || b.status === 'manual');
    const totalSavings = boms.reduce((sum, b) => sum + b.totalSavings, 0);
    const analyzedCount = analyzedBoms.length;
    const avgSavings = analyzedCount > 0 ? totalSavings / analyzedCount : 0;

    return {
      totalSavingsMonth: totalSavings,
      bomsAnalyzed: analyzedCount,
      avgSavingsPerBom: avgSavings,
      avgTimeToNotify: String(liveApiCount || '—'),
    };
  }, [boms, liveApiCount]);

  // --- Change 2: Vendor-grouped export ---
  const exportByVendor = useCallback((bom: Bom) => {
    // Only include accepted parts (filter out skipped); if no decisions made, include all
    const hasAnyDecision = bom.items.some(item => decisions[`${bom.id}-${item.partNumber}`] != null);
    const eligibleItems = hasAnyDecision
      ? bom.items.filter(item => decisions[`${bom.id}-${item.partNumber}`] === 'accepted')
      : bom.items;
    // Group items by bestVendor
    const groups: Record<string, BomItem[]> = {};
    for (const item of eligibleItems) {
      const vendor = item.bestVendor;
      if (!groups[vendor]) groups[vendor] = [];
      groups[vendor].push(item);
    }

    const vendorKey = (vendor: string): 'mcmaster' | 'grainger' | 'digikey' | 'mouser' => {
      const map: Record<string, 'mcmaster' | 'grainger' | 'digikey' | 'mouser'> = {
        'McMaster-Carr': 'mcmaster', 'Grainger': 'grainger', 'DigiKey': 'digikey', 'Mouser': 'mouser',
      };
      return map[vendor] || 'mcmaster';
    };

    let output = `VENDOR-GROUPED ORDER — ${bom.name} (${bom.id})\n${'='.repeat(60)}\n\n`;

    for (const [vendor, items] of Object.entries(groups)) {
      output += `▸ ${vendor}\n${'-'.repeat(40)}\n`;
      let subtotal = 0;
      for (const item of items) {
        const key = vendorKey(vendor);
        const unitPrice = item[key] ?? 0;
        const lineTotal = unitPrice * item.qty;
        subtotal += lineTotal;
        output += `  ${item.partNumber}  ${item.description}\n`;
        output += `    Qty: ${item.qty}  ×  $${unitPrice.toFixed(2)}  =  $${lineTotal.toFixed(2)}\n`;
        const detail = item.details?.[key];
        if (detail?.url) {
          output += `    URL: ${detail.url}\n`;
        }
      }
      output += `  ${'─'.repeat(30)}\n`;
      output += `  Subtotal: $${subtotal.toFixed(2)}\n\n`;
    }

    output += `${'='.repeat(60)}\nTOTAL SAVINGS: $${bom.totalSavings.toFixed(2)}\n`;

    navigator.clipboard.writeText(output);
    setToastMessage('Vendor-grouped order copied!');
    setTimeout(() => setToastMessage(null), 2500);
  }, [decisions]);

  // --- Vendor-grouped CSV file download ---
  const downloadVendorCSV = useCallback((bom: Bom) => {
    // Only include accepted parts (filter out skipped); if no decisions made, include all
    const hasAnyDecision = bom.items.some(item => decisions[`${bom.id}-${item.partNumber}`] != null);
    const eligibleItems = hasAnyDecision
      ? bom.items.filter(item => decisions[`${bom.id}-${item.partNumber}`] === 'accepted')
      : bom.items;
    const groups: Record<string, BomItem[]> = {};
    for (const item of eligibleItems) {
      const vendor = item.bestVendor;
      if (!groups[vendor]) groups[vendor] = [];
      groups[vendor].push(item);
    }

    const vendorKey = (vendor: string): 'mcmaster' | 'grainger' | 'digikey' | 'mouser' => {
      const map: Record<string, 'mcmaster' | 'grainger' | 'digikey' | 'mouser'> = {
        'McMaster-Carr': 'mcmaster', 'Grainger': 'grainger', 'DigiKey': 'digikey', 'Mouser': 'mouser',
      };
      return map[vendor] || 'mcmaster';
    };

    const escapeCSV = (val: string) => {
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };

    const headers = ['Vendor', 'Part Number', 'Description', 'Qty', 'Unit Price', 'Line Total', 'Product URL'];
    const rows: string[] = [headers.join(',')];

    for (const [vendor, items] of Object.entries(groups)) {
      rows.push(`"--- ${vendor} ---","","","","","",""`);
      for (const item of items) {
        const key = vendorKey(vendor);
        const unitPrice = item[key] ?? 0;
        const lineTotal = unitPrice * item.qty;
        const detail = item.details?.[key];
        const url = detail?.url || '';
        rows.push([
          escapeCSV(vendor),
          escapeCSV(item.partNumber),
          escapeCSV(item.description),
          String(item.qty),
          unitPrice.toFixed(2),
          lineTotal.toFixed(2),
          escapeCSV(url),
        ].join(','));
      }
    }

    const csv = rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${bom.id}-vendor-orders.csv`;
    a.click();
    URL.revokeObjectURL(url);

    setToastMessage('Vendor CSV downloaded!');
    setTimeout(() => setToastMessage(null), 2500);
  }, [decisions]);

  // --- Change 1 (part): Copy recommendations ---
  const copyRecommendations = useCallback((bom: Bom) => {
    // Only include accepted parts (filter out skipped); if no decisions made, include all
    const hasAnyDecision = bom.items.some(item => decisions[`${bom.id}-${item.partNumber}`] != null);
    const eligibleItems = hasAnyDecision
      ? bom.items.filter(item => decisions[`${bom.id}-${item.partNumber}`] === 'accepted')
      : bom.items;
    const switchItems = eligibleItems.filter(i => i.bestVendor !== 'McMaster-Carr' && i.savings > 0);
    const stayItems = eligibleItems.filter(i => i.bestVendor === 'McMaster-Carr' || i.savings === 0);

    let output = `RECOMMENDATIONS — ${bom.name} (${bom.id})\n${'='.repeat(50)}\n\n`;

    if (switchItems.length > 0) {
      output += `SWITCH VENDORS (${switchItems.length} parts):\n`;
      for (const item of switchItems) {
        output += `  • ${item.partNumber} → ${item.bestVendor} (save $${item.savings.toFixed(2)})\n`;
      }
      output += '\n';
    }

    if (stayItems.length > 0) {
      output += `KEEP CURRENT (${stayItems.length} parts):\n`;
      for (const item of stayItems) {
        output += `  • ${item.partNumber} — ${item.bestVendor}\n`;
      }
      output += '\n';
    }

    output += `Total Savings: $${bom.totalSavings.toFixed(2)}\n`;

    navigator.clipboard.writeText(output);
    setToastMessage('Recommendations copied!');
    setTimeout(() => setToastMessage(null), 2500);
  }, [decisions]);

  // Fetch from API — falls back to mock data if API returns mock flag
  const fetchBoms = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/boms');
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      if (data.boms && data.boms.length > 0) {
        // Preserve manually added BOMs during refresh
        setBoms(prev => {
          const manualBoms = prev.filter(b => b.status === 'manual');
          const apiBoms = data.boms.filter((b: Bom) => b.status !== 'manual');
          return [...manualBoms, ...apiBoms];
        });
        setStats({
          totalSavingsMonth: data.stats?.totalSavingsMonth ?? fallbackStats.totalSavingsMonth,
          bomsAnalyzed: data.stats?.bomsAnalyzed ?? fallbackStats.bomsAnalyzed,
          avgSavingsPerBom: data.stats?.avgSavingsPerBom ?? fallbackStats.avgSavingsPerBom,
          avgTimeToNotify: String(data.liveApis ?? '—'),
        });
        setIsLive(!!data.live);
        if (data.liveApis) setLiveApiCount(data.liveApis);
        if (data.liveApiNames) setLiveApiNames(data.liveApiNames);
      }
      setLastRefresh(new Date());
    } catch {
      // API not connected yet — keep fallback data
      console.log('[BOM Watch] Using demo data — API not connected');
    } finally {
      setRefreshing(false);
      setIsLoading(false);
    }
  }, []);

  // Handle manual BOM submission — calls real pricing API
  const handleManualBom = useCallback(async (submission: { name: string; engineer: string; items: { partNumber: string; description: string; qty: number }[] }) => {
    setIsAnalyzing(true);
    
    try {
      const res = await fetch('/api/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: submission.items }),
      });

      const pricing = await res.json();

      if (!res.ok || !pricing.items) {
        throw new Error(pricing.error || 'Pricing API failed');
      }

      // Update live API count from response
      if (pricing.vendorsQueried) {
        setLiveApiCount(pricing.vendorsQueried.length);
      }

      const newId = `MAN-${(1000 + manualBomCounter).toString()}`;
      setManualBomCounter(prev => prev + 1);

      const analyzedItems: BomItem[] = pricing.items.map((item: { partNumber: string; description: string; qty: number; vendors: { mcmaster: number | null; grainger: number | null; digikey: number | null; mouser: number | null }; vendorSources?: { mcmaster: PriceSource; grainger: PriceSource; digikey: PriceSource; mouser: PriceSource }; bestVendor: string; savings: number; details?: { [vendor: string]: VendorDetail }; marketIntel?: MarketIntel; claudeIntel?: ClaudeIntel }) => ({
        partNumber: item.partNumber,
        description: item.description || `Part ${item.partNumber}`,
        qty: item.qty,
        mcmaster: item.vendors.mcmaster,
        grainger: item.vendors.grainger,
        digikey: item.vendors.digikey,
        mouser: item.vendors.mouser,
        vendorSources: item.vendorSources,
        bestVendor: item.bestVendor,
        savings: item.savings,
        details: item.details,
        marketIntel: item.marketIntel,
        claudeIntel: item.claudeIntel,
      }));

      const totalSavings = analyzedItems.reduce((sum, i) => sum + i.savings, 0);

      const newBom: Bom = {
        id: newId,
        name: submission.name,
        engineer: submission.engineer,
        approvedAt: 'Just now',
        status: 'manual',
        newParts: analyzedItems.length,
        totalSavings: parseFloat(totalSavings.toFixed(2)),
        items: analyzedItems,
      };

      setBoms(prev => [newBom, ...prev]);
      setExpandedBom(newId);
      setManualBomOpen(false);
    } catch (err) {
      console.error('[BOM Watch] Pricing error:', err);
      // Show the error state — in a real app we'd have a toast/notification
      setAnalysisError('Failed to analyze parts. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  }, [manualBomCounter]);

  // Initial fetch + auto-refresh every 60s
  useEffect(() => {
    setIsLoading(true);
    fetchBoms();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchBoms();
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchBoms]);

  // Reset sort when a different BOM is expanded
  useEffect(() => {
    setSortConfig(null);
  }, [expandedBom]);

  // Compute best price for a BomItem (used for sorting)
  const getBestPrice = useCallback((item: BomItem): number | null => {
    const prices = [item.mcmaster, item.grainger, item.digikey, item.mouser, item.claudeIntel?.bestPrice ?? null].filter((p): p is number => p !== null);
    return prices.length > 0 ? Math.min(...prices) : null;
  }, []);

  // Sort items based on sortConfig
  const getSortedItems = useCallback((items: BomItem[]): BomItem[] => {
    if (!sortConfig) return items;
    const { key, direction } = sortConfig;
    const sorted = [...items].sort((a, b) => {
      let aVal: number | string | null;
      let bVal: number | string | null;
      switch (key) {
        case 'bestPrice':
          aVal = getBestPrice(a);
          bVal = getBestPrice(b);
          break;
        case 'qty':
          aVal = a.qty;
          bVal = b.qty;
          break;
        case 'vendor':
          aVal = a.bestVendor?.toLowerCase() ?? '';
          bVal = b.bestVendor?.toLowerCase() ?? '';
          break;
        case 'saved':
          aVal = a.savings;
          bVal = b.savings;
          break;
        default:
          return 0;
      }
      // Nulls always go last
      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1;
      if (bVal === null) return -1;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return direction === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
    return sorted;
  }, [sortConfig, getBestPrice]);

  // Toggle sort: null -> asc -> desc -> null
  const handleSort = useCallback((key: string) => {
    setSortConfig(prev => {
      if (!prev || prev.key !== key) return { key, direction: 'asc' };
      if (prev.direction === 'asc') return { key, direction: 'desc' };
      return null;
    });
  }, []);

  const filteredBOMs = useMemo(() => {
    return boms.filter(bom => {
      const matchesSearch = searchQuery === '' || 
        bom.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        bom.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        bom.engineer.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || bom.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [searchQuery, statusFilter, boms]);

  const statusCounts = useMemo(() => ({
    all: boms.length,
    analyzed: boms.filter(b => b.status === 'analyzed').length,
    ordered: boms.filter(b => b.status === 'ordered').length,
    manual: boms.filter(b => b.status === 'manual').length,
  }), [boms]);

  // Export BOM data as CSV file download
  const exportBomCSV = useCallback((bom: Bom) => {
    const headers = ['Part Number', 'Description', 'Qty', 'McMaster', 'Grainger', 'DigiKey', 'Mouser', 'AI Best', 'AI Source', 'Best Vendor', 'Savings'];
    const rows = bom.items.map(item => [
      item.partNumber,
      `"${item.description.replace(/"/g, '""')}"`,
      item.qty,
      item.mcmaster ?? '',
      item.grainger ?? '',
      item.digikey ?? '',
      item.mouser ?? '',
      item.claudeIntel?.bestPrice?.toFixed(2) ?? '',
      item.claudeIntel?.bestSource ?? '',
      item.bestVendor,
      item.savings.toFixed(2),
    ].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${bom.id}-${bom.name.replace(/\s+/g, '-').toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const copyBomData = useCallback((bom: Bom) => {
    const lines = bom.items.map(item => 
      `${item.partNumber}\t${item.description}\t${item.qty}\t${item.mcmaster || '-'}\t${item.grainger || '-'}\t${item.digikey || '-'}\t${item.mouser || '-'}\t${item.claudeIntel?.bestPrice ? `$${item.claudeIntel.bestPrice.toFixed(2)} (${item.claudeIntel.bestSource})` : '-'}\t${item.bestVendor}\t$${item.savings.toFixed(2)}`
    );
    const header = 'Part Number\tDescription\tQty\tMcMaster\tGrainger\tDigiKey\tMouser\tAI Best\tBest Vendor\tSavings';
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
              <DataToggle source={dataSource} onSourceChange={setDataSource} isLive={isLive} />
              <button
                onClick={() => setShowOnboarding(true)}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-all duration-200 font-mono"
                title="How to use BOM Watch"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={fetchBoms}
                disabled={refreshing}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-all duration-200 font-mono disabled:opacity-50"
                title={lastRefresh ? `Last refreshed: ${lastRefresh.toLocaleTimeString()}` : 'Refresh data'}
              >
                <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
              <a href="https://app.bom.arena.com" target="_blank" rel="noopener" className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-all duration-200 font-mono">
                Arena PLM <ArrowUpRight className="w-3 h-3" />
              </a>
              <div className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-full border ${isLive ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-amber-500/10 border-amber-500/20'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                <span className={`text-[10px] sm:text-[11px] font-medium font-mono hidden sm:inline ${isLive ? 'text-emerald-400' : 'text-amber-400'}`}>{isLive ? 'ARENA CONNECTED' : 'DEMO MODE'}</span>
                <span className={`text-[10px] font-medium font-mono sm:hidden ${isLive ? 'text-emerald-400' : 'text-amber-400'}`}>{isLive ? 'LIVE' : 'DEMO'}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-emerald-400/60 animate-spin" />
              <p className="text-sm text-white/40 font-mono">Connecting to BOM Watch...</p>
            </div>
          </div>
        )}

        {!isLoading && <>
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { icon: DollarSign, label: 'Monthly Savings', value: `$${computedStats.totalSavingsMonth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, sub: `${computedStats.bomsAnalyzed} BOMs contributing`, subColor: 'text-emerald-400/70', accent: true },
            { icon: Package, label: 'BOMs Analyzed', value: computedStats.bomsAnalyzed.toString(), sub: `${boms.length} total in system`, subColor: 'text-white/30', accent: false },
            { icon: TrendingDown, label: 'Avg Savings / BOM', value: `$${computedStats.avgSavingsPerBom.toFixed(2)}`, sub: computedStats.avgSavingsPerBom > 0 ? 'Per analyzed BOM' : 'No data yet', subColor: 'text-white/30', accent: false },
            { icon: Zap, label: 'Live APIs', value: computedStats.avgTimeToNotify, sub: liveApiNames.length > 0 ? liveApiNames.join(', ') : 'Vendor integrations active', subColor: liveApiNames.length > 0 ? 'text-emerald-400/50' : 'text-white/30', accent: false },
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
              <p className="font-medium text-white">Z-Drive Assembly — ECO-00005</p>
              <p className="text-sm text-white/50 mt-0.5">5 new OTS parts · Estimated savings: <span className="text-emerald-400 font-medium">$1,275.54</span> · Assignee: Rebecca</p>
              <div className="flex gap-2 mt-3">
                <button onClick={() => { setExpandedBom('BOM-3001'); setAlertDismissed(true); }} className="px-3 py-1.5 bg-amber-500/20 text-amber-300 text-xs font-medium rounded-lg hover:bg-amber-500/30 transition-colors border border-amber-500/20">
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
              <span className="text-[10px] font-mono text-white/20 bg-white/[0.04] px-2 py-0.5 rounded-full">{boms.length} total</span>
              <button
                onClick={() => setManualBomOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono text-emerald-400/70 hover:text-emerald-400 bg-emerald-500/[0.06] hover:bg-emerald-500/10 border border-emerald-500/15 hover:border-emerald-500/25 transition-all"
              >
                <Plus className="w-3 h-3" /> New BOM
              </button>
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
                {(['all', 'analyzed', 'ordered', 'manual'] as const).map(s => (
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
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium whitespace-nowrap ${bom.status === 'analyzed' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : bom.status === 'manual' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
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
                        <Sparkles className="w-3 h-3" />
                        <span>Tap a card to expand details</span>
                      </div>
                      <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-white/20">
                        <Sparkles className="w-3 h-3" />
                        <span>AI-analyzed price comparison</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={(e) => { e.stopPropagation(); copyBomData(bom); }}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono text-white/30 hover:text-white/60 hover:bg-white/[0.05] transition-all duration-200"
                        >
                          {copiedBom === bom.id ? (
                            <><CheckCircle2 className="w-3 h-3 text-emerald-400" /><span className="text-emerald-400">Copied!</span></>
                          ) : (
                            <><Copy className="w-3 h-3" /><span className="hidden sm:inline">Copy</span></>
                          )}
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); exportBomCSV(bom); }}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono text-white/30 hover:text-white/60 hover:bg-white/[0.05] transition-all duration-200"
                        >
                          <Download className="w-3 h-3" /><span className="hidden sm:inline">Export CSV</span>
                        </button>
                      </div>
                    </div>
                    {/* Recommendation Strip */}
                    {(() => {
                      const switchItems = bom.items.filter(i => i.bestVendor !== 'McMaster-Carr' && i.savings > 0);
                      const stayItems = bom.items.filter(i => i.bestVendor === 'McMaster-Carr' || i.savings === 0);
                      const topVendor = switchItems.length > 0
                        ? Object.entries(
                            switchItems.reduce<Record<string, number>>((acc, i) => {
                              acc[i.bestVendor] = (acc[i.bestVendor] || 0) + 1;
                              return acc;
                            }, {})
                          ).sort((a, b) => b[1] - a[1])[0][0]
                        : null;
                      // Decision progress for this BOM
                      const decidedCount = bom.items.filter(item => decisions[`${bom.id}-${item.partNumber}`] != null).length;
                      const acceptedCount = bom.items.filter(item => decisions[`${bom.id}-${item.partNumber}`] === 'accepted').length;
                      const skippedCount = bom.items.filter(item => decisions[`${bom.id}-${item.partNumber}`] === 'skipped').length;
                      const totalParts = bom.items.length;
                      const allDecided = decidedCount === totalParts && totalParts > 0;
                      return (
                        <div className="px-4 sm:px-5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.04] bg-emerald-500/[0.02]">
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
                            <span className="text-white/50">
                              {switchItems.length > 0 ? (
                                <><span className="text-emerald-400 font-medium">{switchItems.length} of {bom.items.length}</span> parts: switch{topVendor ? ` to ${topVendor}` : ' vendors'}</>
                              ) : (
                                <><span className="text-white/60 font-medium">{stayItems.length} of {bom.items.length}</span> parts at best price</>
                              )}
                            </span>
                            {bom.totalSavings > 0 && (
                              <span className="text-[10px] font-mono text-emerald-400/70 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                Save ${bom.totalSavings.toFixed(2)}
                              </span>
                            )}
                            {decidedCount > 0 && (
                              <div className="flex flex-col">
                                <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${allDecided ? 'text-emerald-400/80 bg-emerald-500/10 border-emerald-500/20' : 'text-white/40 bg-white/[0.04] border-white/[0.06]'}`}>
                                  {allDecided
                                    ? <><span className="hidden sm:inline">All parts decided &mdash; {acceptedCount} accepted, {skippedCount} skipped</span><span className="sm:hidden">{acceptedCount}&check; {skippedCount}&cross;</span></>
                                    : `${decidedCount} of ${totalParts} decided`}
                                </span>
                                <div className="h-[2px] w-full bg-white/[0.06] rounded-full mt-1 overflow-hidden">
                                  <div className="h-full bg-emerald-400 rounded-full transition-all duration-300" style={{ width: `${(decidedCount / totalParts) * 100}%` }} />
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); const next: Record<string, 'accepted' | 'skipped' | null> = { ...decisions }; bom.items.forEach(item => { next[`${bom.id}-${item.partNumber}`] = 'accepted'; }); setDecisions(next); }}
                              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono text-emerald-400/50 hover:text-emerald-400 hover:bg-emerald-500/[0.06] transition-all duration-200"
                            >
                              <CheckCircle2 className="w-3 h-3" /> <span className="hidden sm:inline">Accept All</span>
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); const next: Record<string, 'accepted' | 'skipped' | null> = { ...decisions }; bom.items.forEach(item => { next[`${bom.id}-${item.partNumber}`] = 'skipped'; }); setDecisions(next); }}
                              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono text-amber-400/50 hover:text-amber-400 hover:bg-amber-500/[0.06] transition-all duration-200"
                            >
                              <X className="w-3 h-3" /> <span className="hidden sm:inline">Skip All</span>
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); exportByVendor(bom); }}
                              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono text-white/30 hover:text-white/60 hover:bg-white/[0.05] transition-all duration-200"
                            >
                              <ShoppingCart className="w-3 h-3" /> <span className="hidden sm:inline">Export by Vendor</span>
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); downloadVendorCSV(bom); }}
                              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono text-white/30 hover:text-white/60 hover:bg-white/[0.05] transition-all duration-200"
                              title="Download vendor-grouped CSV file"
                            >
                              <Download className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); copyRecommendations(bom); }}
                              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono text-white/30 hover:text-white/60 hover:bg-white/[0.05] transition-all duration-200"
                            >
                              <ClipboardList className="w-3 h-3" /> <span className="hidden sm:inline">Copy Recs</span>
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                    {/* Desktop table — hidden on mobile */}
                    <div className="hidden md:block">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-white/[0.06]">
                            <th className="px-5 py-2.5 text-left text-[10px] font-mono text-white/30 uppercase tracking-wider">Part</th>
                            <th className="px-3 py-2.5 text-center text-[10px] font-mono text-white/30 uppercase tracking-wider cursor-pointer hover:text-white/50 transition-colors select-none" onClick={() => handleSort('qty')}>
                              <span className="inline-flex items-center gap-0.5 justify-center">Qty<ChevronDown className={`w-3 h-3 transition-transform duration-200 ${sortConfig?.key === 'qty' ? 'opacity-100' : 'opacity-30'} ${sortConfig?.key === 'qty' && sortConfig.direction === 'asc' ? 'rotate-180' : ''}`} /></span>
                            </th>
                            <th className="px-3 py-2.5 text-right text-[10px] font-mono text-white/30 uppercase tracking-wider cursor-pointer hover:text-white/50 transition-colors select-none" onClick={() => handleSort('bestPrice')}>
                              <span className="inline-flex items-center gap-0.5 justify-end">Best Price<ChevronDown className={`w-3 h-3 transition-transform duration-200 ${sortConfig?.key === 'bestPrice' ? 'opacity-100' : 'opacity-30'} ${sortConfig?.key === 'bestPrice' && sortConfig.direction === 'asc' ? 'rotate-180' : ''}`} /></span>
                            </th>
                            <th className="px-3 py-2.5 text-center text-[10px] font-mono text-white/30 uppercase tracking-wider">Stock</th>
                            <th className="px-3 py-2.5 text-left text-[10px] font-mono text-white/30 uppercase tracking-wider cursor-pointer hover:text-white/50 transition-colors select-none" onClick={() => handleSort('vendor')}>
                              <span className="inline-flex items-center gap-0.5">Vendor<ChevronDown className={`w-3 h-3 transition-transform duration-200 ${sortConfig?.key === 'vendor' ? 'opacity-100' : 'opacity-30'} ${sortConfig?.key === 'vendor' && sortConfig.direction === 'asc' ? 'rotate-180' : ''}`} /></span>
                            </th>
                            <th className="px-3 py-2.5 text-center text-[10px] font-mono text-white/30 uppercase tracking-wider">Alts</th>
                            <th className="px-3 py-2.5 text-right text-[10px] font-mono text-white/30 uppercase tracking-wider cursor-pointer hover:text-white/50 transition-colors select-none" onClick={() => handleSort('saved')}>
                              <span className="inline-flex items-center gap-0.5 justify-end">Saved<ChevronDown className={`w-3 h-3 transition-transform duration-200 ${sortConfig?.key === 'saved' ? 'opacity-100' : 'opacity-30'} ${sortConfig?.key === 'saved' && sortConfig.direction === 'asc' ? 'rotate-180' : ''}`} /></span>
                            </th>
                            <th className="w-[60px] py-2.5" />
                          </tr>
                        </thead>
                        <tbody>
                          {getSortedItems(bom.items).map((item, i) => {
                            // Compute best price across ALL sources (vendors + claudeIntel)
                            const allPrices = [
                              item.mcmaster ? { price: item.mcmaster, vendor: 'McMaster-Carr', source: item.vendorSources?.mcmaster } : null,
                              item.grainger ? { price: item.grainger, vendor: 'Grainger', source: item.vendorSources?.grainger } : null,
                              item.digikey ? { price: item.digikey, vendor: 'DigiKey', source: item.vendorSources?.digikey } : null,
                              item.mouser ? { price: item.mouser, vendor: 'Mouser', source: item.vendorSources?.mouser } : null,
                              item.claudeIntel?.bestPrice ? { price: item.claudeIntel.bestPrice, vendor: item.claudeIntel.bestSource || 'AI Found', source: 'ai' as PriceSource } : null,
                            ].filter((p): p is { price: number; vendor: string; source: PriceSource } => p !== null);
                            allPrices.sort((a, b) => a.price - b.price);
                            const best = allPrices[0] || null;

                            // Count alternatives (all sources except the best)
                            const vendorLinks = item.details ? Object.entries(item.details).filter(([, d]) => d.url) : [];
                            const aiAlts = item.claudeIntel?.alternatives?.length || 0;
                            const altCount = Math.max(0, allPrices.length - 1) + aiAlts;

                            // Stock status from best vendor's details
                            const bestKey = best ? best.vendor.toLowerCase().replace('-carr', '').replace(' ', '') : null;
                            const bestDetail = bestKey ? Object.entries(item.details || {}).find(([k]) => k.toLowerCase().includes(bestKey || '')) : null;
                            const inStock = bestDetail ? bestDetail[1].inStock : null;
                            const stockQty = bestDetail ? bestDetail[1].stockQty : null;
                            const leadTime = bestDetail ? bestDetail[1].leadTimeDays : null;

                            // Risk flags
                            const riskFlags = (item as { riskFlags?: Array<{ type: string; message: string }> }).riskFlags || [];
                            const hasRisk = riskFlags.length > 0;

                            // Expand state
                            const partKey = `${bom.id}-${item.partNumber}`;
                            const isPartExpanded = expandedPart === partKey;

                            return (
                              <React.Fragment key={i}>
                              <tr className={`border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors duration-150 cursor-pointer ${hasRisk ? 'border-l-2 border-l-amber-500/30' : ''}`} onClick={() => setExpandedPart(isPartExpanded ? null : partKey)}>
                                {/* Part */}
                                <td className="px-5 py-3">
                                  <p className="font-mono text-[11px] text-white/30">{item.partNumber}</p>
                                  <p className="text-xs text-white/60 truncate max-w-[300px]">{item.description}</p>
                                  {hasRisk && (
                                    <div className="flex items-center gap-1 mt-1">
                                      {riskFlags.map((flag, fi) => (
                                        <span key={fi} className="text-[8px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400/60 border border-amber-500/15">
                                          {flag.type === 'single_source' ? 'single source' : flag.type === 'out_of_stock' ? 'out of stock' : flag.type === 'long_lead_time' ? 'long lead' : 'unverified'}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </td>
                                {/* Qty */}
                                <td className="px-3 py-3 text-center text-xs text-white/40 font-mono">{item.qty}</td>
                                {/* Best Price */}
                                <td className="px-3 py-3 text-right">
                                  {best ? (
                                    <div>
                                      <span className="text-sm font-mono text-emerald-400 font-medium">${best.price.toFixed(2)}</span>
                                      <span className={`block text-[8px] font-mono mt-0.5 ${best.source === 'api' ? 'text-emerald-400/50' : best.source === 'estimated' ? 'text-amber-400/50' : best.source === 'ai' ? 'text-purple-400/50' : 'text-white/20'}`}>
                                        {best.source === 'api' ? 'LIVE' : best.source === 'estimated' ? 'EST' : best.source === 'ai' ? 'AI' : ''}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-white/15">—</span>
                                  )}
                                </td>
                                {/* Stock */}
                                <td className="px-3 py-3 text-center">
                                  {inStock === true ? (
                                    <span className="inline-flex items-center gap-1">
                                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                                      {stockQty !== null && <span className="text-[9px] font-mono text-white/30">{stockQty.toLocaleString()}</span>}
                                    </span>
                                  ) : inStock === false ? (
                                    <span className="inline-flex items-center gap-1">
                                      <span className="w-2 h-2 rounded-full bg-red-400/60" />
                                      <span className="text-[9px] font-mono text-red-400/50">out</span>
                                    </span>
                                  ) : (
                                    <span className="text-[9px] text-white/15">—</span>
                                  )}
                                </td>
                                {/* Vendor */}
                                <td className="px-3 py-3">
                                  {best ? (
                                    <div>
                                      <span className="inline-flex items-center gap-1">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                          {best.vendor}
                                        </span>
                                        <span
                                          className="text-[9px] text-white/25 hover:text-white/50 cursor-help transition-colors"
                                          title={`Lowest price at $${best.price.toFixed(2)}/ea | ${inStock === true ? (stockQty !== null ? `${stockQty.toLocaleString()} in stock` : 'In stock') : inStock === false ? 'Out of stock' : 'Stock unknown'} | ${leadTime != null ? `${leadTime} day${leadTime !== 1 ? 's' : ''} lead` : 'Lead time unknown'}`}
                                        >
                                          (i)
                                        </span>
                                      </span>
                                      {leadTime != null && (
                                        <span className={`block text-[9px] font-mono mt-1 ${leadTime > 3 ? 'text-amber-400/70' : 'text-emerald-400/70'}`}>
                                          {leadTime} day{leadTime !== 1 ? 's' : ''}
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-[10px] text-white/15">—</span>
                                  )}
                                </td>
                                {/* Alts */}
                                <td className="px-3 py-3 text-center">
                                  {altCount > 0 ? (
                                    <span className="text-[11px] font-mono text-purple-400/70">{altCount}</span>
                                  ) : (
                                    <span className="text-[11px] text-white/15">0</span>
                                  )}
                                </td>
                                {/* Saved */}
                                <td className="px-3 py-3 text-right text-xs font-mono font-medium text-emerald-400">
                                  {item.savings > 0 ? `$${item.savings.toFixed(2)}` : '—'}
                                </td>
                                {/* Accept / Skip actions */}
                                <td className="px-2 py-3 text-center">
                                  <div className="inline-flex items-center gap-1">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); toggleDecision(partKey, 'accepted'); }}
                                      className={`p-0.5 rounded transition-colors duration-150 ${decisions[partKey] === 'accepted' ? 'text-emerald-400' : 'text-white/15 hover:text-white/30'}`}
                                      title="Accept"
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); toggleDecision(partKey, 'skipped'); }}
                                      className={`p-0.5 rounded transition-colors duration-150 ${decisions[partKey] === 'skipped' ? 'text-amber-400/60' : 'text-white/15 hover:text-white/30'}`}
                                      title="Skip"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                              {/* Expanded detail row */}
                              {isPartExpanded && (
                                <tr className="bg-white/[0.01]">
                                  <td colSpan={8} className="px-5 py-3">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in">
                                      {/* All vendor prices */}
                                      <div className="space-y-1.5">
                                        {best && (
                                          <p className="text-[11px] font-mono text-emerald-400 mb-1">
                                            Qty: {item.qty} &times; ${best.price.toFixed(2)} = ${(item.qty * best.price).toFixed(2)}
                                          </p>
                                        )}
                                        <p className="text-[10px] font-mono text-white/30 uppercase tracking-wider mb-2">All Vendor Prices</p>
                                        {allPrices.map((p, pi) => (
                                          <div key={pi} className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-2">
                                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${pi === 0 ? 'bg-emerald-400' : 'bg-white/20'}`} />
                                              <span className="text-[11px] font-mono text-white/60">{p.vendor}</span>
                                              <span className={`text-[7px] px-1 py-0.5 rounded uppercase ${p.source === 'api' ? 'bg-emerald-500/10 text-emerald-400/60' : p.source === 'estimated' ? 'bg-amber-500/10 text-amber-400/60' : 'bg-purple-500/10 text-purple-400/60'}`}>
                                                {p.source === 'api' ? 'live' : p.source === 'estimated' ? 'est' : 'ai'}
                                              </span>
                                            </div>
                                            <span className={`text-[11px] font-mono ${pi === 0 ? 'text-emerald-400 font-medium' : 'text-white/40'}`}>${p.price.toFixed(2)}</span>
                                          </div>
                                        ))}
                                        {vendorLinks.length > 0 && (
                                          <div className="flex items-center gap-2 pt-2 border-t border-white/[0.04]">
                                            {vendorLinks.map(([vendor, detail]) => (
                                              <a key={vendor} href={detail.url} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-[9px] font-mono text-blue-400/60 hover:text-blue-400 transition-colors">
                                                <ExternalLink className="w-2.5 h-2.5" />
                                                {vendor.charAt(0).toUpperCase() + vendor.slice(1)}
                                              </a>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                      {/* AI Intelligence */}
                                      {item.claudeIntel && (
                                        <div className="space-y-1.5">
                                          <p className="text-[10px] font-mono text-purple-400/60 uppercase tracking-wider mb-2">Market Intelligence</p>
                                          {item.claudeIntel.alternatives.map((alt, ai) => (
                                            <div key={ai} className="flex items-center justify-between gap-3">
                                              <div className="flex items-center gap-2 min-w-0">
                                                <span className="w-1.5 h-1.5 rounded-full bg-purple-400/40 flex-shrink-0" />
                                                {alt.url ? (
                                                  <a href={alt.url} target="_blank" rel="noopener" className="text-[11px] font-mono text-purple-300/70 hover:text-purple-300 transition-colors truncate">
                                                    {alt.distributor} <ExternalLink className="w-2.5 h-2.5 inline ml-0.5 opacity-40" />
                                                  </a>
                                                ) : (
                                                  <span className="text-[11px] font-mono text-purple-300/50">{alt.distributor}</span>
                                                )}
                                              </div>
                                              <span className="text-[11px] font-mono text-white/40">${alt.price.toFixed(2)}</span>
                                            </div>
                                          ))}
                                          {item.claudeIntel.insight && (
                                            <p className="text-[10px] text-purple-300/40 italic leading-relaxed pt-2 border-t border-purple-500/10">
                                              {item.claudeIntel.insight}
                                            </p>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
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

                    {/* Mobile card layout — visible only on small screens */}
                    <div className="md:hidden">
                      <div className="px-3 py-2 space-y-2">
                        {getSortedItems(bom.items).map((item, i) => {
                          // Same price computation as desktop table rows
                          const allPricesMobile = [
                            item.mcmaster ? { price: item.mcmaster, vendor: 'McMaster-Carr', source: item.vendorSources?.mcmaster } : null,
                            item.grainger ? { price: item.grainger, vendor: 'Grainger', source: item.vendorSources?.grainger } : null,
                            item.digikey ? { price: item.digikey, vendor: 'DigiKey', source: item.vendorSources?.digikey } : null,
                            item.mouser ? { price: item.mouser, vendor: 'Mouser', source: item.vendorSources?.mouser } : null,
                            item.claudeIntel?.bestPrice ? { price: item.claudeIntel.bestPrice, vendor: item.claudeIntel.bestSource || 'AI Found', source: 'ai' as PriceSource } : null,
                          ].filter((p): p is { price: number; vendor: string; source: PriceSource } => p !== null);
                          allPricesMobile.sort((a, b) => a.price - b.price);
                          const bestMobile = allPricesMobile[0] || null;

                          const vendorLinksMobile = item.details ? Object.entries(item.details).filter(([, d]) => d.url) : [];
                          const aiAltsMobile = item.claudeIntel?.alternatives?.length || 0;
                          const altCountMobile = Math.max(0, allPricesMobile.length - 1) + aiAltsMobile;

                          const bestKeyMobile = bestMobile ? bestMobile.vendor.toLowerCase().replace('-carr', '').replace(' ', '') : null;
                          const bestDetailMobile = bestKeyMobile ? Object.entries(item.details || {}).find(([k]) => k.toLowerCase().includes(bestKeyMobile || '')) : null;
                          const inStockMobile = bestDetailMobile ? bestDetailMobile[1].inStock : null;
                          const stockQtyMobile = bestDetailMobile ? bestDetailMobile[1].stockQty : null;
                          const leadTimeMobile = bestDetailMobile ? bestDetailMobile[1].leadTimeDays : null;

                          const riskFlagsMobile = (item as { riskFlags?: Array<{ type: string; message: string }> }).riskFlags || [];
                          const hasRiskMobile = riskFlagsMobile.length > 0;

                          const partKeyMobile = `${bom.id}-${item.partNumber}`;
                          const isPartExpandedMobile = expandedPart === partKeyMobile;

                          return (
                            <div key={i} className={`bg-white/[0.02] border rounded-lg overflow-hidden transition-all duration-200 ${hasRiskMobile ? 'border-amber-500/20' : 'border-white/[0.06]'}`}>
                              {/* Tappable card header */}
                              <button
                                className="w-full text-left p-4 cursor-pointer active:bg-white/[0.03] transition-colors"
                                onClick={() => setExpandedPart(isPartExpandedMobile ? null : partKeyMobile)}
                              >
                                {/* Row 1: Part number */}
                                <p className="font-mono text-[11px] text-white/30">{item.partNumber}</p>
                                {/* Row 2: Description (truncated) */}
                                <p className="text-xs text-white/60 truncate mt-0.5">{item.description}</p>

                                {/* Risk flags */}
                                {hasRiskMobile && (
                                  <div className="flex items-center gap-1 mt-1.5">
                                    {riskFlagsMobile.map((flag, fi) => (
                                      <span key={fi} className="text-[8px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400/60 border border-amber-500/15">
                                        {flag.type === 'single_source' ? 'single source' : flag.type === 'out_of_stock' ? 'out of stock' : flag.type === 'long_lead_time' ? 'long lead' : 'unverified'}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {/* Row 3: Best price + stock dot + lead time */}
                                <div className="flex items-center gap-3 mt-3">
                                  {bestMobile ? (
                                    <span className="text-sm font-mono text-emerald-400 font-medium">${bestMobile.price.toFixed(2)}</span>
                                  ) : (
                                    <span className="text-xs text-white/15">--</span>
                                  )}
                                  {inStockMobile === true ? (
                                    <span className="inline-flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                      <span className="text-[10px] text-emerald-400/70">In Stock</span>
                                      {stockQtyMobile !== null && <span className="text-[9px] font-mono text-white/25">({stockQtyMobile.toLocaleString()})</span>}
                                    </span>
                                  ) : inStockMobile === false ? (
                                    <span className="inline-flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-red-400/60" />
                                      <span className="text-[10px] text-red-400/50">Out of stock</span>
                                    </span>
                                  ) : null}
                                  {leadTimeMobile != null && (
                                    <span className={`text-[10px] font-mono ${leadTimeMobile > 3 ? 'text-amber-400/70' : 'text-white/30'}`}>
                                      {leadTimeMobile} day{leadTimeMobile !== 1 ? 's' : ''}
                                    </span>
                                  )}
                                </div>

                                {/* Row 4: Vendor badge + source + quantity */}
                                <div className="flex items-center gap-2 mt-1.5">
                                  {bestMobile ? (
                                    <>
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                        {bestMobile.vendor}
                                      </span>
                                      <span className={`text-[8px] font-mono uppercase ${bestMobile.source === 'api' ? 'text-emerald-400/50' : bestMobile.source === 'estimated' ? 'text-amber-400/50' : bestMobile.source === 'ai' ? 'text-purple-400/50' : 'text-white/20'}`}>
                                        {bestMobile.source === 'api' ? 'LIVE' : bestMobile.source === 'estimated' ? 'EST' : bestMobile.source === 'ai' ? 'AI' : ''}
                                      </span>
                                    </>
                                  ) : null}
                                  <span className="text-[10px] font-mono text-white/30">{item.qty} qty</span>
                                </div>

                                {/* Row 5: Savings + alt count + accept/skip buttons */}
                                <div className="flex items-center justify-between mt-3">
                                  <div className="flex items-center gap-3">
                                    {item.savings > 0 ? (
                                      <span className="text-xs font-mono font-medium text-emerald-400">Saved: ${item.savings.toFixed(2)}</span>
                                    ) : (
                                      <span className="text-xs font-mono text-white/20">Saved: --</span>
                                    )}
                                    {altCountMobile > 0 ? (
                                      <span className="text-[10px] font-mono text-purple-400/70">{altCountMobile} alt{altCountMobile !== 1 ? 's' : ''}</span>
                                    ) : (
                                      <span className="text-[10px] font-mono text-white/15">0 alts</span>
                                    )}
                                    {bestMobile && (
                                      <span className="text-[10px] font-mono text-emerald-400/70">Total: ${(item.qty * bestMobile.price).toFixed(2)}</span>
                                    )}
                                  </div>
                                  <div className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); toggleDecision(partKeyMobile, 'accepted'); }}
                                      className={`p-1.5 rounded transition-colors duration-150 ${decisions[partKeyMobile] === 'accepted' ? 'text-emerald-400 bg-emerald-500/10' : 'text-white/15 hover:text-white/30'}`}
                                      title="Accept"
                                    >
                                      <CheckCircle2 className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); toggleDecision(partKeyMobile, 'skipped'); }}
                                      className={`p-1.5 rounded transition-colors duration-150 ${decisions[partKeyMobile] === 'skipped' ? 'text-amber-400/60 bg-amber-500/10' : 'text-white/15 hover:text-white/30'}`}
                                      title="Skip"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              </button>

                              {/* Expanded detail — same vendor breakdown + AI intel as desktop */}
                              {isPartExpandedMobile && (
                                <div className="border-t border-white/[0.04] px-4 py-3 bg-white/[0.01] animate-in">
                                  <div className="space-y-4">
                                    {/* All vendor prices */}
                                    <div className="space-y-1.5">
                                      {bestMobile && (
                                        <p className="text-[11px] font-mono text-emerald-400 mb-1">
                                          Qty: {item.qty} &times; ${bestMobile.price.toFixed(2)} = ${(item.qty * bestMobile.price).toFixed(2)}
                                        </p>
                                      )}
                                      <p className="text-[10px] font-mono text-white/30 uppercase tracking-wider mb-2">All Vendor Prices</p>
                                      {allPricesMobile.map((p, pi) => (
                                        <div key={pi} className="flex items-center justify-between gap-3">
                                          <div className="flex items-center gap-2">
                                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${pi === 0 ? 'bg-emerald-400' : 'bg-white/20'}`} />
                                            <span className="text-[11px] font-mono text-white/60">{p.vendor}</span>
                                            <span className={`text-[7px] px-1 py-0.5 rounded uppercase ${p.source === 'api' ? 'bg-emerald-500/10 text-emerald-400/60' : p.source === 'estimated' ? 'bg-amber-500/10 text-amber-400/60' : 'bg-purple-500/10 text-purple-400/60'}`}>
                                              {p.source === 'api' ? 'live' : p.source === 'estimated' ? 'est' : 'ai'}
                                            </span>
                                          </div>
                                          <span className={`text-[11px] font-mono ${pi === 0 ? 'text-emerald-400 font-medium' : 'text-white/40'}`}>${p.price.toFixed(2)}</span>
                                        </div>
                                      ))}
                                      {vendorLinksMobile.length > 0 && (
                                        <div className="flex items-center gap-2 pt-2 border-t border-white/[0.04]">
                                          {vendorLinksMobile.map(([vendor, detail]) => (
                                            <a key={vendor} href={detail.url} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-[9px] font-mono text-blue-400/60 hover:text-blue-400 transition-colors">
                                              <ExternalLink className="w-2.5 h-2.5" />
                                              {vendor.charAt(0).toUpperCase() + vendor.slice(1)}
                                            </a>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    {/* AI Intelligence */}
                                    {item.claudeIntel && (
                                      <div className="space-y-1.5">
                                        <p className="text-[10px] font-mono text-purple-400/60 uppercase tracking-wider mb-2">Market Intelligence</p>
                                        {item.claudeIntel.alternatives.map((alt, ai) => (
                                          <div key={ai} className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-2 min-w-0">
                                              <span className="w-1.5 h-1.5 rounded-full bg-purple-400/40 flex-shrink-0" />
                                              {alt.url ? (
                                                <a href={alt.url} target="_blank" rel="noopener" className="text-[11px] font-mono text-purple-300/70 hover:text-purple-300 transition-colors truncate">
                                                  {alt.distributor} <ExternalLink className="w-2.5 h-2.5 inline ml-0.5 opacity-40" />
                                                </a>
                                              ) : (
                                                <span className="text-[11px] font-mono text-purple-300/50">{alt.distributor}</span>
                                              )}
                                            </div>
                                            <span className="text-[11px] font-mono text-white/40">${alt.price.toFixed(2)}</span>
                                          </div>
                                        ))}
                                        {item.claudeIntel.insight && (
                                          <p className="text-[10px] text-purple-300/40 italic leading-relaxed pt-2 border-t border-purple-500/10">
                                            {item.claudeIntel.insight}
                                          </p>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {/* Mobile totals bar */}
                      <div className="mx-3 mb-3 mt-1 flex items-center justify-between px-4 py-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                        <span className="text-xs text-white/40 font-mono">TOTAL SAVINGS</span>
                        <span className="text-sm font-mono font-bold text-emerald-400">${bom.totalSavings.toFixed(2)}</span>
                      </div>
                    </div>

                    {/* AI Summary */}
                    <div className="px-5 py-4 bg-white/[0.02] border-t border-white/[0.04]">
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center flex-shrink-0 mt-0.5 border border-blue-500/10">
                          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                        </div>
                        <div>
                          <p className="text-[10px] font-mono text-blue-400/70 uppercase tracking-wider mb-1">
                            {bom.items.some(i => i.claudeIntel && i.claudeIntel.bestPrice !== null) ? 'AI-Powered Price Analysis' : 'Vendor Price Analysis'}
                          </p>
                          <p className="text-xs text-white/50 leading-relaxed">
                            {bom.items.length} parts analyzed across {new Set(bom.items.filter(i => i.mcmaster !== null).length > 0 ? ['McMaster'] : []).size + new Set(bom.items.filter(i => i.grainger !== null).length > 0 ? ['Grainger'] : []).size + (bom.items.some(i => i.digikey !== null) ? 1 : 0) + (bom.items.some(i => i.mouser !== null) ? 1 : 0)} vendors. {bom.items.filter(i => i.bestVendor === 'Grainger').length > 0 ? `${bom.items.filter(i => i.bestVendor === 'Grainger').length} parts cheapest on Grainger. ` : ''}{bom.items.filter(i => i.bestVendor === 'DigiKey').length > 0 ? `${bom.items.filter(i => i.bestVendor === 'DigiKey').length} parts cheapest on DigiKey. ` : ''}
                            <span className="text-white/70">
                              {bom.totalSavings > 100 ? `Total savings of $${bom.totalSavings.toFixed(2)} by optimizing vendor selection.` : bom.totalSavings > 0 ? `$${bom.totalSavings.toFixed(2)} in savings identified.` : 'All items at best available pricing.'}
                            </span>
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

        {/* Analytics Section — Collapsible Charts */}
        <div className="mb-6">
          <button
            onClick={() => setAnalyticsOpen(!analyticsOpen)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-white/60 hover:text-white/80 hover:bg-white/[0.03] transition-all duration-200"
          >
            <BarChart3 className="w-4 h-4" />
            Analytics
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${analyticsOpen ? 'rotate-180' : ''}`} />
          </button>
          {analyticsOpen && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3 animate-in">
              <SavingsChart />
              <VendorChart />
            </div>
          )}
        </div>

        </>}
        <p className="text-center text-[9px] font-mono text-white/10 py-4">BOM Watch v0.5.0</p>
      </main>

      {/* Success Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in">
          <div className="bg-emerald-500/20 border border-emerald-500/30 rounded-xl px-5 py-3 flex items-center gap-3 shadow-2xl backdrop-blur-md">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <p className="text-sm text-emerald-300">{toastMessage}</p>
            <button onClick={() => setToastMessage(null)} className="text-emerald-400/50 hover:text-emerald-400 transition-colors p-1">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Error Toast */}
      {analysisError && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in">
          <div className="bg-red-500/20 border border-red-500/30 rounded-xl px-5 py-3 flex items-center gap-3 shadow-2xl backdrop-blur-md">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-300">{analysisError}</p>
            <button onClick={() => setAnalysisError(null)} className="text-red-400/50 hover:text-red-400 transition-colors p-1">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      <footer className="border-t border-white/[0.04] mt-8 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-1">
          <p className="text-[10px] sm:text-[11px] text-white/20 font-mono">BOM WATCH · MYTRA HACKATHON 2026</p>
          <p className="text-[10px] sm:text-[11px] text-white/20">Powered by Arena PLM + Claude AI + Vercel</p>
        </div>
      </footer>

      {/* Manual BOM Entry Drawer */}
      <ManualBomDrawer
        isOpen={manualBomOpen}
        onClose={() => setManualBomOpen(false)}
        onSubmit={handleManualBom}
        isAnalyzing={isAnalyzing}
      />

      {/* Onboarding Overlay — shows on first visit or when "?" is clicked */}
      <OnboardingOverlay
        forceShow={showOnboarding}
        onDismiss={() => setShowOnboarding(false)}
      />
    </div>
  );
}
