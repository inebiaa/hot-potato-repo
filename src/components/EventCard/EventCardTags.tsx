import { useMemo, useState, type ReactNode } from "react";
import { Event } from "../../lib/supabase";
import { getIcon } from "../../lib/eventCardIcons";
import { getSeasonFromDate } from "../../lib/season";
import TagPillSplitLabel, {
  tagPillSplitSegmentGroupClass,
} from "../TagPillSplitLabel";
import { TAG_PILL_ROW_CLASS, tagPillShellClass } from "../tagPillShell";
import { useTagDisplayMap } from "../../contexts/TagDisplayContext";
import { tagResolutionKey } from "../../lib/tagDisplayResolution";
import { tryNormalizeExternalUrl } from "../../lib/externalUrl";
import { isEventUpcoming } from "../../lib/eventDates";
import { clearExpiredCountdownLink } from "../../lib/clearExpiredCountdownLink";
import EventCountdownPill from "../EventCountdownPill";
import { effectiveHeaderTags } from "../../lib/eventHeaderTags";
import { coalesceTagList } from "../../lib/eventTagArray";
import {
  normalizeShowType,
  starringColumn,
  starringTagType,
} from "../../lib/showType";
import { useT } from "../../hooks/useCopy";
import { getSpecialGuests, isSpecialGuestsSlug } from "../../lib/specialGuests";
import type { TagColorsForPills } from "../tagCards/types";

/** City / season / genre: shared pill shell + hover (same metrics as TagInput chips). */
const HEADER_ICON_INSIDE_PILL_CLASS = `${tagPillShellClass} transition-colors hover:opacity-80`;

