"use client";

import { useState, useEffect, useCallback } from 'react';
import { Package, X, ArrowRight, Search, ShoppingCart, Download } from 'lucide-react';

const STORAGE_KEY = 'bom-watch-onboarded';

interface OnboardingOverlayProps {
  forceShow?: boolean;
  onDismiss?: () => void;
}

export function OnboardingOverlay({ forceShow = false, onDismiss }: OnboardingOverlayProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (forceShow) {
      setVisible(true);
      return;
    }
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (!dismissed) {
      setVisible(true);
    }
  }, [forceShow]);

  const dismiss = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
    onDismiss?.();
  }, [onDismiss]);

  if (!visible) return null;

  const bullets = [
    {
      icon: Search,
      text: 'Paste or enter part numbers to compare prices across vendors',
    },
    {
      icon: Package,
      text: 'McMaster, Grainger, DigiKey, Mouser + AI-powered market intelligence',
    },
    {
      icon: ArrowRight,
      text: 'Click any row to see all vendor alternatives and pricing sources',
    },
    {
      icon: Download,
      text: 'Export vendor-grouped orders with one click',
    },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={dismiss}
      />

      {/* Card */}
      <div className="relative w-full max-w-lg mx-4 bg-[#111] border border-white/10 rounded-2xl shadow-2xl animate-in overflow-hidden">
        {/* Top accent gradient */}
        <div className="h-[2px] bg-gradient-to-r from-emerald-500/80 via-blue-500/60 to-purple-500/40" />

        {/* Close button */}
        <button
          onClick={dismiss}
          className="absolute top-4 right-4 p-1.5 text-white/20 hover:text-white/50 hover:bg-white/[0.05] rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="px-6 pt-6 pb-2">
          {/* Logo / Title */}
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
              <Package className="w-5 h-5 text-white/60" />
            </div>
            <div>
              <h2 className="text-lg font-medium text-white tracking-tight">
                BOM Watch
              </h2>
              <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest">
                Procurement Intelligence
              </p>
            </div>
          </div>
        </div>

        {/* Bullets */}
        <div className="px-6 py-4 space-y-3">
          {bullets.map((item, i) => (
            <div
              key={i}
              className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]"
            >
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-emerald-500/15 to-purple-500/15 border border-emerald-500/10">
                <item.icon className="w-3.5 h-3.5 text-emerald-400/80" />
              </div>
              <p className="text-sm text-white/60 leading-relaxed pt-0.5">
                {item.text}
              </p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="px-6 pb-6 pt-2">
          <button
            onClick={dismiss}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-medium bg-gradient-to-r from-emerald-500/20 to-purple-500/20 text-white border border-emerald-500/20 hover:from-emerald-500/30 hover:to-purple-500/30 hover:border-emerald-500/30 transition-all duration-200"
          >
            <ShoppingCart className="w-4 h-4" />
            Get Started
          </button>
        </div>
      </div>
    </div>
  );
}
