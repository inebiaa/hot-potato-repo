import type { AppSettings } from '../types/appSettings';
import { getPillColors } from './tagCards/getPillColors';
import TagPillSplitLabel, { tagPillSplitSegmentGroupClass } from './TagPillSplitLabel';
import { TAG_PILL_ROW_CLASS } from './tagPillShell';
import type { PinnedArtistEntry } from '../lib/headerPinnedArtists';

interface SelectedTagFilter {
  type: string;
  value: string;
  label: string;
}

interface HeaderPinnedArtistsBarProps {
  artists: PinnedArtistEntry[];
  selectedTags: SelectedTagFilter[];
  appSettings: AppSettings;
  onToggleArtist: (id: string, label: string) => void;
}

export default function HeaderPinnedArtistsBar({
  artists,
  selectedTags,
  appSettings,
  onToggleArtist,
}: HeaderPinnedArtistsBarProps) {
  if (artists.length === 0) return null;

  const { bg, text } = getPillColors('artist', appSettings);
  const pillColors = { backgroundColor: bg, color: text };

  return (
    <div className={`${TAG_PILL_ROW_CLASS} pb-0.5`}>
      {artists.map(({ id, label }) => {
        const isSelected = selectedTags.some((t) => t.type === 'artist' && t.value === id);
        return (
          <button
            key={id}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onToggleArtist(id, label)}
            data-tag-pill
            className={`${tagPillSplitSegmentGroupClass} p-0 text-xs transition-opacity hover:opacity-100 ${
              isSelected ? 'opacity-100' : 'opacity-55 hover:opacity-80'
            }`}
          >
            <TagPillSplitLabel fitToContainer text={label} segmentColors={pillColors} />
          </button>
        );
      })}
    </div>
  );
}
