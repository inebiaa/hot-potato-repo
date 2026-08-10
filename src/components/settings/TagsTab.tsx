import { useMemo, type Dispatch, type SetStateAction } from 'react';
import { FolderPlus, Trash2 } from 'lucide-react';
import IconPicker from '../IconPicker';
import { readableTextForBg } from '../../lib/colorUtils';
import { DEFAULT_ICONS, getIcon } from '../../lib/eventCardIcons';
import type { AppSettings } from '../../types/appSettings';

/** Faded (muted) preset: soft pastels, auto text color */
export const FADED_TAG_DEFAULTS: Record<string, string> = {
  producer_bg_color: '#f3f4f6', designer_bg_color: '#fef3c7', model_bg_color: '#fce7f3',
  hair_makeup_bg_color: '#f3e8ff', city_bg_color: '#dbeafe', season_bg_color: '#ffedd5',
  header_tags_bg_color: '#ccfbf1', countdown_bg_color: '#fef3c7', footer_tags_bg_color: '#d1fae5', optional_tags_bg_color: '#e0e7ff',
  special_guests_bg_color: '#e0e7ff',
};

/** Vibrant (bright) preset: saturated colors, auto text color */
export const BRIGHT_TAG_DEFAULTS: Record<string, string> = {
  producer_bg_color: '#fef08a', designer_bg_color: '#f9a8d4', model_bg_color: '#86efac',
  hair_makeup_bg_color: '#67e8f9', city_bg_color: '#bef264', season_bg_color: '#fdba74',
  header_tags_bg_color: '#c4b5fd', countdown_bg_color: '#fef3c7', footer_tags_bg_color: '#5eead4', optional_tags_bg_color: '#fda4af',
  special_guests_bg_color: '#a5b4fc',
};

export type ColorCollection = {
  id: string;
  name: string;
  colors: string[];
};

export type TagOption = {
  key: string;
  label: string;
};

export type TagsTabProps = {
  settings: AppSettings;
  setSettings: Dispatch<SetStateAction<AppSettings>>;
  onSettingsPreview?: (settings: AppSettings) => void;
  paletteColors: string[];
  editingColor: string | null;
  setEditingColor: (v: string | null) => void;
  editingHex: string;
  setEditingHex: (v: string) => void;
  editColorInPalette: (oldHex: string, newHex: string) => void;
  removeFromPalette: (hex: string) => void;
  addToPalette: (hex: string) => void;
  resetPaletteToDefaults: () => void;
  collections: ColorCollection[];
  createCollection: () => void;
  dragOverCollectionId: string | null;
  setDragOverCollectionId: (v: string | null) => void;
  addColorToCollection: (collectionId: string, hex: string) => void;
  updateCollectionName: (id: string, name: string) => void;
  deleteCollection: (id: string) => void;
  removeColorFromCollection: (collectionId: string, hex: string) => void;
  assigningTag: string | null;
  setAssigningTag: (v: string | null) => void;
  assignColorToTag: (tagKey: string, hex: string, close?: boolean) => void;
  tagOptions: TagOption[];
  coreTagOptions: TagOption[];
  setAsDefault: () => void;
  revertToDefault: () => void;
};

