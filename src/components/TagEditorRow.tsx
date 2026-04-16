import IconPicker from './IconPicker';
import ColorPicker from './ColorPicker';
import { getIcon } from '../lib/eventCardIcons';
import TagPillSplitLabel, { tagPillSplitContainerWithIconClass } from './TagPillSplitLabel';

interface TagEditorRowProps {
  label: string;
  iconValue: string;
  onIconChange: (v: string) => void;
  bgValue: string;
  textValue: string;
  onBgChange: (v: string) => void;
  onTextChange: (v: string) => void;
  activeScheme?: 'faded' | 'bright' | 'custom';
  onApplyScheme?: (scheme: 'faded' | 'bright') => void;
  onSaveSchemeDefault?: (scheme: 'faded' | 'bright') => void;
  colorsByScheme?: Record<'faded' | 'bright', { name: string; bgHex: string }[]>;
  compact?: boolean;
}

export default function TagEditorRow({
  label,
  iconValue,
  onIconChange,
  bgValue,
  textValue,
  onBgChange,
  onTextChange,
  activeScheme,
  onApplyScheme,
  onSaveSchemeDefault,
  colorsByScheme,
  compact,
}: TagEditorRowProps) {
  const PreviewIcon = getIcon(iconValue, 'producer_icon');
  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-3 py-3 border-b border-gray-100 last:border-0">
        <span className="w-24 text-sm font-medium text-gray-700 shrink-0">{label}</span>
        <div className="flex-1 min-w-0 flex flex-wrap items-center gap-3">
          <div className="w-36 shrink-0">
            <IconPicker label="" value={iconValue} onChange={onIconChange} />
          </div>
          <div className="w-36 shrink-0">
            <ColorPicker
              bgValue={bgValue}
              textValue={textValue}
              onBgChange={onBgChange}
              onTextChange={onTextChange}
              activeScheme={activeScheme}
              onApplyScheme={onApplyScheme}
              onSaveSchemeDefault={onSaveSchemeDefault}
              colorsByScheme={colorsByScheme}
              compact
            />
          </div>
          <span className={`${tagPillSplitContainerWithIconClass} p-0 text-xs`}>
            <PreviewIcon size={12} className="shrink-0" />
            <TagPillSplitLabel
              text="Sample tag"
              segmentColors={{ backgroundColor: bgValue, color: textValue }}
            />
          </span>
        </div>
      </div>
    );
  }
  return (
    <div className="p-4 rounded-lg border border-gray-200 bg-gray-50/50 space-y-4">
      <div className="font-medium text-gray-900">{label}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <IconPicker label="Icon" value={iconValue} onChange={onIconChange} />
        <ColorPicker
          label="Colors"
          bgValue={bgValue}
          textValue={textValue}
          onBgChange={onBgChange}
          onTextChange={onTextChange}
          activeScheme={activeScheme}
          onApplyScheme={onApplyScheme}
          onSaveSchemeDefault={onSaveSchemeDefault}
          colorsByScheme={colorsByScheme}
        />
      </div>
    </div>
  );
}
