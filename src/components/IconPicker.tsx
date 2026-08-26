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
      {label ? (
        <label className="mb-1 block type-callout font-medium text-foreground">
          {label}
        </label>
      ) : null}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            formControlClass,
            formControlPaddingClass,
            "flex min-h-10 w-full items-center gap-2 hover:bg-muted",
          )}
          title={hasSelection ? value : "None"}
          aria-label={label || `Icon: ${hasSelection ? value : "None"}`}
          aria-expanded={isOpen}
        >
          {hasSelection ? (
            <IconComponent size={20} className="shrink-0 text-foreground" />
          ) : (
            <span className="type-callout text-muted-foreground shrink-0">
              None
            </span>
          )}
          <span className="min-w-0 flex-1 truncate text-left type-callout text-muted-foreground">
            {hasSelection ? value : "Choose icon"}
          </span>
          <ChevronDown
            size={14}
            className={cn(
              "shrink-0 text-muted-foreground transition-transform",
              isOpen ? "rotate-180" : "",
            )}
            aria-hidden
          />
        </button>
        {isOpen ? (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setIsOpen(false)}
              aria-hidden="true"
            />
            <div
              className="absolute left-0 z-20 mt-1 min-w-[220px] w-max max-w-[min(100vw,320px)] rounded-lg border border-border bg-card p-2 grid grid-cols-4 sm:grid-cols-6 gap-1 shadow-lg"
              role="listbox"
              aria-label={label || "Choose icon"}
            >
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setIsOpen(false);
                }}
                className={cn(
                  "col-span-full min-h-9 rounded-md border px-3 text-left type-callout",
                  !hasSelection
                    ? "border-input bg-muted text-foreground"
                    : "border-border text-muted-foreground hover:bg-muted",
                )}
                title="No icon"
              >
                No icon
              </button>
              {ICON_NAMES.map((name) => {
                const Icon = EVENT_CARD_ICONS[name];
                const selected = value === name;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => {
                      onChange(name);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "flex min-h-9 min-w-9 items-center justify-center rounded-md hover:bg-muted",
                      selected ? "bg-muted ring-1 ring-border" : "",
                    )}
                    title={name}
                    aria-selected={selected}
                    role="option"
                  >
                    <Icon size={20} className="text-foreground" aria-hidden />
                  </button>
                );
              })}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