export default function TagsTab(p: TagsTabProps) {
  const {
    settings, setSettings, onSettingsPreview, paletteColors, editingColor, setEditingColor,
    editingHex, setEditingHex, editColorInPalette, removeFromPalette, addToPalette, resetPaletteToDefaults,
    collections, createCollection, dragOverCollectionId, setDragOverCollectionId, addColorToCollection,
    updateCollectionName, deleteCollection, removeColorFromCollection, assigningTag, setAssigningTag,
    assignColorToTag, tagOptions, coreTagOptions, setAsDefault, revertToDefault,
  } = p;

  return (
              <>
                <div className="space-y-5">
                  <section>
                    <h3 className="text-sm font-semibold text-gray-700 mb-1">Color scheme</h3>
                    <p className="text-xs text-gray-500 mb-2">Apply a preset palette. Faded = muted pastels, Vibrant = saturated.</p>
                    <div className="flex flex-wrap gap-2">
                      {(['faded', 'bright', 'custom'] as const).map((scheme) => {
                        const label = scheme === 'faded' ? 'Faded' : scheme === 'bright' ? 'Vibrant' : 'Custom';
                        const isActive = settings.color_scheme === scheme;
                        return (
                          <button
                            key={scheme}
                            type="button"
                            onClick={() => {
                              if (scheme === 'custom') {
                                setSettings((s) => ({ ...s, color_scheme: 'custom' }));
                                return;
                              }
                              const preset = scheme === 'faded' ? FADED_TAG_DEFAULTS : BRIGHT_TAG_DEFAULTS;
                              const updates: Record<string, string> = { color_scheme: scheme };
                              Object.entries(preset).forEach(([k, bg]) => {
                                updates[k] = bg;
                                const textKey = k.replace('_bg_color', '_text_color');
                                updates[textKey] = readableTextForBg(bg);
                              });
                              setSettings((s) => ({ ...s, ...updates }));
                              onSettingsPreview?.({ ...settings, ...updates });
                            }}
                            className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition-colors ${
                              isActive ? 'border-neutral-900 bg-neutral-100 text-neutral-800' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  <section>
                    <h3 className="text-sm font-semibold text-gray-700 mb-1">Palette</h3>
                    <p className="text-xs text-gray-500 mb-3">Click a swatch to edit, drag to a collection. Pick colors for tag types below.</p>
                    <div className="flex flex-wrap gap-2 items-center">
                      {paletteColors.map((hex) => (
                        <div key={hex} className="relative group">
                          {editingColor === hex ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={editingHex}
                                onChange={(e) => setEditingHex(e.target.value)}
                                className="w-20 px-1.5 py-0.5 text-xs border rounded"
                                placeholder="#ffffff"
                              />
                              <label className="inline-flex items-center justify-center w-8 h-8 rounded-lg border cursor-pointer">
                                <input
                                  type="color"
                                  value={editingHex}
                                  onChange={(e) => setEditingHex(e.target.value)}
                                  className="sr-only w-0 h-0"
                                />
                                <span className="w-full h-full rounded-lg" style={{ backgroundColor: editingHex || '#ccc' }} />
                              </label>
                              <button
                                type="button"
                                onClick={() => editColorInPalette(hex, editingHex)}
                                className="px-2 py-0.5 text-xs bg-neutral-900 text-white rounded"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingColor(null)}
                                className="text-gray-500 hover:text-gray-700"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <>
                              <span
                                draggable
                                onDragStart={(e) => {
                                  e.dataTransfer.setData('text/plain', hex);
                                  e.dataTransfer.effectAllowed = 'copy';
                                }}
                                className="inline-block w-8 h-8 rounded-lg border-2 border-gray-200 shadow-sm cursor-pointer select-none"
                                style={{ backgroundColor: hex, color: readableTextForBg(hex) }}
                                title={`${hex} (drag to collection)`}
                                onClick={() => { setEditingColor(hex); setEditingHex(hex); }}
                              />
                              <button
                                type="button"
                                onClick={() => removeFromPalette(hex)}
                                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-red-600"
                                aria-label={`Remove ${hex}`}
                              >
                                ×
                              </button>
                            </>
                          )}
                        </div>
                      ))}
                      <label className="inline-flex items-center justify-center w-8 h-8 rounded-lg border-2 border-dashed border-gray-300 text-gray-500 hover:border-gray-400 cursor-pointer">
                        <input
                          type="color"
                          className="sr-only w-0 h-0"
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v) addToPalette(v);
                          }}
                        />
                        <span className="text-lg leading-none">+</span>
                      </label>
                      <button
                        type="button"
                        onClick={resetPaletteToDefaults}
                        className="text-xs text-gray-500 hover:text-gray-800 font-medium"
                      >
                        Reset palette
                      </button>
                    </div>
                  </section>

                  <section>
                    <h3 className="text-sm font-semibold text-gray-700 mb-1">Collections</h3>
                    <p className="text-xs text-gray-500 mb-3">Group colors for quick access. Drag swatches from the palette above.</p>
                    <button
                      type="button"
                      onClick={createCollection}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-gray-100 hover:bg-gray-200 rounded-lg mb-3"
                    >
                      <FolderPlus size={14} />
                      New collection
                    </button>
                    <div className="space-y-2">
                      {collections.map((col) => (
                        <div
                          key={col.id}
                          className={`border rounded-lg p-2 transition-colors ${
                            dragOverCollectionId === col.id ? 'border-neutral-800 bg-neutral-100' : 'border-gray-200'
                          }`}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'copy';
                            setDragOverCollectionId(col.id);
                          }}
                          onDragLeave={() => setDragOverCollectionId(null)}
                          onDrop={(e) => {
                            e.preventDefault();
                            const hex = e.dataTransfer.getData('text/plain');
                            if (/^#[0-9a-fA-F]{6}$/.test(hex)) addColorToCollection(col.id, hex);
                            setDragOverCollectionId(null);
                          }}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <input
                              type="text"
                              value={col.name}
                              onChange={(e) => updateCollectionName(col.id, e.target.value)}
                              className="flex-1 text-sm font-medium border-0 border-b border-transparent hover:border-gray-200 focus:border-gray-400 focus:outline-none px-0 py-1"
                            />
                            <button
                              type="button"
                              onClick={() => deleteCollection(col.id)}
                              className="inline-flex items-center justify-center min-h-11 min-w-11 rounded-md text-red-500 hover:text-red-700 hover:bg-red-50"
                              aria-label="Delete collection"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-1.5 items-center min-h-[28px]">
                            {col.colors.map((c) => (
                              <span key={c} className="relative group">
                                <span
                                  className="inline-block w-9 h-9 sm:w-6 sm:h-6 rounded border border-gray-200"
                                  style={{ backgroundColor: c, color: readableTextForBg(c) }}
                                  title={c}
                                />
                                <button
                                  type="button"
                                  onClick={() => removeColorFromCollection(col.id, c)}
                                  className="absolute -top-1.5 -right-1.5 h-11 w-11 rounded-full bg-red-500 text-white text-sm font-semibold leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 max-sm:opacity-100"
                                  aria-label="Remove color from collection"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section>
                    <h3 className="text-sm font-semibold text-gray-700 mb-1">Tag colors</h3>
                    <p className="text-xs text-gray-500 mb-3">Click a tag type to assign a color from the palette.</p>
                    <div className="flex flex-wrap gap-2">
                      {tagOptions.map(({ key, label }) => {
                        const bgKey = key === 'optional_tags' ? 'optional_tags_bg_color' : `${key}_bg_color`;
                        const textKey = key === 'optional_tags' ? 'optional_tags_text_color' : `${key}_text_color`;
                        const bg = (settings as Record<string, string>)[bgKey] || '#e5e7eb';
                        const text = (settings as Record<string, string>)[textKey] || '#374151';
                        return (
                          <div key={key} className="relative">
                            <button
                              type="button"
                              onClick={() => setAssigningTag(assigningTag === key ? null : key)}
                              className="inline-flex items-center gap-2 px-2 py-1.5 rounded-lg border-2 border-gray-200 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-neutral-500 text-left"
                              style={{ backgroundColor: bg, color: text }}
                              title={`${label} — click to change`}
                            >
                              <span className="w-5 h-5 rounded border border-gray-300 shrink-0" style={{ backgroundColor: bg }} />
                              <span className="text-xs font-medium">{label}</span>
                            </button>
                            {assigningTag === key && (
                              <>
                                <div className="fixed inset-0 z-10" onClick={() => setAssigningTag(null)} aria-hidden="true" />
                                <div className="absolute left-0 top-full z-20 mt-1 p-3 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[220px]">
                                  <div className="text-xs font-medium text-gray-700 mb-2">{label}</div>
                                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mb-3">
                                    {(() => {
                                      const inPalette = new Set(paletteColors.map((h) => h.toLowerCase()));
                                      const options = inPalette.has(bg.toLowerCase()) ? paletteColors : [bg, ...paletteColors];
                                      return options;
                                    })().map((hex) => (
                                      <button
                                        key={hex}
                                        type="button"
                                        onClick={() => assignColorToTag(key, hex)}
                                        className={`min-h-11 min-w-11 sm:min-h-0 sm:min-w-0 w-11 h-11 sm:w-8 sm:h-8 rounded-lg border-2 shrink-0 flex items-center justify-center ${hex.toLowerCase() === bg.toLowerCase() ? 'border-gray-800 ring-1 ring-gray-800' : 'border-gray-200 hover:border-gray-400'}`}
                                        style={{ backgroundColor: hex }}
                                        title={hex}
                                      />
                                    ))}
                                  </div>
                                  <label className="inline-flex items-center min-h-11 gap-2 px-2 rounded-md border border-gray-200 hover:bg-gray-50 cursor-pointer text-xs font-medium text-gray-700">
                                    <input
                                      type="color"
                                      value={bg}
                                      onChange={(e) => {
                                        const v = e.target.value;
                                        assignColorToTag(key, v, false);
                                        addToPalette(v);
                                      }}
                                      className="h-11 w-16 min-w-[3rem] sm:h-8 sm:w-10 rounded border border-gray-200 cursor-pointer shrink-0"
                                    />
                                    <span>Custom</span>
                                  </label>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  <section>
                    <h3 className="text-sm font-semibold text-gray-700 mb-1">Icons</h3>
                    <p className="text-xs text-gray-500 mb-3">Choose an icon for each tag type.</p>
                    <div className="flex flex-wrap gap-2">
                      {coreTagOptions.map(({ key: k, label }) => (
                        <div key={k} className="flex flex-col items-center gap-1">
                          <span className="text-[10px] text-gray-500">{label}</span>
                          <IconPicker
                            label=""
                            value={(settings as Record<string, string>)[`${k}_icon`]}
                            onChange={(v) => setSettings((s) => ({ ...s, [`${k}_icon`]: v }))}
                          />
                        </div>
                      ))}
                    </div>
                  </section>

                  <section>
                    <h3 className="text-sm font-semibold text-gray-700 mb-1">Preview</h3>
                    <p className="text-xs text-gray-500 mb-3">Tag pills as they appear on event cards.</p>
                    <div className="flex flex-wrap gap-2">
                      {tagOptions.map(({ key: k, label }) => {
                        const bgKey = k === 'optional_tags' ? 'optional_tags_bg_color' : k === 'countdown' ? 'countdown_bg_color' : `${k}_bg_color`;
                        const textKey = k === 'optional_tags' ? 'optional_tags_text_color' : k === 'countdown' ? 'countdown_text_color' : `${k}_text_color`;
                        const bg = (settings as Record<string, string>)[bgKey] || '#e5e7eb';
                        const text = (settings as Record<string, string>)[textKey] || '#374151';
                        const iconName = k === 'optional_tags' || k === 'countdown' ? '' : (settings as Record<string, string>)[`${k}_icon`];
                        const IconC = !iconName ? null : getIcon(iconName, `${k}_icon` as keyof typeof DEFAULT_ICONS);
                        return (
                          <span
                            key={k}
                            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-gray-200"
                            style={{ backgroundColor: bg, color: text }}
                          >
                            {IconC && <IconC size={12} className="shrink-0" />}
                            {label}
                          </span>
                        );
                      })}
                    </div>
                  </section>

                  <section className="border-t pt-4 flex flex-wrap items-center gap-3">
                    <span className="text-xs font-medium text-gray-600">Defaults</span>
                    <button
                      type="button"
                      onClick={setAsDefault}
                      className="px-3 py-2 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
                    >
                      Save as default
                    </button>
                    <button
                      type="button"
                      onClick={revertToDefault}
                      className="px-3 py-2 text-xs font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
                    >
                      Reset to default
                    </button>
                  </section>
                </div>
              </>
  );
}
