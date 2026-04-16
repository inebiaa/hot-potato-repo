import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { supabase, Event } from '../lib/supabase';
import { getSeasonFromDate, sortSeasonsByDate } from '../lib/season';
import { sameTagSpelling, tagArrayContainsNormalized } from '../lib/tagIdentity';
import type { TagResolutionMap } from '../lib/tagDisplayResolution';
import TagRatingsModal from './TagRatingsModal';
import { clearAppModalParams, parseAppModal, setAppModalParams } from '../lib/searchParamsModal';
import type { AppSettings } from '../types/appSettings';
import StatisticsPageContent from './StatisticsPageContent';

export interface TagStats {
  name: string;
  count: number;
  type: string;
}

interface StatisticsPageProps {
  isOpen: boolean;
  onClose: () => void;
  tagColors: Partial<AppSettings>;
  /** Optional: open an event overlay from a tag (matches main page behavior). */
  onOpenEvent?: (eventId: string) => void;
  /** Optional: when this changes, refresh the tag ratings modal so counts stay in sync. */
  tagModalRefreshTrigger?: number;
  /** When true, render as full page instead of modal (e.g. at ?stats=1) */
  asPage?: boolean;
  /** When true, backdrop click on tag modal closes event overlay instead of closing modal. */
  eventOverlayOpen?: boolean;
  onCloseEventOverlay?: () => void;
  /** Optional: preloaded events from shared cache; when provided, skips fetch */
  events?: Event[];
  tagResolutionMap?: TagResolutionMap | null;
}

export default function StatisticsPage({
  isOpen,
  onClose,
  tagColors,
  onOpenEvent,
  tagModalRefreshTrigger = 0,
  asPage = false,
  eventOverlayOpen = false,
  onCloseEventOverlay,
  events: eventsProp,
  tagResolutionMap,
}: StatisticsPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [selectedSeason, setSelectedSeason] = useState<string>('');
  const [sortBy, setSortBy] = useState<'count' | 'name'>('name');
  const [loading, setLoading] = useState(true);
  const [localTagModal, setLocalTagModal] = useState<{ type: string; value: string } | null>(null);

  useEffect(() => {
    if (!isOpen && !asPage) return;
    if (eventsProp && eventsProp.length > 0) {
      setEvents(eventsProp);
      setLoading(false);
      return;
    }
    fetchEvents();
  }, [isOpen, asPage, eventsProp]);

  useEffect(() => {
    if (eventsProp && eventsProp.length > 0) {
      setEvents(eventsProp);
    }
  }, [eventsProp]);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTagStats = (): TagStats[] => {
    const stats: Record<string, TagStats> = {};

    let filteredEvents = [...events];

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
      if (selectedType === 'all' || selectedType === 'model') {
        event.models?.forEach(m => addTag(m, 'model'));
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
        return {
          bg: tagColors.designer_bg_color || '#fef3c7',
          text: tagColors.designer_text_color || '#b45309'
        };
      case 'model':
        return {
          bg: tagColors.model_bg_color || '#fce7f3',
          text: tagColors.model_text_color || '#be185d'
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
    if (asPage) {
      navigate({
        pathname: location.pathname,
        search: setAppModalParams(searchParams, 'tag', { tagType: tag.type, tagValue: tag.name }),
      });
    } else {
      setLocalTagModal({ type: tag.type, value: tag.name });
    }
  };

  const urlModal = useMemo(() => parseAppModal(searchParams), [searchParams]);
  const selectedTag = useMemo(() => {
    if (asPage && urlModal.modal === 'tag' && urlModal.tagType && urlModal.tagValue) {
      return { type: urlModal.tagType, value: urlModal.tagValue };
    }
    if (!asPage) return localTagModal;
    return null;
  }, [asPage, urlModal.modal, urlModal.tagType, urlModal.tagValue, localTagModal]);
  const isTagRatingsModalOpen = !!selectedTag;

  const allCities = Array.from(new Set(events.map(e => e.city).filter(Boolean))).sort();
  const allSeasons = sortSeasonsByDate(Array.from(new Set(events.map(e => getSeasonFromDate(e.date)))));
  const tagStats = calculateTagStats();

  const matchEventForTag = (e: Event, type: string, value: string) => {
    switch (type) {
      case 'producer': return tagArrayContainsNormalized(e.producers, value);
      case 'designer': return tagArrayContainsNormalized(e.featured_designers, value);
      case 'model': return tagArrayContainsNormalized(e.models, value);
      case 'hair_makeup': return tagArrayContainsNormalized(e.hair_makeup, value);
      case 'city': return sameTagSpelling(e.city, value);
      case 'season': return (e.season || getSeasonFromDate(e.date)) === value;
      case 'header_tags': return tagArrayContainsNormalized(e.header_tags || e.genre, value);
      case 'footer_tags': return tagArrayContainsNormalized(e.footer_tags, value);
      default: return false;
    }
  };

  const eventsForTag = useMemo(() => {
    if (!selectedTag?.type || !selectedTag?.value) return [];
    let filtered = [...events];
    if (selectedCity) filtered = filtered.filter((e) => sameTagSpelling(e.city, selectedCity));
    if (selectedSeason) filtered = filtered.filter(e => (e.season || getSeasonFromDate(e.date)) === selectedSeason);
    return filtered.filter(e => matchEventForTag(e, selectedTag.type, selectedTag.value));
  }, [events, selectedTag, selectedCity, selectedSeason]);

  if (!isOpen && !asPage) return null;

  const contentProps = {
    asPage,
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
  };

  if (asPage) {
    return (
      <>
        <StatisticsPageContent {...contentProps} />
        <TagRatingsModal
          isOpen={isTagRatingsModalOpen}
          onClose={() => {
            if (asPage) {
              navigate({ pathname: location.pathname, search: clearAppModalParams(searchParams) });
            } else {
              setLocalTagModal(null);
            }
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

  return (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <StatisticsPageContent {...contentProps} />
      </div>

      <TagRatingsModal
        isOpen={isTagRatingsModalOpen}
        onClose={() => {
          if (asPage) {
            navigate({ pathname: location.pathname, search: clearAppModalParams(searchParams) });
          } else {
            setLocalTagModal(null);
          }
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
