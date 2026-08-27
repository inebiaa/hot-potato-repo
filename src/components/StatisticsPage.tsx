import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import type { Event } from '../lib/supabase';
import { getSeasonFromDate, sortSeasonsByDate } from '../lib/season';
import { sameTagSpelling } from '../lib/tagIdentity';
import { effectiveHeaderTags } from '../lib/eventHeaderTags';
import {
  eventArrayMatchesFilter,
  fetchTagResolutionForEvents,
  type TagResolutionMap,
} from '../lib/tagDisplayResolution';
import { fetchAllEvents } from '../lib/eventsFeed';
import { eventMatchesTextQuery, filterEventsBySelectedTags } from '../lib/eventTagFilter';
import { getSpecialGuests } from '../lib/specialGuests';
import TagRatingsModal from './TagRatingsModal';
import { clearAppModalParams, parseAppModal, setAppModalParams } from '../lib/searchParamsModal';
import type { AppSettings } from '../types/appSettings';
import StatisticsPageContent from './StatisticsPageContent';
import { useHomeCatalogOptional } from '../contexts/HomeCatalogContext';
import { useRegisterPullToRefresh } from '../contexts/PullToRefreshContext';

export interface TagStats {
  name: string;
  count: number;
  type: string;
}

interface StatisticsPageProps {
  tagColors: Partial<AppSettings>;
  onOpenEvent?: (eventId: string) => void;
  tagModalRefreshTrigger?: number;
  eventOverlayOpen?: boolean;
  onCloseEventOverlay?: () => void;
}

