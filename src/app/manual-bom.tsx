"use client";

import { useState, useCallback } from 'react';
import { X, Upload, Search, Plus, Trash2, Loader2, Sparkles, ClipboardPaste } from 'lucide-react';

interface ManualBomItem {
  partNumber: string;
  description: string;
  qty: number;
}

interface ManualBomDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (bom: { name: string; engineer: string; items: ManualBomItem[] }) => void;
  isAnalyzing: boolean;
}

export function ManualBomDrawer({ isOpen, onClose, onSubmit, isAnalyzing }: ManualBomDrawerProps) {
  const [mode, setMode] = useState<'paste' | 'manual'>('paste');
  const [bomName, setBomName] = useState('');
  const [engineer, setEngineer] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [items, setItems] = useState<ManualBomItem[]>([
    { partNumber: '', description: '', qty: 1 },
  ]);

  const addItem = useCallback(() => {
    setItems(prev => [...prev, { partNumber: '', description: '', qty: 1 }]);
  }, []);

  const removeItem = useCallback((index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  }, []);

  const updateItem = useCallback((index: number, field: keyof ManualBomItem, value: string | number) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  }, []);

  const parsePastedText = useCallback((text: string): ManualBomItem[] => {
    const lines = text.trim().split('\n').filter(l => l.trim());
    return lines.map(line => {
      // Try tab-separated: partNumber \t description \t qty
      const tabs = line.split('\t');
      if (tabs.length >= 2) {
        return {
          partNumber: tabs[0].trim(),
          description: tabs[1]?.trim() || '',
          qty: parseInt(tabs[2]) || 1,
        };
      }
      // Try comma-separated
      const commas = line.split(',');
      if (commas.length >= 2) {
        return {
          partNumber: commas[0].trim(),
          description: commas[1]?.trim() || '',
          qty: parseInt(commas[2]) || 1,
        };
      }
      // Single value — treat as part number
      return { partNumber: line.trim(), description: '', qty: 1 };
    });
  }, []);

  const handleSubmit = useCallback(() => {
    const finalItems = mode === 'paste' ? parsePastedText(pasteText) : items.filter(i => i.partNumber.trim());
    if (finalItems.length === 0) return;
    onSubmit({
      name: bomName || 'Manual BOM',
      engineer: engineer || 'Manual Entry',
      items: finalItems,
    });
  }, [mode, pasteText, items, bomName, engineer, onSubmit, parsePastedText]);

  const handleReset = useCallback(() => {
    setBomName('');
    setEngineer('');
    setPasteText('');
    setItems([{ partNumber: '', description: '', qty: 1 }]);
  }, []);

  const itemCount = mode === 'paste' 
    ? pasteText.trim().split('\n').filter(l => l.trim()).length 
    : items.filter(i => i.partNumber.trim()).length;

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={onClose} />
      
      {/* Drawer */}
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center animate-in">
        <div className="w-full max-w-3xl bg-[#111] border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[85vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
            <div>
              <h2 className="text-sm font-medium text-white">Add BOM Manually</h2>
              <p className="text-[11px] text-white/30 mt-0.5">Paste part numbers or enter them individually for price comparison</p>
            </div>
            <button onClick={onClose} className="p-2 text-white/30 hover:text-white/60 hover:bg-white/[0.05] rounded-lg transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {/* BOM Info */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-mono text-white/30 uppercase tracking-wider mb-1.5 block">BOM Name</label>
                <input
                  type="text"
                  value={bomName}
                  onChange={(e) => setBomName(e.target.value)}
                  placeholder="e.g. Gripper Assembly v3.2"
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/15 focus:outline-none focus:border-emerald-500/30 focus:ring-1 focus:ring-emerald-500/20 transition-all"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono text-white/30 uppercase tracking-wider mb-1.5 block">Engineer</label>
                <input
                  type="text"
                  value={engineer}
                  onChange={(e) => setEngineer(e.target.value)}
                  placeholder="e.g. Sarah Chen"
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/15 focus:outline-none focus:border-emerald-500/30 focus:ring-1 focus:ring-emerald-500/20 transition-all"
                />
              </div>
            </div>

            {/* Mode Toggle */}
            <div className="flex gap-1 p-0.5 bg-white/[0.03] rounded-lg border border-white/[0.06] w-fit">
              <button
                onClick={() => setMode('paste')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono rounded-md transition-all ${mode === 'paste' ? 'bg-white/10 text-white border border-white/15' : 'text-white/30 hover:text-white/50 border border-transparent'}`}
              >
                <ClipboardPaste className="w-3 h-3" /> Paste Parts
              </button>
              <button
                onClick={() => setMode('manual')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono rounded-md transition-all ${mode === 'manual' ? 'bg-white/10 text-white border border-white/15' : 'text-white/30 hover:text-white/50 border border-transparent'}`}
              >
                <Plus className="w-3 h-3" /> Enter Individually
              </button>
            </div>

            {/* Paste Mode */}
            {mode === 'paste' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] font-mono text-white/30 uppercase tracking-wider">Part Numbers</label>
                  <span className="text-[10px] text-white/20">{itemCount} parts detected</span>
                </div>
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={"Paste part numbers — one per line, or tab/comma separated:\n\nMCM-91251A123\tSocket Head Cap Screw M5\t24\nMCM-5234K57\tAluminum 6061 Round Bar\t4\nDK-1N4148W-FDICT\tDiode Small Signal\t50\n\nOr just paste the part numbers:\nMCM-91251A123\nMCM-5234K57\n93600A235"}
                  className="w-full h-40 bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white font-mono placeholder:text-white/10 focus:outline-none focus:border-emerald-500/30 focus:ring-1 focus:ring-emerald-500/20 resize-none transition-all leading-relaxed"
                />
                <p className="text-[10px] text-white/20 mt-1.5">
                  Accepts: McMaster part numbers, Grainger item numbers, DigiKey/Mouser part numbers. Tab or comma separated with optional description and quantity.
                </p>
              </div>
            )}

            {/* Manual Entry Mode */}
            {mode === 'manual' && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-mono text-white/30 uppercase tracking-wider">Parts List</label>
                  <span className="text-[10px] text-white/20">{itemCount} parts</span>
                </div>
                <div className="space-y-2">
                  {/* Column headers */}
                  <div className="grid grid-cols-[1fr_1.5fr_60px_32px] gap-2 px-1">
                    <span className="text-[9px] font-mono text-white/20 uppercase">Part Number</span>
                    <span className="text-[9px] font-mono text-white/20 uppercase">Description (optional)</span>
                    <span className="text-[9px] font-mono text-white/20 uppercase">Qty</span>
                    <span></span>
                  </div>
                  {items.map((item, i) => (
                    <div key={i} className="grid grid-cols-[1fr_1.5fr_60px_32px] gap-2">
                      <input
                        type="text"
                        value={item.partNumber}
                        onChange={(e) => updateItem(i, 'partNumber', e.target.value)}
                        placeholder="MCM-91251A123"
                        className="bg-white/[0.03] border border-white/[0.08] rounded-lg px-2.5 py-2 text-xs text-white font-mono placeholder:text-white/15 focus:outline-none focus:border-emerald-500/30 transition-all"
                      />
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => updateItem(i, 'description', e.target.value)}
                        placeholder="Socket Head Cap Screw"
                        className="bg-white/[0.03] border border-white/[0.08] rounded-lg px-2.5 py-2 text-xs text-white placeholder:text-white/15 focus:outline-none focus:border-emerald-500/30 transition-all"
                      />
                      <input
                        type="number"
                        value={item.qty}
                        onChange={(e) => updateItem(i, 'qty', parseInt(e.target.value) || 1)}
                        min={1}
                        className="bg-white/[0.03] border border-white/[0.08] rounded-lg px-2 py-2 text-xs text-white text-center font-mono focus:outline-none focus:border-emerald-500/30 transition-all"
                      />
                      <button
                        onClick={() => removeItem(i)}
                        disabled={items.length <= 1}
                        className="flex items-center justify-center text-white/15 hover:text-red-400/60 disabled:opacity-30 disabled:hover:text-white/15 rounded-lg hover:bg-red-500/[0.05] transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={addItem}
                  className="mt-2 flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-white/30 hover:text-white/60 hover:bg-white/[0.03] rounded-lg transition-all border border-dashed border-white/[0.08] hover:border-white/15 w-full justify-center"
                >
                  <Plus className="w-3 h-3" /> Add Part
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-white/[0.06] bg-white/[0.01]">
            <button
              onClick={handleReset}
              className="text-[11px] text-white/30 hover:text-white/50 transition-colors"
            >
              Clear all
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-xs text-white/40 hover:text-white/60 hover:bg-white/[0.03] rounded-lg transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={itemCount === 0 || isAnalyzing}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 text-emerald-400 text-xs font-medium rounded-lg hover:bg-emerald-500/30 transition-all border border-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isAnalyzing ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Querying vendor APIs...</>
                ) : (
                  <><Sparkles className="w-3.5 h-3.5" /> Analyze {itemCount} Parts</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
