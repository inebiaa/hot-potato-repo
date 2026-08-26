import { BarChart3 } from "lucide-react";
import type { TagStats } from "./StatisticsPage";
import TagPillSplitLabel, { tagPillSplitContainerClass } from "./TagPillSplitLabel";
import StatsFilterBar from "./stats/StatsFilterBar";
import { TAG_PILL_ROW_CLASS, tagPillShellClass } from "./tagPillShell";
import { cn } from "../lib/utils";
import { LoadingSpinner, typeCallout, typeHeadline } from "./ui";
import { useT } from "../hooks/useCopy";

interface StatisticsPageContentProps {
  tagStats: TagStats[];
  events: unknown[];
  loading: boolean;
  selectedType: string;
  selectedCity: string;
  selectedSeason: string;
  allCities: string[];
  allSeasons: string[];
  sortBy: "count" | "name";
  getTagColors: (type: string) => { bg: string; text: string };
  setSelectedType: (t: string) => void;
  setSelectedCity: (c: string) => void;
  setSelectedSeason: (s: string) => void;
  setSortBy: (s: "count" | "name") => void;
  handleTagClick: (tag: TagStats) => void;
}

export default function StatisticsPageContent({
  tagStats,
  events,
  loading,
  selectedType,
  selectedCity,
  selectedSeason,
  allCities,
  allSeasons,
  sortBy,
  getTagColors,
  setSelectedType,
  setSelectedCity,
  setSelectedSeason,
  setSortBy,
  handleTagClick,
}: StatisticsPageContentProps) {
  const t = useT();
  const showCount = events.length;
  const tagsUnit =
    tagStats.length === 1 ? t("stats.tagSingular") : t("stats.tagPlural");
  const showsUnit =
    showCount === 1 ? t("stats.showSingular") : t("stats.showPlural");
  const footerText = t("stats.footer")
    .replace("{tagCount}", String(tagStats.length))
    .replace("{tagsUnit}", tagsUnit)
    .replace("{showCount}", String(showCount))
    .replace("{showsUnit}", showsUnit);

  return (
    <div className="space-y-6">
      <StatsFilterBar
        selectedType={selectedType}
        selectedCity={selectedCity}
        selectedSeason={selectedSeason}
        sortBy={sortBy}
        allCities={allCities}
        allSeasons={allSeasons}
        getTagColors={getTagColors}
        setSelectedType={setSelectedType}
        setSelectedCity={setSelectedCity}
        setSelectedSeason={setSelectedSeason}
        setSortBy={setSortBy}
      />

      <div>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : tagStats.length === 0 ? (
          <div className="text-center py-12">
            <BarChart3
              size={48}
              className="mx-auto text-muted-foreground mb-4"
            />
            <h3 className={`${typeHeadline} text-foreground mb-2`}>
              {t("stats.noTagsTitle")}
            </h3>
            <p className={`${typeCallout} text-muted-foreground`}>
              {t("stats.noTagsBody")}
            </p>
          </div>
        ) : (
          <div className={TAG_PILL_ROW_CLASS}>
            {tagStats.map((stat, idx) => {
              const colors = getTagColors(stat.type);
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleTagClick(stat)}
                  className={cn(
                    tagPillShellClass,
                    "max-w-full text-left transition-opacity hover:opacity-90",
                  )}
                  style={{ backgroundColor: colors.bg, color: colors.text }}
                >
                  <span className={`${tagPillSplitContainerClass} min-w-0`}>
                    <TagPillSplitLabel text={stat.name} />
                  </span>
                  <span className="font-semibold tabular-nums whitespace-nowrap shrink-0">
                    {stat.count}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <p className={`${typeCallout} text-muted-foreground`}>{footerText}</p>
    </div>
  );
}
