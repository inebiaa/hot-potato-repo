import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { EVENT_CARD_ICONS, getIcon } from "../lib/eventCardIcons";
import { formControlClass, formControlPaddingClass } from "./ui/field";
import { cn } from "../lib/utils";

interface IconPickerProps {
  label: string;
  value: string;
  onChange: (iconName: string) => void;
}

const ICON_NAMES = Object.keys(EVENT_CARD_ICONS);

export default function IconPicker({
  label,
  value,
  onChange,
}: IconPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const IconComponent = getIcon(value, "producer_icon");
  const hasSelection = !!value;

  return (
    <div>
      {label && (
        <label className="mb-1 block text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            formControlClass,
            formControlPaddingClass,
            "flex min-h-10 items-center justify-center gap-2 hover:bg-muted",
          )}
          title={hasSelection ? value : "None"}
          aria-label={label || `Icon: ${hasSelection ? value : "None"}`}
        >
          {hasSelection ? (
            <IconComponent size={20} className="text-foreground shrink-0" />
          ) : (
            <span className="text-xs text-muted-foreground shrink-0">None</span>
          )}
          <ChevronDown
            size={14}
            className={`text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </button>
        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setIsOpen(false)}
              aria-hidden="true"
            />
            <div className="absolute left-0 z-20 mt-1 min-w-[220px] w-max max-w-[min(100vw,320px)] bg-card border border-border rounded-lg p-2 grid grid-cols-4 sm:grid-cols-6 gap-1">
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setIsOpen(false);
                }}
                className={`col-span-full min-h-11 px-3 text-sm sm:text-xs rounded-md border text-left ${!hasSelection ? "bg-muted border-input text-foreground" : "border-border text-muted-foreground hover:bg-muted"}`}
                title="No icon"
              >
                No icon
              </button>
              {ICON_NAMES.map((name) => {
                const Icon = EVENT_CARD_ICONS[name];
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => {
                      onChange(name);
                      setIsOpen(false);
                    }}
                    className={`min-h-11 min-w-11 rounded-md hover:bg-muted flex items-center justify-center ${value === name ? "bg-muted ring-1 ring-border" : ""}`}
                    title={name}
                  >
                    <Icon size={20} className="text-foreground" />
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
