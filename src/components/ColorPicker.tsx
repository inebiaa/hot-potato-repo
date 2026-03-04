interface ColorPickerProps {
  label?: string;
  bgValue: string;
  textValue: string;
  onBgChange: (value: string) => void;
  onTextChange: (value: string) => void;
  compact?: boolean;
}

const colors = [
  { name: 'Gray', bgHex: '#f3f4f6', textHex: '#374151', bgClass: 'bg-gray-100' },
  { name: 'Red', bgHex: '#fee2e2', textHex: '#b91c1c', bgClass: 'bg-red-100' },
  { name: 'Orange', bgHex: '#ffedd5', textHex: '#c2410c', bgClass: 'bg-orange-100' },
  { name: 'Amber', bgHex: '#fef3c7', textHex: '#b45309', bgClass: 'bg-amber-100' },
  { name: 'Green', bgHex: '#dcfce7', textHex: '#15803d', bgClass: 'bg-green-100' },
  { name: 'Emerald', bgHex: '#d1fae5', textHex: '#065f46', bgClass: 'bg-emerald-100' },
  { name: 'Teal', bgHex: '#ccfbf1', textHex: '#0f766e', bgClass: 'bg-teal-100' },
  { name: 'Blue', bgHex: '#dbeafe', textHex: '#1e40af', bgClass: 'bg-blue-100' },
  { name: 'Purple', bgHex: '#f3e8ff', textHex: '#7e22ce', bgClass: 'bg-purple-100' },
  { name: 'Pink', bgHex: '#fce7f3', textHex: '#be185d', bgClass: 'bg-pink-100' },
];

export default function ColorPicker({ label, bgValue, textValue, onBgChange, onTextChange, compact }: ColorPickerProps) {
  const handleColorClick = (bgHex: string, textHex: string) => {
    onBgChange(bgHex);
    onTextChange(textHex);
  };

  return (
    <div className={compact ? '' : 'space-y-2'}>
      {!compact && label && <label className="block text-sm font-medium text-gray-700">{label}</label>}
      {!compact && (
        <div className="flex items-center gap-3 mb-2">
          <div
            className="px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap"
            style={{ backgroundColor: bgValue, color: textValue }}
          >
            Sample Tag
          </div>
        </div>
      )}
      <div className={`flex gap-1 ${compact ? 'flex-wrap' : ''}`}>
        {colors.map((color) => (
          <button
            key={color.name}
            type="button"
            onClick={() => handleColorClick(color.bgHex, color.textHex)}
            className={`rounded-lg ${color.bgClass} border-2 ${
              bgValue === color.bgHex ? 'border-gray-900 ring-1 ring-gray-900' : 'border-transparent'
            } hover:scale-105 transition-transform ${compact ? 'w-6 h-6' : 'w-10 h-10'}`}
            title={color.name}
          />
        ))}
      </div>
    </div>
  );
}
