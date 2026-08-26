import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import { tagPillShellClass } from "../tagPillShell";
import { useT } from "../../hooks/useCopy";

const TYPE_FILTERS = [
  { id: "all", labelKey: "stats.filterAll" as const },
  { id: "designer", labelKey: "stats.filterDesigners" as const },
  { id: "artist", labelKey: "stats.filterArtists" as const },
];

interface PillColors {
  bg: string;
  text: string;
}

function FilterPill({
  active,
  onClick,
  label,
  activeColors,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  activeColors?: PillColors;
}) {
  const useTagFill = active && activeColors;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        tagPillShellClass,
        "shrink-0 transition-opacity hover:opacity-90",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        !useTagFill &&
          (active
            ? "bg-muted text-foreground"
            : "bg-muted/60 text-muted-foreground"),
      )}
      style={
        useTagFill
          ? {
              backgroundColor: activeColors.bg,
              color: activeColors.text,
            }
          : undefined
      }
    >
      {label}
    </button>
  );
}

function PillSelect({
  value,
  onChange,
  options,
  emphasized,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  emphasized?: boolean;
}) {
  return (
    <div className="relative shrink-0">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          tagPillShellClass,
          "appearance-none cursor-pointer pr-6 max-w-[14rem]",
          emphasized
            ? "bg-muted text-foreground"
            : "bg-muted/60 text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        )}
      >
        {options.map((option) => (
          <option key={option.value || "__empty"} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={12}
        className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
    </div>
  );
}

interface StatsFilterBarProps {
  selectedType: string;
  selectedCity: string;
  selectedSeason: string;
  sortBy: "count" | "name";
  allCities: string[];
  allSeasons: string[];
  getTagColors: (type: string) => PillColors;
  setSelectedType: (t: string) => void;
  setSelectedCity: (c: string) => void;
  setSelectedSeason: (s: string) => void;
  setSortBy: (s: "count" | "name") => void;
}

export default function StatsFilterBar({
  selectedType,
  selectedCity,
  selectedSeason,
  sortBy,
  allCities,
  allSeasons,
  getTagColors,
  setSelectedType,
  setSelectedCity,
  setSelectedSeason,
  setSortBy,
}: StatsFilterBarProps) {
  const t = useT();

  const cityOptions = [
    { value: "", label: t("stats.allCities") },
    ...allCities.map((city) => ({ value: city, label: city })),
  ];
  const seasonOptions = [
    { value: "", label: t("stats.allSeasons") },
    ...allSeasons.map((season) => ({ value: season, label: season })),
  ];
  const sortOptions = [
    { value: "count", label: t("stats.sortByCount") },
    { value: "name", label: t("stats.sortByName") },
  ];

  return (
    <div className="min-w-0 overflow-x-auto">
      <div className="flex flex-nowrap items-center gap-2">
        {TYPE_FILTERS.map(({ id, labelKey }) => {
          const active = selectedType === id;
          const colors = id === "all" ? undefined : getTagColors(id);
          return (
            <FilterPill
              key={id}
              active={active}
              label={t(labelKey)}
              activeColors={colors}
              onClick={() => {
                if (id === "all") {
                  setSelectedCity("");
                  setSelectedSeason("");
                }
                setSelectedType(id);
              }}
            />
          );
        })}
        <PillSelect
          value={selectedCity}
          onChange={setSelectedCity}
          options={cityOptions}
          emphasized={selectedCity !== ""}
        />
        <PillSelect
          value={selectedSeason}
          onChange={setSelectedSeason}
          options={seasonOptions}
          emphasized={selectedSeason !== ""}
        />
        <PillSelect
          value={sortBy}
          onChange={(v) => setSortBy(v as "count" | "name")}
          options={sortOptions}
          emphasized
        />
      </div>
    </div>
  );
}
