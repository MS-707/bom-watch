"use client";

import { Database, Globe, ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

export type DataSource = 'demo' | 'live';

interface DataToggleProps {
  source: DataSource;
  onSourceChange: (source: DataSource) => void;
  isLive: boolean;
}

export function DataToggle({ source, onSourceChange, isLive }: DataToggleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-mono text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-all duration-200 border border-white/[0.06]"
      >
        {source === 'live' ? <Globe className="w-3 h-3" /> : <Database className="w-3 h-3" />}
        <span className="hidden sm:inline">{source === 'live' ? 'Live Data' : 'Demo Data'}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 bg-[#151515] border border-white/10 rounded-xl shadow-xl py-1 w-56 animate-in z-50">
          <button
            onClick={() => { onSourceChange('demo'); setIsOpen(false); }}
            className={`w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-white/[0.04] transition-colors ${source === 'demo' ? 'bg-white/[0.03]' : ''}`}
          >
            <Database className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className={`text-xs font-medium ${source === 'demo' ? 'text-white' : 'text-white/60'}`}>Demo Data</p>
              <p className="text-[10px] text-white/25 mt-0.5">Sample BOMs for presentation and testing</p>
            </div>
          </button>
          <button
            onClick={() => { if (isLive) { onSourceChange('live'); setIsOpen(false); } }}
            disabled={!isLive}
            className={`w-full flex items-start gap-3 px-3 py-2.5 text-left transition-colors ${!isLive ? 'opacity-40 cursor-not-allowed' : 'hover:bg-white/[0.04]'} ${source === 'live' ? 'bg-white/[0.03]' : ''}`}
          >
            <Globe className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className={`text-xs font-medium ${source === 'live' && isLive ? 'text-white' : 'text-white/60'}`}>Live Arena Data</p>
              <p className="text-[10px] text-white/25 mt-0.5">
                {isLive ? 'Real-time from Arena PLM webhook' : 'Connect Arena webhook to enable'}
              </p>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
