import { useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import PrimarySearchBar from '../PrimarySearchBar';
import { useAppChrome } from '../../contexts/AppChromeContext';
import { useHomeCatalog } from '../../contexts/HomeCatalogContext';
import { useAppSettings } from '../../hooks/useAppSettings';
import { headerSearchOpensHome } from '../../lib/homeCatalogRoute';

/** Header search. Opens home, except on stats, profile, and lists. */
export default function HomeHeaderSearch() {
  const { appSettings } = useAppSettings();
  const { pathname } = useLocation();
  const { overlayEventId, closeEventOverlay } = useAppChrome();
  const {
    events,
    filteredEvents,
    searchQuery,
    setSearchQuery,
    selectedTags,
    tagSuggestions,
    searchDragOver,
    selectTagFilter,
    removeTagFilter,
    clearFilters,
    handleSearchDrop,
    handleSearchDragOver,
    handleSearchDragLeave,
    showHomeFeed,
  } = useHomeCatalog();

  const searchGoesHome = headerSearchOpensHome(pathname);

  const onSelectTagFilter = useCallback(
    (type: string, value: string, explicitLabel?: string) => {
      if (overlayEventId) closeEventOverlay();
      selectTagFilter(type, value, explicitLabel);
      if (searchGoesHome) showHomeFeed();
    },
    [overlayEventId, closeEventOverlay, selectTagFilter, searchGoesHome, showHomeFeed],
  );

  const onSearchQueryChange = useCallback(
    (value: string) => {
      setSearchQuery(value);
      if (searchGoesHome && value.trim().length >= 2) showHomeFeed();
    },
    [setSearchQuery, searchGoesHome, showHomeFeed],
  );

  const onSearchDrop = useCallback(
    (e: React.DragEvent) => {
      handleSearchDrop(e);
      const raw = e.dataTransfer.getData('text/plain');
      if (searchGoesHome && raw?.startsWith('tag-filter:')) showHomeFeed();
    },
    [handleSearchDrop, searchGoesHome, showHomeFeed],
  );

  if (!appSettings) return null;

  return (
    <PrimarySearchBar
      embeddedInHeader
      appSettings={appSettings}
      searchDragOver={searchDragOver}
      selectedTags={selectedTags}
      searchQuery={searchQuery}
      tagSuggestions={tagSuggestions}
      filteredCount={filteredEvents.length}
      totalCount={events.length}
      onSearchDrop={onSearchDrop}
      onSearchDragOver={handleSearchDragOver}
      onSearchDragLeave={handleSearchDragLeave}
      onSearchQueryChange={onSearchQueryChange}
      onSelectTagFilter={onSelectTagFilter}
      onRemoveTagFilter={removeTagFilter}
      onClearFilters={clearFilters}
    />
  );
}