export default function StatisticsPage({
  tagColors,
  onOpenEvent,
  tagModalRefreshTrigger = 0,
  eventOverlayOpen = false,
  onCloseEventOverlay,
}: StatisticsPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [events, setEvents] = useState<Event[]>([]);
  const [tagResolutionMap, setTagResolutionMap] = useState<TagResolutionMap | null>(null);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [selectedSeason, setSelectedSeason] = useState<string>('');
  const [sortBy, setSortBy] = useState<'count' | 'name'>('name');
  const [loading, setLoading] = useState(true);
  const home = useHomeCatalogOptional();

  const reloadStats = useCallback((opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    if (!silent) setLoading(true);
    void fetchAllEvents().then(async ({ data, error }) => {
      if (error) {
        console.error('Error fetching events:', error);
        setEvents([]);
        setLoading(false);
        return;
      }
      setEvents(data);
      setLoading(false);
      const map = await fetchTagResolutionForEvents(data);
      setTagResolutionMap(map);
    });
  }, []);

  useRegisterPullToRefresh(() => reloadStats({ silent: true }));

  useEffect(() => {
    if (selectedType !== 'all' && selectedType !== 'designer' && selectedType !== 'artist') {
      setSelectedType('all');
    }
  }, [selectedType]);

  useEffect(() => {
    reloadStats();
  }, [reloadStats]);

  const eventsInView = useMemo(() => {
    if (!home || home.browsing) return events;
    let next = events;
    if (home.searchQuery.trim()) {
      next = next.filter((event) =>
        eventMatchesTextQuery(event, home.searchQuery, tagResolutionMap),
      );
    }
    return filterEventsBySelectedTags(next, home.selectedTags, tagResolutionMap);
  }, [events, home?.browsing, home?.searchQuery, home?.selectedTags, tagResolutionMap]);

  const calculateTagStats = (): TagStats[] => {
    const stats: Record<string, TagStats> = {};

    let filteredEvents = [...eventsInView];

    if (selectedCity) {
      filteredEvents = filteredEvents.filter((e) => sameTagSpelling(e.city, selectedCity));
    }

    if (selectedSeason) {
      filteredEvents = filteredEvents.filter(e => (e.season || getSeasonFromDate(e.date)) === selectedSeason);
    }

    filteredEvents.forEach((event) => {
      const addTag = (name: string, type: string) => {
        const key = `${type}:${name}`;
        if (!stats[key]) {
          stats[key] = { name, count: 0, type };
        }
        stats[key].count++;
      };

      if (selectedType === 'all' || selectedType === 'designer') {
        event.featured_designers?.forEach(d => addTag(d, 'designer'));
      }
      if (selectedType === 'all' || selectedType === 'artist') {
        event.featured_artists?.forEach(a => addTag(a, 'artist'));
        getSpecialGuests(event.custom_tags).forEach(a => addTag(a, 'artist'));
      }
      if (selectedType === 'all' || selectedType === 'producer') {
        event.producers?.forEach(p => addTag(p, 'producer'));
      }
      if (selectedType === 'all' || selectedType === 'hair_makeup') {
        event.hair_makeup?.forEach(h => addTag(h, 'hair_makeup'));
      }
      if (selectedType === 'all' || selectedType === 'city') {
        if (event.city) addTag(event.city, 'city');
      }
    });

    const statsArray = Object.values(stats);

    if (sortBy === 'count') {
      return statsArray.sort((a, b) => b.count - a.count);
    } else {
      return statsArray.sort((a, b) => a.name.localeCompare(b.name));
    }
  };

  const getTagColors = (type: string) => {
    switch (type) {
      case 'designer':
      case 'artist':
        return {
          bg: tagColors.designer_bg_color || '#fef3c7',
          text: tagColors.designer_text_color || '#b45309'
        };
      case 'producer':
        return {
          bg: tagColors.producer_bg_color || '#f3f4f6',
          text: tagColors.producer_text_color || '#374151'
        };
      case 'hair_makeup':
        return {
          bg: tagColors.hair_makeup_bg_color || '#f3e8ff',
          text: tagColors.hair_makeup_text_color || '#7c3aed'
        };
      case 'city':
        return {
          bg: tagColors.city_bg_color || '#dbeafe',
          text: tagColors.city_text_color || '#1e40af'
        };
      case 'season':
        return {
          bg: tagColors.season_bg_color || '#ffedd5',
          text: tagColors.season_text_color || '#c2410c'
        };
      case 'header_tags':
        return {
          bg: tagColors.header_tags_bg_color || '#ccfbf1',
          text: tagColors.header_tags_text_color || '#0f766e'
        };
      case 'footer_tags':
        return {
          bg: tagColors.footer_tags_bg_color || '#d1fae5',
          text: tagColors.footer_tags_text_color || '#065f46'
        };
      default:
        return {
          bg: '#f3f4f6',
          text: '#374151'
        };
    }
  };

  const handleTagClick = (tag: TagStats) => {
    navigate({
      pathname: location.pathname,
      search: setAppModalParams(searchParams, 'tag', { tagType: tag.type, tagValue: tag.name }),
    });
  };

  const urlModal = useMemo(() => parseAppModal(searchParams), [searchParams]);
  const selectedTag = useMemo(() => {
    if (urlModal.modal === 'tag' && urlModal.tagType && urlModal.tagValue) {
      return { type: urlModal.tagType, value: urlModal.tagValue };
    }
    return null;
  }, [urlModal.modal, urlModal.tagType, urlModal.tagValue]);
  const isTagRatingsModalOpen = !!selectedTag;

  const allCities = Array.from(new Set(eventsInView.map(e => e.city).filter(Boolean))).sort();
  const allSeasons = sortSeasonsByDate(Array.from(new Set(eventsInView.map(e => getSeasonFromDate(e.date)))));
  const tagStats = calculateTagStats();

  const matchEventForTag = useCallback((e: Event, type: string, value: string) => {
    switch (type) {
      case 'producer': return eventArrayMatchesFilter(tagResolutionMap, 'producer', e.producers, value);
      case 'designer': return eventArrayMatchesFilter(tagResolutionMap, 'designer', e.featured_designers, value);
      case 'artist':
        return (
          eventArrayMatchesFilter(tagResolutionMap, 'artist', e.featured_artists, value) ||
          eventArrayMatchesFilter(tagResolutionMap, 'artist', getSpecialGuests(e.custom_tags), value)
        );
      case 'hair_makeup': return eventArrayMatchesFilter(tagResolutionMap, 'hair_makeup', e.hair_makeup, value);
      case 'city': return sameTagSpelling(e.city, value);
      case 'season': return (e.season || getSeasonFromDate(e.date)) === value;
      case 'header_tags': return eventArrayMatchesFilter(tagResolutionMap, 'header_tags', effectiveHeaderTags(e), value);
      case 'footer_tags': return eventArrayMatchesFilter(tagResolutionMap, 'footer_tags', e.footer_tags, value);
      default: return false;
    }
  }, [tagResolutionMap]);

  const eventsForTag = useMemo(() => {
    if (!selectedTag?.type || !selectedTag?.value) return [];
    let filtered = [...eventsInView];
    if (selectedCity) filtered = filtered.filter((e) => sameTagSpelling(e.city, selectedCity));
    if (selectedSeason) filtered = filtered.filter(e => (e.season || getSeasonFromDate(e.date)) === selectedSeason);
    return filtered.filter(e => matchEventForTag(e, selectedTag.type, selectedTag.value));
  }, [eventsInView, selectedTag, selectedCity, selectedSeason, matchEventForTag]);

  const contentProps = {
    tagStats,
    events: eventsInView,
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
  };

  return (
    <>
      <StatisticsPageContent {...contentProps} />
      <TagRatingsModal
        isOpen={isTagRatingsModalOpen}
        onClose={() => {
          navigate({ pathname: location.pathname, search: clearAppModalParams(searchParams) });
        }}
        tagType={selectedTag?.type || ''}
        tagValue={selectedTag?.value || ''}
        onEventClick={onOpenEvent}
        refreshTrigger={tagModalRefreshTrigger}
        tagColors={tagColors}
        eventsForTag={eventsForTag}
        tagResolutionMap={tagResolutionMap}
        eventOverlayOpen={eventOverlayOpen}
        onCloseEventOverlay={onCloseEventOverlay}
      />
    </>
  );
}