function normalizeCustomCategoryKey(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getCustomCategorySortRank(
  slug: string,
  hasPresentedBy: boolean,
): number {
  const key = normalizeCustomCategoryKey(slug);
  if (key === "specialguests") return -1;
  if (key === "hostedby") return 0;
  if (key === "performanceby") return 1;
  if (key === "benefiting") return hasPresentedBy ? 3 : 999;
  if (key === "presentedby") return 1000;
  return 2;
}

const TAG_LIMIT = 3; // show 3 pills, then +N

interface EventCardTagsProps {
  event: Event;
  onTagClick: (type: string, value: string, displayLabel?: string) => void;
  onEventUpdated: () => void;
  tagColors?: TagColorsForPills;
  /** Date / location (and anything else) between header pills and body tag sections. */
  afterHeader?: ReactNode;
  /** Ratings block between body tag sections and footer tags. */
  afterBody?: ReactNode;
}

export default function EventCardTags({
  event,
  onTagClick,
  onEventUpdated,
  tagColors,
  afterHeader,
  afterBody,
}: EventCardTagsProps) {
  const t = useT();
  const [expandedTagSections, setExpandedTagSections] = useState<
    Record<string, boolean>
  >({});

  const tagsBySection = useMemo(
    () => ({
      producers: coalesceTagList(event.producers),
      featured_designers: coalesceTagList(event.featured_designers),
      featured_artists: coalesceTagList(event.featured_artists),
      hair_makeup: coalesceTagList(event.hair_makeup),
      header_tags: effectiveHeaderTags(event),
      footer_tags: coalesceTagList(event.footer_tags),
    }),
    [event],
  );

  const customTags = useMemo(
    () =>
      event.custom_tags &&
      typeof event.custom_tags === "object" &&
      !Array.isArray(event.custom_tags)
        ? (event.custom_tags as Record<string, string[]>)
        : {},
    [event.custom_tags],
  );

  const toggleTagSection = (key: string) => {
    setExpandedTagSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };
  const tagDisplayMap = useTagDisplayMap();
  const resolveTag = (tagType: string, raw: string) => {
    const entry = tagDisplayMap?.get(tagResolutionKey(tagType, raw));
    return {
      /** Always the exact string on the event; identities must not relabel the card. */
      display: raw,
      canonical: entry?.canonical ?? raw,
      identityId: entry?.identityId ?? null,
    };
  };

  /** Filter-drag payload for search bar (not tag repositioning). */
  const tagFilterDragProps = (dragType: string, dragValue: string) => ({
    draggable: true as const,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.setData(
        "text/plain",
        `tag-filter:${dragType}:${dragValue}`,
      );
      e.dataTransfer.effectAllowed = "copy";
    },
  });

  const countdownOpenUrl = useMemo(
    () => tryNormalizeExternalUrl(event.countdown_link),
    [event.countdown_link],
  );

  const ProducerIcon = getIcon(tagColors?.producer_icon, "producer_icon");
  const DesignerIcon = getIcon(tagColors?.designer_icon, "designer_icon");
  const HairMakeupIcon = getIcon(
    tagColors?.hair_makeup_icon,
    "hair_makeup_icon",
  );
  const CityIcon = getIcon(tagColors?.city_icon, "city_icon");
  const SeasonIcon = getIcon(tagColors?.season_icon, "season_icon");
  const HeaderTagsIcon = getIcon(
    tagColors?.header_tags_icon,
    "header_tags_icon",
  );

  return (
    <>
      <div className={`${TAG_PILL_ROW_CLASS} mb-2`}>
        {event.city && (
          <button
            data-tag-pill
            onClick={() => onTagClick("city", event.city, event.city)}
            {...tagFilterDragProps("city", event.city)}
            className={HEADER_ICON_INSIDE_PILL_CLASS}
            style={{
              backgroundColor: tagColors?.city_bg_color || "#dbeafe",
              color: tagColors?.city_text_color || "#1e40af",
            }}
          >
            <CityIcon size={12} className="shrink-0" />
            <span className="min-w-0 max-w-full text-left">
              <TagPillSplitLabel fitToContainer text={event.city} />
            </span>
          </button>
        )}
        {(() => {
          const season = getSeasonFromDate(event.date);
          return (
            <button
              data-tag-pill
              onClick={() => onTagClick("season", season, season)}
              {...tagFilterDragProps("season", season)}
              className={HEADER_ICON_INSIDE_PILL_CLASS}
              style={{
                backgroundColor: tagColors?.season_bg_color || "#ffedd5",
                color: tagColors?.season_text_color || "#c2410c",
              }}
            >
              <SeasonIcon size={12} className="shrink-0" />
              <span className="min-w-0 max-w-full text-left">
                <TagPillSplitLabel fitToContainer text={season} />
              </span>
            </button>
          );
        })()}
      </div>

      {(() => {
        const tags = tagsBySection.header_tags || [];
        const hasHeader =
          tags.length > 0 || !!(event.date && isEventUpcoming(event.date));
        if (!hasHeader) return null;
        const showMore =
          tags.length > TAG_LIMIT && !expandedTagSections["header_tags"];
        const visible = showMore ? tags.slice(0, TAG_LIMIT) : tags;
        return (
          <div className="mb-3">
            <div className={TAG_PILL_ROW_CLASS}>
              {visible.map((tag, idx) => (
                <button
                  key={idx}
                  onClick={() =>
                    onTagClick(
                      "header_tags",
                      resolveTag("header_tags", tag).identityId || tag,
                      tag,
                    )
                  }
                  data-tag-pill
                  className={`${tagPillSplitSegmentGroupClass} p-0 text-xs transition-colors hover:opacity-80`}
                  {...tagFilterDragProps("header_tags", tag)}
                >
                  <TagPillSplitLabel
                    fitToContainer
                    leadingSlot={
                      <HeaderTagsIcon
                        size={12}
                        className="shrink-0"
                        aria-hidden
                      />
                    }
                    text={resolveTag("header_tags", tag).display}
                    segmentColors={{
                      backgroundColor:
                        tagColors?.header_tags_bg_color || "#ccfbf1",
                      color: tagColors?.header_tags_text_color || "#0f766e",
                    }}
                  />
                </button>
              ))}
              {event.date && isEventUpcoming(event.date) && (
                <EventCountdownPill
                  eventDate={event.date}
                  eventName={event.name}
                  countdownOpenUrl={countdownOpenUrl}
                  countdownBg={tagColors?.countdown_bg_color}
                  countdownText={tagColors?.countdown_text_color}
                  onExpired={() => {
                    void (async () => {
                      if (event.countdown_link) {
                        await clearExpiredCountdownLink(event.id);
                      }
                      onEventUpdated();
                    })();
                  }}
                  onButtonClick={() => {
                    if (countdownOpenUrl)
                      window.open(
                        countdownOpenUrl,
                        "_blank",
                        "noopener,noreferrer",
                      );
                  }}
                />
              )}
              {tags.length > TAG_LIMIT && (
                <button
                  type="button"
                  onClick={() => toggleTagSection("header_tags")}
                  className="text-xs text-muted-foreground hover:text-muted-foreground inline-flex items-center shrink-0 justify-center rounded-md"
                  title={
                    expandedTagSections["header_tags"]
                      ? "Show less"
                      : "View more tags"
                  }
                >
                  {expandedTagSections["header_tags"]
                    ? "−"
                    : `+${tags.length - TAG_LIMIT}`}
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {afterHeader}

      <div className="space-y-3 mb-4 pt-4 border-t">
        {(() => {
          const starringKey = starringColumn(event.show_type);
          const starringType = starringTagType(event.show_type);
          const tags = tagsBySection[starringKey];
          if (!(tags?.length > 0)) return null;
          const expandKey =
            starringKey === "featured_artists" ? "artists" : "designers";
          const showMore =
            tags.length > TAG_LIMIT && !expandedTagSections[expandKey];
          const visible = showMore ? tags.slice(0, TAG_LIMIT) : tags;
          const pillColors = {
            backgroundColor: tagColors?.designer_bg_color || "#fef3c7",
            color: tagColors?.designer_text_color || "#b45309",
          };
          return (
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-foreground mb-1">
                <div className="flex items-center">
                  <DesignerIcon size={14} className="mr-1" />
                  {t("event.starring")}
                </div>
              </div>
              <div className={TAG_PILL_ROW_CLASS}>
                {visible.map((name, idx) => (
                  <button
                    key={idx}
                    onClick={() =>
                      onTagClick(
                        starringType,
                        resolveTag(starringType, name).identityId || name,
                        name,
                      )
                    }
                    data-tag-pill
                    className={`${tagPillSplitSegmentGroupClass} p-0 text-xs transition-colors hover:opacity-80`}
                    {...tagFilterDragProps(starringType, name)}
                  >
                    <TagPillSplitLabel
                      fitToContainer
                      text={resolveTag(starringType, name).display}
                      segmentColors={pillColors}
                    />
                  </button>
                ))}
                {tags.length > TAG_LIMIT && (
                  <button
                    type="button"
                    onClick={() => toggleTagSection(expandKey)}
                    className="text-xs text-muted-foreground hover:text-muted-foreground inline-flex shrink-0 items-center justify-center rounded-md"
                    title={
                      expandedTagSections[expandKey]
                        ? "Show less"
                        : "View more tags"
                    }
                  >
                    {expandedTagSections[expandKey]
                      ? "−"
                      : `+${tags.length - TAG_LIMIT}`}
                  </button>
                )}
              </div>
            </div>
          );
        })()}

        {(() => {
          const tags = getSpecialGuests(customTags);
          if (!(tags.length > 0)) {
            return null;
          }
          const showMore =
            tags.length > TAG_LIMIT && !expandedTagSections["special_guests"];
          const visible = showMore ? tags.slice(0, TAG_LIMIT) : tags;
          const SpecialGuestsIcon = getIcon(
            tagColors?.special_guests_icon,
            "special_guests_icon",
          );
          const pillColors = {
            backgroundColor:
              tagColors?.special_guests_bg_color ??
              tagColors?.optional_tags_bg_color ??
              "#e0e7ff",
            color:
              tagColors?.special_guests_text_color ??
              tagColors?.optional_tags_text_color ??
              "#3730a3",
          };
          return (
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-foreground mb-1">
                <div className="flex items-center">
                  <SpecialGuestsIcon size={14} className="mr-1" />
                  {t(
                    tags.length === 1
                      ? "event.specialGuest"
                      : "event.specialGuests",
                  )}
                </div>
              </div>
              <div className={TAG_PILL_ROW_CLASS}>
                {visible.map((name, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      const r = resolveTag("artist", name);
                      onTagClick("artist", r.identityId || name, name);
                    }}
                    data-tag-pill
                    className={`${tagPillSplitSegmentGroupClass} p-0 text-xs transition-colors hover:opacity-80`}
                    {...tagFilterDragProps("artist", name)}
                  >
                    <TagPillSplitLabel
                      fitToContainer
                      text={resolveTag("artist", name).display}
                      segmentColors={pillColors}
                    />
                  </button>
                ))}
                {tags.length > TAG_LIMIT && (
                  <button
                    type="button"
                    onClick={() => toggleTagSection("special_guests")}
                    className="text-xs text-muted-foreground hover:text-muted-foreground inline-flex shrink-0 items-center justify-center rounded-md"
                    title={
                      expandedTagSections["special_guests"]
                        ? "Show less"
                        : "View more tags"
                    }
                  >
                    {expandedTagSections["special_guests"]
                      ? "−"
                      : `+${tags.length - TAG_LIMIT}`}
                  </button>
                )}
              </div>
            </div>
          );
        })()}

        {tagsBySection.producers?.length > 0 &&
          (() => {
            const tags = tagsBySection.producers;
            const showMore =
              tags.length > TAG_LIMIT && !expandedTagSections["producers"];
            const visible = showMore ? tags.slice(0, TAG_LIMIT) : tags;
            return (
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-foreground mb-1">
                  <div className="flex items-center">
                    <ProducerIcon size={14} className="mr-1" />
                    {t("event.producedBy")}
                  </div>
                </div>
                <div className={TAG_PILL_ROW_CLASS}>
                  {visible.map((producer, idx) => (
                    <button
                      key={idx}
                      onClick={() =>
                        onTagClick(
                          "producer",
                          resolveTag("producer", producer).identityId ||
                            producer,
                          producer,
                        )
                      }
                      data-tag-pill
                      className={`${tagPillSplitSegmentGroupClass} p-0 text-xs transition-colors hover:opacity-80`}
                      {...tagFilterDragProps("producer", producer)}
                    >
                      <TagPillSplitLabel
                        fitToContainer
                        text={resolveTag("producer", producer).display}
                        segmentColors={{
                          backgroundColor:
                            tagColors?.producer_bg_color || "#f3f4f6",
                          color: tagColors?.producer_text_color || "#374151",
                        }}
                      />
                    </button>
                  ))}
                  {tags.length > TAG_LIMIT && (
                    <button
                      type="button"
                      onClick={() => toggleTagSection("producers")}
                      className="text-xs text-muted-foreground hover:text-muted-foreground inline-flex shrink-0 items-center justify-center rounded-md"
                      title={
                        expandedTagSections["producers"]
                          ? "Show less"
                          : "View more tags"
                      }
                    >
                      {expandedTagSections["producers"]
                        ? "−"
                        : `+${tags.length - TAG_LIMIT}`}
                    </button>
                  )}
                </div>
              </div>
            );
          })()}

        {normalizeShowType(event.show_type) === "fashion" &&
          tagsBySection.hair_makeup?.length > 0 &&
          (() => {
            const tags = tagsBySection.hair_makeup;
            const showMore =
              tags.length > TAG_LIMIT && !expandedTagSections["hair_makeup"];
            const visible = showMore ? tags.slice(0, TAG_LIMIT) : tags;
            return (
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-foreground mb-1">
                  <div className="flex items-center">
                    <HairMakeupIcon size={14} className="mr-1" />
                    {t("event.hairMakeup")}
                  </div>
                </div>
                <div className={TAG_PILL_ROW_CLASS}>
                  {visible.map((artist, idx) => (
                    <button
                      key={idx}
                      onClick={() =>
                        onTagClick(
                          "hair_makeup",
                          resolveTag("hair_makeup", artist).identityId ||
                            artist,
                          artist,
                        )
                      }
                      data-tag-pill
                      className={`${tagPillSplitSegmentGroupClass} p-0 text-xs transition-colors hover:opacity-80`}
                      {...tagFilterDragProps("hair_makeup", artist)}
                    >
                      <TagPillSplitLabel
                        fitToContainer
                        text={resolveTag("hair_makeup", artist).display}
                        segmentColors={{
                          backgroundColor:
                            tagColors?.hair_makeup_bg_color || "#f3e8ff",
                          color: tagColors?.hair_makeup_text_color || "#7e22ce",
                        }}
                      />
                    </button>
                  ))}
                  {tags.length > TAG_LIMIT && (
                    <button
                      type="button"
                      onClick={() => toggleTagSection("hair_makeup")}
                      className="text-xs text-muted-foreground hover:text-muted-foreground inline-flex shrink-0 items-center justify-center rounded-md"
                      title={
                        expandedTagSections["hair_makeup"]
                          ? "Show less"
                          : "View more tags"
                      }
                    >
                      {expandedTagSections["hair_makeup"]
                        ? "−"
                        : `+${tags.length - TAG_LIMIT}`}
                    </button>
                  )}
                </div>
              </div>
            );
          })()}

        {(() => {
          const ct = customTags;
          const meta =
            event.custom_tag_meta && typeof event.custom_tag_meta === "object"
              ? event.custom_tag_meta
              : {};
          const slugToLabel = (s: string) =>
            s
              .split("-")
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
              .join(" ");
          const sharedBg = tagColors?.optional_tags_bg_color ?? "#e0e7ff";
          const sharedText = tagColors?.optional_tags_text_color ?? "#3730a3";
          const allTagDefs = Object.keys(ct)
            .filter((slug) => !isSpecialGuestsSlug(slug))
            .map((slug) => ({
              id: slug,
              slug,
              label: slugToLabel(slug),
              icon: meta[slug]?.icon ?? "Tag",
              bg_color: sharedBg,
              text_color: sharedText,
            }));
          const hasPresentedBy = allTagDefs.some(
            (tagDef) =>
              normalizeCustomCategoryKey(tagDef.slug) === "presentedby",
          );
          return allTagDefs
            .sort((a, b) => {
              const rankDiff =
                getCustomCategorySortRank(a.slug, hasPresentedBy) -
                getCustomCategorySortRank(b.slug, hasPresentedBy);
              if (rankDiff !== 0) return rankDiff;
              return a.label.localeCompare(b.label, undefined, {
                sensitivity: "base",
              });
            })
            .map((tagDef) => {
              const tags = ct[tagDef.slug];
              if (!tags || tags.length === 0) return null;
              const CustomIcon = getIcon(tagDef.icon, "producer_icon");
              const showMore =
                tags.length > TAG_LIMIT &&
                !expandedTagSections[`custom_${tagDef.slug}`];
              const visible = showMore ? tags.slice(0, TAG_LIMIT) : tags;
              return (
                <div key={tagDef.id ?? tagDef.slug}>
                  <div className="flex items-center justify-between text-xs font-semibold text-foreground mb-1">
                    <div className="flex items-center">
                      <CustomIcon size={14} className="mr-1" />
                      {tagDef.label}
                    </div>
                  </div>
                  <div className={TAG_PILL_ROW_CLASS}>
                    {visible.map((val, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          const r = resolveTag(`custom:${tagDef.slug}`, val);
                          onTagClick(
                            `custom_performer`,
                            `${tagDef.slug}\x00${r.identityId || val}`,
                            val,
                          );
                        }}
                        data-tag-pill
                        className={`${tagPillSplitSegmentGroupClass} p-0 text-xs transition-colors hover:opacity-80`}
                        {...tagFilterDragProps(
                          "custom_performer",
                          `${tagDef.slug}\x00${val}`,
                        )}
                      >
                        <TagPillSplitLabel
                          fitToContainer
                          text={
                            resolveTag(`custom:${tagDef.slug}`, val).display
                          }
                          segmentColors={{
                            backgroundColor: tagDef.bg_color || "#e0e7ff",
                            color: tagDef.text_color || "#3730a3",
                          }}
                        />
                      </button>
                    ))}
                    {tags.length > TAG_LIMIT && (
                      <button
                        type="button"
                        onClick={() =>
                          toggleTagSection(`custom_${tagDef.slug}`)
                        }
                        className="text-xs text-muted-foreground hover:text-muted-foreground inline-flex shrink-0 items-center justify-center rounded-md"
                      >
                        {expandedTagSections[`custom_${tagDef.slug}`]
                          ? "−"
                          : `+${tags.length - TAG_LIMIT}`}
                      </button>
                    )}
                  </div>
                </div>
              );
            });
        })()}
      </div>

      {afterBody}

      {tagsBySection.footer_tags?.length > 0 &&
        (() => {
          const tags = tagsBySection.footer_tags || [];
          const showMore =
            tags.length > TAG_LIMIT && !expandedTagSections["footer_tags"];
          const visible = showMore ? tags.slice(0, TAG_LIMIT) : tags;
          return (
            <div className="mt-3 pt-3 border-t">
              <div className={TAG_PILL_ROW_CLASS}>
                {visible.map((tag, idx) => (
                  <button
                    key={idx}
                    onClick={() =>
                      onTagClick(
                        "footer_tags",
                        resolveTag("footer_tags", tag).identityId || tag,
                        tag,
                      )
                    }
                    data-tag-pill
                    className={`${tagPillSplitSegmentGroupClass} p-0 text-xs transition-colors hover:opacity-80`}
                    {...tagFilterDragProps("footer_tags", tag)}
                  >
                    <TagPillSplitLabel
                      fitToContainer
                      text={resolveTag("footer_tags", tag).display}
                      segmentColors={{
                        backgroundColor:
                          tagColors?.footer_tags_bg_color || "#d1fae5",
                        color: tagColors?.footer_tags_text_color || "#065f46",
                      }}
                    />
                  </button>
                ))}
                {tags.length > TAG_LIMIT && (
                  <button
                    type="button"
                    onClick={() => toggleTagSection("footer_tags")}
                    className="text-xs text-muted-foreground hover:text-muted-foreground inline-flex shrink-0 items-center justify-center rounded-md"
                    title={
                      expandedTagSections["footer_tags"]
                        ? "Show less"
                        : "View more tags"
                    }
                  >
                    {expandedTagSections["footer_tags"]
                      ? "−"
                      : `+${tags.length - TAG_LIMIT}`}
                  </button>
                )}
              </div>
            </div>
          );
        })()}
    </>
  );
}
