import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import HeaderPinnedArtistsBar from '../HeaderPinnedArtistsBar';
import { useAppChrome } from '../../contexts/AppChromeContext';
import { useHomeCatalog } from '../../contexts/HomeCatalogContext';
import { useAppSettings } from '../../hooks/useAppSettings';
import { displayLabelForTagFilter } from '../../lib/tagDisplayResolution';
import { headerSearchOpensHome } from '../../lib/homeCatalogRoute';
import {
  parseHeaderPinnedArtistIds,
  resolvePinnedArtistsForDisplay,
  type PinnedArtistEntry,
} from '../../lib/headerPinnedArtists';

/** Home filter shortcuts. Live in the header but belong to home search. */
export default function HomePinnedArtistsSlot() {
  const { appSettings } = useAppSettings();
  const { overlayEventId, closeEventOverlay } = useAppChrome();
  const { pathname } = useLocation();
  const {
    selectedTags,
    setSelectedTags,
    setSearchQuery,
    tagResolutionMap,
    feedScrollRef,
    showHomeFeed,
  } = useHomeCatalog();
  const [pinnedArtists, setPinnedArtists] = useState<PinnedArtistEntry[]>([]);

  useEffect(() => {
    if (!appSettings) {
      setPinnedArtists([]);
      return;
    }
    const ids = parseHeaderPinnedArtistIds(appSettings.header_pinned_artists);
    if (ids.length === 0) {
      setPinnedArtists([]);
      return;
    }
    let cancelled = false;
    void resolvePinnedArtistsForDisplay(ids, tagResolutionMap).then((resolved) => {
      if (!cancelled) setPinnedArtists(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [appSettings, appSettings?.header_pinned_artists, tagResolutionMap]);

  const onToggleArtist = useCallback(
    (id: string, label: string) => {
      if (overlayEventId) closeEventOverlay();
      const key = `artist:${id}`;
      const exists = selectedTags.some((t) => `${t.type}:${t.value}` === key);
      setSelectedTags((prev) => {
        const withoutArtists = prev.filter((t) => t.type !== 'artist');
        if (exists) return withoutArtists;
        const resolvedLabel = displayLabelForTagFilter('artist', id, tagResolutionMap, label);
        return [...withoutArtists, { type: 'artist', value: id, label: resolvedLabel }];
      });
      if (!exists) setSearchQuery('');
      feedScrollRef.current?.scrollTo({ top: 0 });
      if (headerSearchOpensHome(pathname)) showHomeFeed();
    },
    [
      overlayEventId,
      closeEventOverlay,
      selectedTags,
      tagResolutionMap,
      setSelectedTags,
      setSearchQuery,
      feedScrollRef,
      pathname,
      showHomeFeed,
    ],
  );

  if (!appSettings || pinnedArtists.length === 0) return null;

  return (
    <HeaderPinnedArtistsBar
      artists={pinnedArtists}
      selectedTags={selectedTags}
      appSettings={appSettings}
      onToggleArtist={onToggleArtist}
    />
  );
}
