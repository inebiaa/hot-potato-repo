import IconPicker from './IconPicker';
import ColorPicker from './ColorPicker';

interface TagEditorRowProps {
  label: string;
  iconValue: string;
  onIconChange: (v: string) => void;
  bgValue: string;
  textValue: string;
  onBgChange: (v: string) => void;
  onTextChange: (v: string) => void;
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
  compact,
}: TagEditorRowProps) {
  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-3 py-2 border-b border-gray-100 last:border-0">
        <span className="w-24 text-sm font-medium text-gray-700 shrink-0">{label}</span>
        <div className="flex-1 min-w-0 flex items-center gap-3">
          <div className="w-32 shrink-0">
            <IconPicker label="" value={iconValue} onChange={onIconChange} />
          </div>
          <div className="flex-1 min-w-[140px]">
            <ColorPicker bgValue={bgValue} textValue={textValue} onBgChange={onBgChange} onTextChange={onTextChange} compact />
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="p-4 rounded-lg border border-gray-200 bg-gray-50/50 space-y-4">
      <div className="font-medium text-gray-900">{label}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <IconPicker label="Icon" value={iconValue} onChange={onIconChange} />
        <ColorPicker label="Colors" bgValue={bgValue} textValue={textValue} onBgChange={onBgChange} onTextChange={onTextChange} />
      </div>
    </div>
  );
}
