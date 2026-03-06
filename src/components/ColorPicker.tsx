import { useEffect, useRef, useState } from 'react';
import { Palette, Plus, X } from 'lucide-react';
import { readableTextForBg } from '../lib/colorUtils';

interface ColorPickerProps {
  label?: string;
  bgValue: string;
  textValue: string;
  onBgChange: (value: string) => void;
  onTextChange: (value: string) => void;
  compact?: boolean;
  activeScheme?: 'faded' | 'bright' | 'custom';
  onApplyScheme?: (scheme: 'faded' | 'bright') => void;
  onSaveSchemeDefault?: (scheme: 'faded' | 'bright') => void;
  colorsByScheme?: Record<'faded' | 'bright', { name: string; bgHex: string }[]>;
}

export const CUSTOM_COLORS_STORAGE_KEY = 'tag_custom_colors_v1';

/** Curated swatches: faded (muted) first, then vibrant (saturated) */
export const PRELOADED_HEX = [
  /* Faded: neutrals and soft pastels */
  '#f8fafc', '#f1f5f9', '#e2e8f0', '#cbd5e1', '#94a3b8',
  '#fef3c7', '#fde68a', '#fce7f3', '#fbcfe8', '#f9a8d4',
  '#e9d5ff', '#d8b4fe', '#dbeafe', '#93c5fd',
  '#ccfbf1', '#5eead4', '#d1fae5', '#6ee7b7',
  '#e0e7ff', '#a5b4fc', '#ffedd5', '#fdba74',
  /* Vibrant: saturated accents */
  '#fcd34d', '#fbbf24', '#f472b6', '#c084fc', '#a78bfa',
  '#60a5fa', '#3b82f6', '#2dd4bf', '#14b8a6',
  '#34d399', '#10b981', '#818cf8', '#6366f1',
  '#fb923c', '#f97316',
];

const uniqueHexList = (colors: string[]) => {
  const seen = new Set<string>();
  const out: string[] = [];
  colors.forEach((hex) => {
    const normalized = hex.toLowerCase();
    if (seen.has(normalized)) return;
    seen.add(normalized);
    out.push(normalized);
  });
  return out;
};

export default function ColorPicker({
  label,
  bgValue,
  textValue,
  onBgChange,
  onTextChange,
  compact,
}: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [savedColors, setSavedColors] = useState<string[]>([]);
  const [manageMode, setManageMode] = useState(false);
  const longPressRef = useRef<number | null>(null);

  const persistSaved = (next: string[]) => {
    const u = uniqueHexList(next);
    setSavedColors(u);
    try {
      window.localStorage.setItem(CUSTOM_COLORS_STORAGE_KEY, JSON.stringify(u));
    } catch {
      // ignore
    }
  };

  const addCurrent = () => {
    if (!/^#[0-9a-fA-F]{6}$/.test(bgValue)) return;
    const n = bgValue.toLowerCase();
    if (savedColors.includes(n)) return;
    persistSaved([n, ...savedColors]);
  };

  const removeSaved = (hex: string) => {
    persistSaved(savedColors.filter((c) => c.toLowerCase() !== hex.toLowerCase()));
  };

  const startLongPress = () => {
    longPressRef.current = window.setTimeout(() => setManageMode(true), 450);
  };

  const clearLongPress = () => {
    if (longPressRef.current) {
      window.clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  };

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CUSTOM_COLORS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const valid = parsed.filter((v): v is string => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v));
        setSavedColors(uniqueHexList(valid));
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!isOpen) setManageMode(false);
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (longPressRef.current) window.clearTimeout(longPressRef.current);
    };
  }, []);

  const pick = (hex: string) => {
    onBgChange(hex);
    onTextChange(readableTextForBg(hex));
    setIsOpen(false);
  };

  const normalizedBg = (bgValue || '').toLowerCase();

  return (
    <div className={compact ? '' : 'space-y-2'}>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          className="w-full flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          title="Pick color"
          aria-label="Pick color"
        >
          <span
            className="w-6 h-6 rounded-md border border-gray-300 shrink-0"
            style={{ backgroundColor: bgValue, color: textValue }}
            aria-hidden="true"
          />
          <span className="text-sm text-gray-600 truncate">{bgValue || 'Pick'}</span>
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} aria-hidden="true" />
            <div className="absolute left-0 z-20 mt-1 min-w-[220px] w-max max-w-[min(100vw,300px)] max-h-80 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg p-3">
              <div className="text-xs font-medium text-gray-600 mb-2">Presets</div>
              <div className="grid grid-cols-6 gap-2">
                {PRELOADED_HEX.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => pick(hex)}
                    className={`w-8 h-8 rounded-md border shrink-0 ${hex.toLowerCase() === normalizedBg ? 'ring-2 ring-gray-800 border-gray-800' : 'border-gray-200 hover:scale-105'}`}
                    style={{ backgroundColor: hex, color: readableTextForBg(hex) }}
                    title={hex}
                  >
                    {hex.toLowerCase() === normalizedBg ? '✓' : ''}
                  </button>
                ))}
              </div>

              {savedColors.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-600">Saved</span>
                    {manageMode ? (
                      <button type="button" onClick={() => setManageMode(false)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                        Done
                      </button>
                    ) : (
                      <span className="text-[11px] text-gray-400">Long-press to remove</span>
                    )}
                  </div>
                  <div className="grid grid-cols-6 gap-2">
                    {savedColors.map((hex) => (
                      <div key={hex} className="relative">
                        <button
                          type="button"
                          onMouseDown={startLongPress}
                          onMouseUp={clearLongPress}
                          onMouseLeave={clearLongPress}
                          onTouchStart={startLongPress}
                          onTouchEnd={clearLongPress}
                          onClick={() => {
                            if (!manageMode) pick(hex);
                          }}
                          className={`w-8 h-8 rounded-md border shrink-0 ${hex === normalizedBg ? 'ring-2 ring-gray-800 border-gray-800' : 'border-gray-200 hover:scale-105'}`}
                          style={{ backgroundColor: hex, color: readableTextForBg(hex) }}
                          title={hex}
                        >
                          {hex === normalizedBg ? '✓' : ''}
                        </button>
                        {manageMode && (
                          <button
                            type="button"
                            onClick={() => removeSaved(hex)}
                            className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-white border border-gray-300 text-gray-500 hover:text-red-600 flex items-center justify-center"
                            aria-label="Delete"
                          >
                            <X size={10} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={addCurrent}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-gray-100 text-gray-700 text-xs font-medium hover:bg-gray-200"
                  title="Save current color to Saved"
                >
                  <Plus size={12} />
                  Save current
                </button>
                <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-gray-200 hover:bg-gray-50 cursor-pointer text-xs font-medium text-gray-700">
                  <Palette size={12} />
                  Custom hex
                  <input
                    type="color"
                    value={bgValue}
                    onChange={(e) => {
                      const v = e.target.value;
                      onBgChange(v);
                      onTextChange(readableTextForBg(v));
                      const norm = v.toLowerCase();
                      if (/^#[0-9a-fA-F]{6}$/.test(v) && !savedColors.includes(norm)) {
                        persistSaved([norm, ...savedColors]);
                      }
                    }}
                    className="sr-only"
                    aria-label="Custom color"
                  />
                </label>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
