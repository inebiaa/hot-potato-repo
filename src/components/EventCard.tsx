import { Link, useNavigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { Calendar, MapPin, Star, Edit, Trash2, Share2, Mail, MoreVertical, Plus, Check, X } from 'lucide-react';
import { Event, Rating, supabase } from '../lib/supabase';
import { getIcon } from '../lib/eventCardIcons';
import { getSeasonFromDate } from '../lib/season';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import RatingModal from './RatingModal';
import EditEventModal from './EditEventModal';
import ViewRatingsModal from './ViewRatingsModal';
import CommentWithTags from './CommentWithTags';
import TagPillSplitLabel, { tagPillSplitSegmentGroupClass } from './TagPillSplitLabel';
import { useAuth } from '../contexts/AuthContext';
import { useTagDisplayMap } from '../contexts/TagDisplayContext';
import { tagResolutionKey } from '../lib/tagDisplayResolution';
import { ensureAlias, ensureIdentity, findIdentityByName, normalizeTagName, type TagType } from '../lib/tagIdentity';
import { tryNormalizeExternalUrl } from '../lib/externalUrl';
import { isEventUpcoming } from '../lib/eventDates';
import EventCountdownPill from './EventCountdownPill';
import { effectiveHeaderTags } from '../lib/eventHeaderTags';
import { coalesceTagList } from '../lib/eventTagArray';
import { buildEventEmailPlainText, buildEventEmailRichHtml } from '../lib/eventEmailRichCard';
import { formatEventDateDisplay } from '../lib/formatEventDate';
import { canonicalEventUrl } from '../lib/siteBase';
import { clearAppModalParams, parseAppModal, setAppModalParams } from '../lib/searchParamsModal';

/** Pending suggestion pills (neutral gray) — per-chunk mini-pills use this fill. */
const PENDING_TAG_PILL_COLORS = { backgroundColor: '#d1d5db', color: '#4b5563' } as const;

/** City / season / genre: one rounded shell with icon + label inside (same idea as EventCountdownPill). */
const HEADER_ICON_INSIDE_PILL_CLASS =
  'inline-flex max-w-full min-w-0 items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors hover:opacity-80';

interface EventCardProps {
  event: Event;
  averageRating: number;
  ratingCount: number;
  userRating?: Rating;
  onRatingSubmitted: () => void;
  onEventUpdated: () => void;
  onTagClick: (type: string, value: string, displayLabel?: string) => void;
  /** When set, the card title links to this URL (e.g. single-event view) */
  viewHref?: string;
  /** When set, clicking the title opens overlay instead of navigating (e.g. openEventOverlay). Second param: open overlay with wiggle mode active. */
  onViewClick?: (eventId: string, openWithWiggle?: boolean, suggestSection?: keyof { producers: string[]; featured_designers: string[]; models: string[]; hair_makeup: string[]; header_tags: string[]; footer_tags: string[] } | 'custom', suggestCustomSlug?: string) => void;
  tagColors?: {
    producer_bg_color?: string;
    producer_text_color?: string;
    designer_bg_color?: string;
    designer_text_color?: string;
    model_bg_color?: string;
    model_text_color?: string;
    hair_makeup_bg_color?: string;
    hair_makeup_text_color?: string;
    city_bg_color?: string;
    city_text_color?: string;
    season_bg_color?: string;
    season_text_color?: string;
    header_tags_bg_color?: string;
    header_tags_text_color?: string;
    countdown_bg_color?: string;
    countdown_text_color?: string;
    footer_tags_bg_color?: string;
    footer_tags_text_color?: string;
    producer_icon?: string;
    designer_icon?: string;
    model_icon?: string;
    hair_makeup_icon?: string;
    city_icon?: string;
    season_icon?: string;
    header_tags_icon?: string;
    footer_tags_icon?: string;
    optional_tags_bg_color?: string;
    optional_tags_text_color?: string;
  };
  /** When true, only show the photo (for stacked upcoming cards) */
  stackPhotoOnly?: boolean;
  /** Opacity for the image only (for stack front card photo blending) */
  imageOpacity?: number;
  customPerformerTags?: { slug: string; bg_color: string; text_color: string }[];
  onRequireAuth?: () => void;
  /** When set, card mounts in reorder/wiggle mode (e.g. overlay opened from a wiggling list card) */
  initialReorderSection?: keyof { producers: string[]; featured_designers: string[]; models: string[]; hair_makeup: string[]; header_tags: string[]; footer_tags: string[] };
  /** When set with initialReorderSection='custom', which custom slug was in suggest mode */
  initialCustomReorderSlug?: string;
  /** When true (overlay card), clicking on the card does not clear wiggle – only click-away does */
  wiggleOnlyClearsOnClickAway?: boolean;
  /** Called when reorder mode is entered (so overlay can avoid closing on release-after-long-press) */
  onReorderModeEntered?: () => void;
}

interface PendingTagSuggestion {
  id: string;
  event_id: string;
  section_key: string;
  custom_slug: string | null;
  proposed_name: string;
  normalized_name: string;
  linked_identity_id: string | null;
  suggested_by: string;
  connect_as_credit: boolean;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export default function EventCard({
  event,
  averageRating,
  ratingCount,
  userRating,
  onRatingSubmitted,
  onEventUpdated,
  onTagClick,
  viewHref,
  onViewClick,
  tagColors,
  customPerformerTags = [],
  stackPhotoOnly = false,
  imageOpacity,
  onRequireAuth,
  initialReorderSection,
  initialCustomReorderSlug,
  wiggleOnlyClearsOnClickAway = false,
  onReorderModeEntered
}: EventCardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const parsedModal = useMemo(() => parseAppModal(searchParams), [searchParams]);
  const panelEventId = params.eventId ?? parsedModal.targetEventId ?? '';
  const isRatingModalOpen = parsedModal.modal === 'rate' && panelEventId === event.id;
  const isViewRatingsModalOpen = parsedModal.modal === 'view-ratings' && panelEventId === event.id;
  const isEditModalOpen = parsedModal.modal === 'edit-event' && panelEventId === event.id;
  const ratingAllowed = !isEventUpcoming(event.date);

  const closeEventPanels = () => {
    navigate({ pathname: location.pathname, search: clearAppModalParams(searchParams) });
  };

  const openEventPanel = (m: 'rate' | 'view-ratings' | 'edit-event') => {
    navigate({
      pathname: location.pathname,
      search: setAppModalParams(searchParams, m, { targetEventId: event.id }),
    });
  };
  const [isDeleting, setIsDeleting] = useState(false);
  const [shareCopied, setShareCopied] = useState<'link' | 'embed' | 'embedcode' | 'email' | null>(null);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [expandedTagSections, setExpandedTagSections] = useState<Record<string, boolean>>({});
  const [orderedTags, setOrderedTags] = useState({
    producers: coalesceTagList(event.producers),
    featured_designers: coalesceTagList(event.featured_designers),
    models: coalesceTagList(event.models),
    hair_makeup: coalesceTagList(event.hair_makeup),
    header_tags: effectiveHeaderTags(event),
    footer_tags: coalesceTagList(event.footer_tags)
  });
  const [reorderSection, setReorderSection] = useState<keyof typeof orderedTags | null>(
    (initialReorderSection as keyof typeof orderedTags) ?? null
  );
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [orderedCustomTags, setOrderedCustomTags] = useState<Record<string, string[]>>(
    (event.custom_tags && typeof event.custom_tags === 'object' && !Array.isArray(event.custom_tags))
      ? (event.custom_tags as Record<string, string[]>)
      : {}
  );
  const [customReorderSlug, setCustomReorderSlug] = useState<string | null>(initialCustomReorderSlug ?? null);
  const [customDragIndex, setCustomDragIndex] = useState<number | null>(null);
  const [customDropIndex, setCustomDropIndex] = useState<number | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const cardRootRef = useRef<HTMLDivElement | null>(null);
  const reorderModeEnteredAtRef = useRef<number>(0);
  const longPressActivatedRef = useRef(false);
  const skipNextClickRef = useRef(false);
  const longPressTargetRef = useRef<EventTarget | null>(null);
  const TAG_ORDER_STORAGE_KEY = 'event_tag_order_v1';
  const isAnyReorderMode = reorderSection !== null || customReorderSlug !== null;
  const showWiggle = isAnyReorderMode;

  const TAG_LIMIT = 8; // ~2 lines of tags; beyond this show "View more"
  const toggleTagSection = (key: string) => {
    setExpandedTagSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };
  const { user, isAdmin } = useAuth();
  const isApprover = !!user && (isAdmin || event.created_by === user.id);
  const [pendingSuggestions, setPendingSuggestions] = useState<PendingTagSuggestion[]>([]);
  const [pendingError, setPendingError] = useState<string | null>(null);
  const [addingFor, setAddingFor] = useState<{ section: keyof typeof orderedTags | 'custom' | 'footer_tags'; customSlug?: string; label?: string } | null>(null);
  const tagDisplayMap = useTagDisplayMap();
  const resolveTag = (tagType: string, raw: string) => {
    const entry = tagDisplayMap?.get(tagResolutionKey(tagType, raw));
    return {
      /** Always the exact string on the event; identities/aliases must not relabel the card. */
      display: raw,
      canonical: entry?.canonical ?? raw,
      identityId: entry?.identityId ?? null,
    };
  };
  const [newTagValue, setNewTagValue] = useState('');
  const [processingSuggestionId, setProcessingSuggestionId] = useState<string | null>(null);

  const sectionToTagType = (section: keyof typeof orderedTags | 'custom', customSlug?: string): TagType => {
    if (section === 'producers') return 'producer';
    if (section === 'featured_designers') return 'designer';
    if (section === 'models') return 'model';
    if (section === 'hair_makeup') return 'hair_makeup';
    if (section === 'header_tags') return 'header_tags';
    if (section === 'custom') return `custom:${customSlug || 'general'}`;
    return 'footer_tags';
  };

  const visiblePending = pendingSuggestions.filter((s) => {
    if (s.status !== 'pending') return false;
    if (isApprover) return true;
    return !!user && s.suggested_by === user.id;
  });

  const readSavedOrder = useCallback((): {
    producers?: string[];
    featured_designers?: string[];
    models?: string[];
    hair_makeup?: string[];
    header_tags?: string[];
    footer_tags?: string[];
    custom_tags?: Record<string, string[]>;
  } | null => {
    try {
      const raw = window.localStorage.getItem(TAG_ORDER_STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw) as Record<string, {
        producers?: string[];
        featured_designers?: string[];
        models?: string[];
        hair_makeup?: string[];
        header_tags?: string[];
        footer_tags?: string[];
        custom_tags?: Record<string, string[]>;
      }>;
      return data[event.id] || null;
    } catch {
      return null;
    }
  }, [event.id]);

  /** Merge event's current tags (source of truth) with saved display order. Saved order only affects ordering; added/removed tags come from current. */
  const mergeWithSavedOrder = (current: string[], saved?: string[] | null): string[] => {
    if (!current.length) return [];
    if (!saved?.length) return current;
    // Use current's strings (event data) for display; saved only determines order
    const savedOrdered = saved
      .map((t) => current.find((c) => normalizeTagName(c) === normalizeTagName(t)))
      .filter((t): t is string => t != null);
    const inSaved = new Set(savedOrdered.map((t) => normalizeTagName(t)));
    const newTags = current.filter((t) => !inSaved.has(normalizeTagName(t)));
    return [...savedOrdered, ...newTags];
  };

  const saveOrder = (next: {
    orderedTags: typeof orderedTags;
    orderedCustomTags: Record<string, string[]>;
  }) => {
    try {
      const raw = window.localStorage.getItem(TAG_ORDER_STORAGE_KEY);
      const data = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      data[event.id] = {
        producers: next.orderedTags.producers,
        featured_designers: next.orderedTags.featured_designers,
        models: next.orderedTags.models,
        hair_makeup: next.orderedTags.hair_makeup,
        header_tags: next.orderedTags.header_tags,
        footer_tags: next.orderedTags.footer_tags,
        custom_tags: next.orderedCustomTags
      };
      window.localStorage.setItem(TAG_ORDER_STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Ignore storage errors.
    }
  };

  useEffect(() => {
    const fallbackOrdered = {
      producers: coalesceTagList(event.producers),
      featured_designers: coalesceTagList(event.featured_designers),
      models: coalesceTagList(event.models),
      hair_makeup: coalesceTagList(event.hair_makeup),
      header_tags: effectiveHeaderTags(event),
      footer_tags: coalesceTagList(event.footer_tags)
    };
    const fallbackCustom = (event.custom_tags && typeof event.custom_tags === 'object' && !Array.isArray(event.custom_tags))
      ? (event.custom_tags as Record<string, string[]>)
      : {};
    const saved = readSavedOrder();

    setOrderedTags({
      producers: mergeWithSavedOrder(fallbackOrdered.producers, saved?.producers),
      featured_designers: mergeWithSavedOrder(fallbackOrdered.featured_designers, saved?.featured_designers),
      models: mergeWithSavedOrder(fallbackOrdered.models, saved?.models),
      hair_makeup: mergeWithSavedOrder(fallbackOrdered.hair_makeup, saved?.hair_makeup),
      header_tags: mergeWithSavedOrder(fallbackOrdered.header_tags, saved?.header_tags),
      footer_tags: mergeWithSavedOrder(fallbackOrdered.footer_tags, saved?.footer_tags)
    });
    setReorderSection(null);
    setDragIndex(null);
    setDropIndex(null);
    const mergedCustom: Record<string, string[]> = {};
    for (const slug of Object.keys(fallbackCustom)) {
      mergedCustom[slug] = mergeWithSavedOrder(fallbackCustom[slug] || [], saved?.custom_tags?.[slug]);
    }
    setOrderedCustomTags(mergedCustom);
    setCustomReorderSlug(null);
    setCustomDragIndex(null);
    setCustomDropIndex(null);
  }, [event.id, event.producers, event.featured_designers, event.models, event.hair_makeup, event.header_tags, event.footer_tags, event.custom_tags, readSavedOrder]);

  const fetchPendingSuggestions = useCallback(async () => {
    const { data, error } = await supabase
      .from('pending_tag_suggestions')
      .select('*')
      .eq('event_id', event.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    if (error) {
      // Missing table or policy issues should not break cards.
      setPendingError(error.message || 'Could not load pending tag suggestions');
      setPendingSuggestions([]);
      return;
    }
    setPendingError(null);
    setPendingSuggestions((data || []) as PendingTagSuggestion[]);
  }, [event.id]);

  useEffect(() => {
    if (user) void fetchPendingSuggestions();
    else {
      setPendingError(null);
      setPendingSuggestions([]);
    }
  }, [event.id, user, isApprover, fetchPendingSuggestions]);

  const countdownOpenUrl = useMemo(
    () => tryNormalizeExternalUrl(event.countdown_link),
    [event.countdown_link]
  );

  const suggestionMatchesSection = (
    suggestion: PendingTagSuggestion,
    section: keyof typeof orderedTags | 'custom' | 'footer_tags',
    customSlug?: string
  ) => {
    if (section === 'custom') return suggestion.section_key === 'custom' && suggestion.custom_slug === (customSlug || null);
    return suggestion.section_key === section;
  };

  const submitPendingSuggestion = async (section: keyof typeof orderedTags | 'custom' | 'footer_tags', customSlug?: string) => {
    if (!user) {
      onRequireAuth?.();
      return;
    }
    const raw = newTagValue.trim();
    if (!raw) return;
    const normalized = normalizeTagName(raw);
    if (!normalized) return;

    const tagType = sectionToTagType(section, customSlug);
    const existingIdentity = await findIdentityByName(tagType, raw);

    const { error } = await supabase.from('pending_tag_suggestions').insert({
      event_id: event.id,
      section_key: section === 'custom' ? 'custom' : section,
      custom_slug: section === 'custom' ? (customSlug || null) : null,
      proposed_name: raw,
      normalized_name: normalized,
      linked_identity_id: existingIdentity?.id || null,
      suggested_by: user.id,
      connect_as_credit: true,
      status: 'pending',
    });
    if (error) {
      alert(error.message || 'Unable to submit suggestion');
      return;
    }

    setNewTagValue('');
    setAddingFor(null);
    fetchPendingSuggestions();
  };

  const appendTagToSection = (sectionKey: string, customSlug: string | null, value: string) => {
    if (sectionKey === 'custom') {
      const slug = customSlug || '';
      if (!slug) return;
      const source = orderedCustomTags[slug] || [];
      if (source.some((x) => normalizeTagName(x) === normalizeTagName(value))) return;
      const nextCustom = { ...orderedCustomTags, [slug]: [...source, value] };
      setOrderedCustomTags(nextCustom);
      saveOrder({ orderedTags, orderedCustomTags: nextCustom });
      return;
    }

    if (!(sectionKey in orderedTags)) return;
    const k = sectionKey as keyof typeof orderedTags;
    const source = orderedTags[k] || [];
    if (source.some((x) => normalizeTagName(x) === normalizeTagName(value))) return;
    const nextOrdered = { ...orderedTags, [k]: [...source, value] };
    setOrderedTags(nextOrdered);
    saveOrder({ orderedTags: nextOrdered, orderedCustomTags });
  };

  const approveSuggestion = async (suggestion: PendingTagSuggestion) => {
    if (!user || !isApprover) return;
    setProcessingSuggestionId(suggestion.id);
    try {
      const tagType = sectionToTagType(
        suggestion.section_key === 'custom' ? 'custom' : (suggestion.section_key as keyof typeof orderedTags),
        suggestion.custom_slug || undefined
      );

      let identityId = suggestion.linked_identity_id;
      let finalName = suggestion.proposed_name.trim();

      if (identityId) {
        const { data: identity } = await supabase
          .from('tag_identities')
          .select('id, canonical_name')
          .eq('id', identityId)
          .maybeSingle();
        if (identity?.canonical_name) finalName = identity.canonical_name;
      } else {
        const identity = await ensureIdentity(tagType, suggestion.proposed_name, user.id);
        if (identity) {
          identityId = identity.id;
          finalName = identity.canonical_name;
        }
      }

      if (identityId && normalizeTagName(finalName) !== normalizeTagName(suggestion.proposed_name)) {
        await ensureAlias(identityId, suggestion.proposed_name, user.id);
      }

      appendTagToSection(suggestion.section_key, suggestion.custom_slug, finalName);

      const eventUpdate: Record<string, unknown> = {};
      if (suggestion.section_key === 'custom') {
        const slug = suggestion.custom_slug || '';
        if (slug) {
          const source = (event.custom_tags && typeof event.custom_tags === 'object' ? event.custom_tags : {}) as Record<string, string[]>;
          const existing = source[slug] || [];
          const nextVals = existing.some((x) => normalizeTagName(x) === normalizeTagName(finalName)) ? existing : [...existing, finalName];
          eventUpdate.custom_tags = { ...source, [slug]: nextVals };
        }
      } else if (suggestion.section_key === 'header_tags') {
        const source = effectiveHeaderTags(event);
        const nextVals = source.some((x) => normalizeTagName(x) === normalizeTagName(finalName)) ? source : [...source, finalName];
        eventUpdate.header_tags = nextVals;
      } else {
        const map: Record<string, keyof Event> = {
          producers: 'producers',
          featured_designers: 'featured_designers',
          models: 'models',
          hair_makeup: 'hair_makeup',
          footer_tags: 'footer_tags',
        };
        const eventKey = map[suggestion.section_key];
        if (eventKey) {
          const source = ((event[eventKey] || []) as string[]);
          const nextVals = source.some((x) => normalizeTagName(x) === normalizeTagName(finalName)) ? source : [...source, finalName];
          eventUpdate[eventKey] = nextVals;
        }
      }

      if (Object.keys(eventUpdate).length > 0) {
        const { error: updateErr } = await supabase.from('events').update(eventUpdate).eq('id', event.id);
        if (updateErr) throw updateErr;
      }

      await supabase
        .from('pending_tag_suggestions')
        .update({
          status: 'approved',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          linked_identity_id: identityId || null,
        })
        .eq('id', suggestion.id);

      if (identityId && suggestion.connect_as_credit) {
        const { data: existingCredit } = await supabase
          .from('user_tag_credits')
          .select('id')
          .eq('user_id', suggestion.suggested_by)
          .eq('identity_id', identityId)
          .maybeSingle();
        if (!existingCredit) {
          await supabase.from('user_tag_credits').insert({
            user_id: suggestion.suggested_by,
            identity_id: identityId,
          });
        }
      }

      onEventUpdated();
      fetchPendingSuggestions();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not approve suggestion');
    } finally {
      setProcessingSuggestionId(null);
    }
  };

  const rejectSuggestion = async (suggestion: PendingTagSuggestion) => {
    if (!user || !isApprover) return;
    setProcessingSuggestionId(suggestion.id);
    try {
      const { error } = await supabase
        .from('pending_tag_suggestions')
        .update({
          status: 'rejected',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', suggestion.id);
      if (error) throw error;
      fetchPendingSuggestions();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not reject suggestion');
    } finally {
      setProcessingSuggestionId(null);
    }
  };

  const withdrawOwnSuggestion = async (suggestion: PendingTagSuggestion) => {
    if (!user || suggestion.suggested_by !== user.id) return;
    setProcessingSuggestionId(suggestion.id);
    try {
      const { error } = await supabase
        .from('pending_tag_suggestions')
        .delete()
        .eq('id', suggestion.id);
      if (error) throw error;
      fetchPendingSuggestions();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not remove suggestion');
    } finally {
      setProcessingSuggestionId(null);
    }
  };

  const pendingForSection = (section: keyof typeof orderedTags | 'custom' | 'footer_tags', customSlug?: string) =>
    visiblePending.filter((s) => suggestionMatchesSection(s, section, customSlug));

  const ProducerIcon = getIcon(tagColors?.producer_icon, 'producer_icon');
  const DesignerIcon = getIcon(tagColors?.designer_icon, 'designer_icon');
  const ModelIcon = getIcon(tagColors?.model_icon, 'model_icon');
  const HairMakeupIcon = getIcon(tagColors?.hair_makeup_icon, 'hair_makeup_icon');
  const CityIcon = getIcon(tagColors?.city_icon, 'city_icon');
  const SeasonIcon = getIcon(tagColors?.season_icon, 'season_icon');
  const HeaderTagsIcon = getIcon(tagColors?.header_tags_icon, 'header_tags_icon');

  const shareLink = canonicalEventUrl(event.id);
  const embedLink = `${canonicalEventUrl(event.id)}?embed=1`;
  const embedCode = `<iframe src="${embedLink}" width="400" height="600" frameborder="0" title="${event.name}"></iframe>`;

  const copyToClipboard = async (text: string, type: 'link' | 'embed' | 'embedcode') => {
    try {
      await navigator.clipboard.writeText(text);
      setShareCopied(type);
      setTimeout(() => setShareCopied(null), 2000);
    } catch {
      // fallback for older browsers
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setShareCopied(type);
      setTimeout(() => setShareCopied(null), 2000);
    }
  };

  const copyEventEmailCard = async () => {
    const plain = buildEventEmailPlainText(event);
    const html = buildEventEmailRichHtml(event);
    const markCopied = () => {
      setShareCopied('email');
      setTimeout(() => setShareCopied(null), 2000);
    };
    try {
      if (typeof navigator.clipboard?.write === 'function' && typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/plain': new Blob([plain], { type: 'text/plain' }),
            'text/html': new Blob([html], { type: 'text/html' }),
          }),
        ]);
        markCopied();
        return;
      }
    } catch {
      /* fall through to plain text */
    }
    try {
      await navigator.clipboard.writeText(plain);
      markCopied();
    } catch {
      const ta = document.createElement('textarea');
      ta.value = plain;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      markCopied();
    }
  };

  const canEdit = user && (isAdmin || event.created_by === user.id);

  const startLongPress = (section: keyof typeof orderedTags) => {
    if (reorderSection || customReorderSlug) return;
    clearLongPress();
    longPressActivatedRef.current = false;
    longPressTimerRef.current = window.setTimeout(() => {
      longPressActivatedRef.current = true;
      reorderModeEnteredAtRef.current = Date.now();
      setReorderSection(section);
      setDragIndex(null);
      onReorderModeEntered?.();
    }, 220);
  };

  const clearLongPress = (e?: React.MouseEvent | React.TouchEvent | React.PointerEvent) => {
    const didActivate = longPressActivatedRef.current;
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressActivatedRef.current = false;
    if (didActivate) {
      const target = e?.target as HTMLElement | undefined;
      const isInteractiveTarget = target?.closest?.('button, a, input, [role="button"]');
      if (e && !isInteractiveTarget) {
        e.preventDefault();
        e.nativeEvent?.preventDefault?.();
      }
      if (!isInteractiveTarget) {
        longPressTargetRef.current = target ?? null;
        skipNextClickRef.current = true;
        window.setTimeout(() => {
          skipNextClickRef.current = false;
          longPressTargetRef.current = null;
        }, 400);
      }
    }
  };

  const handlePillClick = (e: React.MouseEvent, fn: () => void) => {
    const target = longPressTargetRef.current;
    const isSameTarget = target && (
      e.target === target ||
      (target as Node).contains?.(e.target as Node) ||
      (e.target as Node)?.contains?.(target as Node)
    );
    const shouldSkip = skipNextClickRef.current && isSameTarget;
    if (shouldSkip) {
      e.preventDefault();
      e.stopPropagation();
      skipNextClickRef.current = false;
      longPressTargetRef.current = null;
      return;
    }
    fn();
  };

  const clearReorderMode = () => {
    setReorderSection(null);
    setDragIndex(null);
    setDropIndex(null);
    setCustomReorderSlug(null);
    setCustomDragIndex(null);
    setCustomDropIndex(null);
    setAddingFor(null);
    setNewTagValue('');
  };

  const persistTagOrder = async (section: keyof typeof orderedTags, next: string[]) => {
    const nextOrdered = { ...orderedTags, [section]: next };
    setOrderedTags(nextOrdered);
    saveOrder({ orderedTags: nextOrdered, orderedCustomTags });
  };

  const moveTag = async (section: keyof typeof orderedTags, toIndex: number) => {
    if (dragIndex === null || dragIndex === toIndex) return;
    const source = [...orderedTags[section]];
    const [moved] = source.splice(dragIndex, 1);
    source.splice(toIndex, 0, moved);
    setDragIndex(toIndex);
    await persistTagOrder(section, source);
  };

  const tagInteractionProps = (section: keyof typeof orderedTags, idx: number, dragType?: string, dragValue?: string) => ({
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0 && e.button !== undefined) return; /* only primary button */
      startLongPress(section);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    onPointerUp: (e: React.PointerEvent) => {
      clearLongPress(e);
      try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    },
    onPointerCancel: (e: React.PointerEvent) => {
      clearLongPress(e);
      try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    },
    /* Mouse/touch still needed for click-to-filter and as pointer-event fallback */
    onMouseUp: (e: React.MouseEvent) => clearLongPress(e),
    onTouchEnd: (e: React.TouchEvent) => clearLongPress(e),
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      if (isAnyReorderMode) {
        setDragIndex(idx);
      } else if (dragType != null && dragValue != null) {
        e.dataTransfer.setData('text/plain', `tag-filter:${dragType}:${dragValue}`);
        e.dataTransfer.effectAllowed = 'copy';
      }
    },
    onDragEnd: () => {
      setDragIndex(null);
      setDropIndex(null);
    },
    onDragOver: (e: React.DragEvent) => {
      if (isAnyReorderMode) {
        e.preventDefault();
        setDropIndex(idx);
      }
    },
    onDragLeave: () => {
      if (isAnyReorderMode && dropIndex === idx) setDropIndex(null);
    },
    onDrop: async () => {
      if (isAnyReorderMode) {
        await moveTag(section, idx);
        setDropIndex(null);
      }
    }
  });

  const startCustomLongPress = (slug: string) => {
    if (reorderSection || customReorderSlug) return;
    clearLongPress();
    longPressActivatedRef.current = false;
    longPressTimerRef.current = window.setTimeout(() => {
      longPressActivatedRef.current = true;
      reorderModeEnteredAtRef.current = Date.now();
      setCustomReorderSlug(slug);
      setCustomDragIndex(null);
      setCustomDropIndex(null);
      onReorderModeEntered?.();
    }, 250);
  };

  const persistCustomTagOrder = async (slug: string, next: string[]) => {
    const nextCustom = { ...orderedCustomTags, [slug]: next };
    setOrderedCustomTags(nextCustom);
    saveOrder({ orderedTags, orderedCustomTags: nextCustom });
  };

  const moveCustomTag = async (slug: string, toIndex: number) => {
    if (customDragIndex === null || customDragIndex === toIndex) return;
    const source = [...(orderedCustomTags[slug] || [])];
    const [moved] = source.splice(customDragIndex, 1);
    source.splice(toIndex, 0, moved);
    setCustomDragIndex(toIndex);
    await persistCustomTagOrder(slug, source);
  };

  const customTagInteractionProps = (slug: string, idx: number, val?: string) => ({
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      startCustomLongPress(slug);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    onPointerUp: (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      clearLongPress(e as unknown as React.MouseEvent);
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    },
    onPointerCancel: (e: React.PointerEvent) => {
      clearLongPress();
      try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    },
    onMouseDown: () => startCustomLongPress(slug),
    onMouseUp: (e: React.MouseEvent) => clearLongPress(e),
    onTouchStart: () => startCustomLongPress(slug),
    onTouchEnd: (e: React.TouchEvent) => clearLongPress(e),
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      if (isAnyReorderMode) {
        setCustomDragIndex(idx);
      } else if (val != null) {
        e.dataTransfer.setData('text/plain', `tag-filter:custom_performer:${slug}\x00${val}`);
        e.dataTransfer.effectAllowed = 'copy';
      }
    },
    onDragEnd: () => {
      setCustomDragIndex(null);
      setCustomDropIndex(null);
    },
    onDragOver: (e: React.DragEvent) => {
      if (isAnyReorderMode) {
        e.preventDefault();
        setCustomDropIndex(idx);
      }
    },
    onDragLeave: () => {
      if (isAnyReorderMode && customDropIndex === idx) setCustomDropIndex(null);
    },
    onDrop: async () => {
      if (isAnyReorderMode) {
        await moveCustomTag(slug, idx);
        setCustomDropIndex(null);
      }
    }
  });

  useEffect(() => {
    return () => clearLongPress();
  }, []);

  useEffect(() => {
    if (!isAnyReorderMode) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (cardRootRef.current?.contains(target)) return;
      clearReorderMode();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [isAnyReorderMode]);

  const handleDelete = async () => {
    if (!user || !canEdit) return;

    if (!confirm('Are you sure you want to delete this show? This action cannot be undone.')) {
      return;
    }

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', event.id);

      if (error) throw error;

      onEventUpdated();
    } catch (error) {
      console.error('Error deleting event:', error);
      alert('Failed to delete event');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const isInteractive = target.closest('button') || target.closest('a') || target.closest('[data-event-actions]') || target.closest('[data-tag-pill]');

    if (isAnyReorderMode) {
      if (wiggleOnlyClearsOnClickAway) {
        e.stopPropagation();
        return;
      }
      /* Clicks on tag pills = still reordering; only clear when clicking card background/title/etc */
      if (target.closest('[data-tag-pill]')) {
        e.stopPropagation();
        return;
      }
      /* Layout shifts when wiggle starts – mouse may release elsewhere. Ignore clicks within 800ms of entering. */
      if (Date.now() - reorderModeEnteredAtRef.current < 800) {
        e.stopPropagation();
        return;
      }
      e.stopPropagation();
      clearReorderMode();
      return;
    }

    if (isInteractive) return;
    if (!onViewClick) return;
    onViewClick(event.id);
  };

  if (stackPhotoOnly) {
    return (
      <div className={`rounded-lg shadow-md overflow-hidden shrink-0 h-48 ${event.image_url ? 'bg-transparent' : 'bg-gray-200'}`}>
        {event.image_url ? (
          <img
            src={event.image_url}
            alt=""
            className="w-full h-full object-cover"
            style={imageOpacity !== undefined ? { opacity: imageOpacity } : undefined}
          />
        ) : null}
      </div>
    );
  }

  const suggestPlaceholder = (section: keyof typeof orderedTags | 'custom' | 'footer_tags', label?: string) =>
    label ? `Suggest ${label}` : { header_tags: 'Suggest tag', producers: 'Suggest producer', featured_designers: 'Suggest designer', models: 'Suggest model', hair_makeup: 'Suggest artist', footer_tags: 'Suggest collection', custom: 'Suggest tag' }[section] || 'Suggest tag';

  const suggestPill = (section: keyof typeof orderedTags | 'custom' | 'footer_tags', customSlug?: string, label?: string) => {
    const isActive = addingFor?.section === section && (section !== 'custom' || addingFor?.customSlug === customSlug);
    if (!isActive) return null;
    return (
      <span
        data-tag-pill
        className={`inline-flex items-center rounded-md bg-gray-300 text-gray-600 text-xs px-2 py-1 min-w-[100px] ${showWiggle ? 'pill-wiggle' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="text"
          value={newTagValue}
          onChange={(e) => setNewTagValue(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Escape') {
              setAddingFor(null);
              setNewTagValue('');
            }
            if (e.key === 'Enter') {
              e.preventDefault();
              submitPendingSuggestion(section, section === 'custom' ? customSlug : undefined);
            }
          }}
          placeholder={suggestPlaceholder(section, label)}
          className="bg-transparent border-none outline-none focus:ring-0 w-full min-w-0 text-xs text-gray-700 placeholder-gray-500 py-0"
          autoFocus
          aria-label={suggestPlaceholder(section, label)}
        />
      </span>
    );
  };

  const renderSuggestionActions = (
    suggestion: PendingTagSuggestion,
    isOwn: boolean,
    canRemove: boolean
  ) => {
    if (!showWiggle) {
      return <span className="text-[11px] leading-none text-gray-500 select-none">?</span>;
    }

    return (
      <>
        {canRemove && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (isOwn) withdrawOwnSuggestion(suggestion);
              else rejectSuggestion(suggestion);
            }}
            className="text-gray-500 hover:text-gray-700 p-0.5 -m-0.5 touch-manipulation shrink-0"
            disabled={processingSuggestionId === suggestion.id}
            title={isOwn ? 'Remove my suggestion' : 'Reject'}
          >
            <X size={12} />
          </button>
        )}
        {isApprover && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              approveSuggestion(suggestion);
            }}
            className="text-gray-500 hover:text-gray-700 p-0.5 -m-0.5 touch-manipulation shrink-0"
            disabled={processingSuggestionId === suggestion.id}
            title="Approve"
          >
            <Check size={12} />
          </button>
        )}
      </>
    );
  };

  return (
    <>
      <div
        ref={cardRootRef}
        className={`${imageOpacity !== undefined ? 'bg-transparent' : 'bg-white'} rounded-lg shadow-md hover:shadow-xl transition-all relative ${onViewClick ? 'cursor-pointer' : ''}`}
        onClick={handleCardClick}
        role={onViewClick ? 'button' : undefined}
        tabIndex={onViewClick ? 0 : undefined}
        onKeyDown={onViewClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (isAnyReorderMode) { clearReorderMode(); if (onViewClick) { const section = customReorderSlug ? undefined : (reorderSection ?? undefined); onViewClick(event.id, true, section, customReorderSlug ?? undefined); } } else { onViewClick(event.id); } } } : undefined}
      >
        {event.image_url && (
          <div className="overflow-hidden rounded-t-lg shrink-0">
            <img
              src={event.image_url}
              alt={event.name}
              className="w-full h-48 object-cover flex-shrink-0 rounded-t-lg"
              style={imageOpacity !== undefined ? { opacity: imageOpacity } : undefined}
            />
          </div>
        )}
        <div className={`p-6 min-w-0 ${imageOpacity !== undefined ? 'bg-white' : ''}`}>
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              {viewHref && !onViewClick ? (
                viewHref.startsWith('http://') || viewHref.startsWith('https://') ? (
                  <a href={viewHref} className="text-xl font-bold text-gray-900 block min-w-0">
                    {event.name}
                  </a>
                ) : (
                  <Link to={viewHref} className="text-xl font-bold text-gray-900 block min-w-0">
                    {event.name}
                  </Link>
                )
              ) : (
                <h3 className="text-xl font-bold text-gray-900 min-w-0">
                  {event.name}
                </h3>
              )}
            </div>
            <div className="relative shrink-0" data-event-actions>
              <button
                onClick={(e) => { e.stopPropagation(); setShowActionsMenu(!showActionsMenu); }}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded transition-colors"
                title="Actions"
                aria-haspopup="true"
                aria-expanded={showActionsMenu}
              >
                <MoreVertical size={18} />
              </button>
              {showActionsMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowActionsMenu(false)}
                    aria-hidden="true"
                  />
                  <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                    <button
                      onClick={() => { copyToClipboard(shareLink, 'link'); setShowActionsMenu(false); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between gap-2"
                    >
                      <Share2 size={14} className="text-gray-500" />
                      <span>Copy link</span>
                      {shareCopied === 'link' && <span className="text-green-600 text-xs">Copied!</span>}
                    </button>
                    <button
                      onClick={() => { copyToClipboard(embedLink, 'embed'); setShowActionsMenu(false); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between"
                    >
                      <Share2 size={14} className="text-gray-500" />
                      <span>Copy embed URL</span>
                    </button>
                    <button
                      onClick={() => { copyToClipboard(embedCode, 'embedcode'); setShowActionsMenu(false); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between border-t border-gray-100"
                    >
                      <Share2 size={14} className="text-gray-500" />
                      <span>Copy embed code</span>
                    </button>
                    <button
                      onClick={() => { void copyEventEmailCard(); setShowActionsMenu(false); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between border-t border-gray-100"
                    >
                      <Mail size={14} className="text-gray-500" />
                      <span>Copy for email</span>
                      {shareCopied === 'email' && <span className="text-green-600 text-xs">Copied!</span>}
                    </button>
                    {canEdit && (
                      <>
                        <div className="border-t border-gray-100 my-1" />
                        <button
                          onClick={() => {
                            openEventPanel('edit-event');
                            setShowActionsMenu(false);
                          }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                        >
                          <Edit size={14} className="text-blue-600" />
                          <span>Edit show</span>
                        </button>
                        <button
                          onClick={() => { handleDelete(); setShowActionsMenu(false); }}
                          disabled={isDeleting}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50 text-red-600"
                        >
                          <Trash2 size={14} />
                          <span>Delete show</span>
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap mb-2">
            {event.city && (
                <button
                data-tag-pill
                onClick={(e) => handlePillClick(e, () => { if (!isAnyReorderMode) onTagClick('city', event.city, event.city); })}
                onMouseDown={() => startLongPress('header_tags')}
                onMouseUp={(e: React.MouseEvent) => clearLongPress(e)}
                onMouseLeave={(e: React.MouseEvent) => clearLongPress(e)}
                onTouchStart={() => startLongPress('header_tags')}
                onTouchEnd={(e: React.TouchEvent) => clearLongPress(e)}
                draggable
                onDragStart={(e: React.DragEvent) => {
                  if (!isAnyReorderMode) {
                    e.dataTransfer.setData('text/plain', `tag-filter:city:${event.city}`);
                    e.dataTransfer.effectAllowed = 'copy';
                  }
                }}
                className={`${HEADER_ICON_INSIDE_PILL_CLASS} ${showWiggle ? 'pill-wiggle' : ''}`}
                style={{
                  backgroundColor: tagColors?.city_bg_color || '#dbeafe',
                  color: tagColors?.city_text_color || '#1e40af',
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
                  onClick={(e) => handlePillClick(e, () => { if (!isAnyReorderMode) onTagClick('season', season, season); })}
                  onMouseDown={() => startLongPress('header_tags')}
                  onMouseUp={(e: React.MouseEvent) => clearLongPress(e)}
                  onMouseLeave={(e: React.MouseEvent) => clearLongPress(e)}
                  onTouchStart={() => startLongPress('header_tags')}
                  onTouchEnd={(e: React.TouchEvent) => clearLongPress(e)}
                  draggable
                  onDragStart={(e: React.DragEvent) => {
                    if (!isAnyReorderMode) {
                      e.dataTransfer.setData('text/plain', `tag-filter:season:${season}`);
                      e.dataTransfer.effectAllowed = 'copy';
                    }
                  }}
                  className={`${HEADER_ICON_INSIDE_PILL_CLASS} ${showWiggle ? 'pill-wiggle' : ''}`}
                  style={{
                    backgroundColor: tagColors?.season_bg_color || '#ffedd5',
                    color: tagColors?.season_text_color || '#c2410c',
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
            const tags = orderedTags.header_tags || [];
            const hasHeader =
              tags.length > 0 ||
              pendingForSection('header_tags').length > 0 ||
              isAnyReorderMode ||
              !!(event.date && isEventUpcoming(event.date));
            if (!hasHeader) return null;
            const showMore = !isAnyReorderMode && tags.length > TAG_LIMIT && !expandedTagSections['header_tags'];
            const visible = showMore ? tags.slice(0, TAG_LIMIT) : tags;
            return (
              <div className="mb-3">
                <div className="flex flex-wrap gap-2 items-center">
                  {visible.map((tag, idx) => (
                    <button
                      key={idx}
                      onClick={(e) => handlePillClick(e, () => {
                        if (!isAnyReorderMode) onTagClick('header_tags', resolveTag('header_tags', tag).identityId || tag, tag);
                      })}
                      data-tag-pill
                      className={`${tagPillSplitSegmentGroupClass} p-0 text-xs transition-colors hover:opacity-80 ${showWiggle ? 'pill-wiggle' : ''} ${isAnyReorderMode && dropIndex === idx ? 'ring-2 ring-blue-400 ring-offset-1' : ''}`}
                      {...tagInteractionProps('header_tags', idx, 'header_tags', tag)}
                      style={
                        isAnyReorderMode && dropIndex === idx ? ({ '--pill-scale': 1.05 } as React.CSSProperties) : undefined
                      }
                    >
                      <TagPillSplitLabel
                        fitToContainer
                        leadingSlot={<HeaderTagsIcon size={12} className="shrink-0" aria-hidden />}
                        text={resolveTag('header_tags', tag).display}
                        segmentColors={{
                          backgroundColor: tagColors?.header_tags_bg_color || '#ccfbf1',
                          color: tagColors?.header_tags_text_color || '#0f766e',
                        }}
                      />
                    </button>
                  ))}
                    {pendingForSection('header_tags').map((suggestion) => {
                      const isOwn = !!user && suggestion.suggested_by === user.id;
                      const canRemove = isApprover || isOwn;
                      return (
                    <span
                      key={suggestion.id}
                      data-tag-pill
                      className={`relative ${tagPillSplitSegmentGroupClass} p-0 text-xs cursor-pointer select-none ${showWiggle ? 'pill-wiggle' : ''}`}
                      onMouseDown={() => startLongPress('header_tags')}
                      onMouseUp={(e) => clearLongPress(e)}
                      onTouchStart={() => startLongPress('header_tags')}
                      onTouchEnd={(e) => clearLongPress(e)}
                    >
                      <TagPillSplitLabel
                        fitToContainer
                        leadingSlot={<HeaderTagsIcon size={12} className="shrink-0" aria-hidden />}
                        text={suggestion.proposed_name}
                        segmentColors={PENDING_TAG_PILL_COLORS}
                      />
                      {renderSuggestionActions(suggestion, isOwn, canRemove)}
                    </span>
                  );})}
                  {event.date && isEventUpcoming(event.date) && (
                    <EventCountdownPill
                      eventDate={event.date}
                      eventName={event.name}
                      countdownOpenUrl={countdownOpenUrl}
                      countdownBg={tagColors?.countdown_bg_color}
                      countdownText={tagColors?.countdown_text_color}
                      showWiggle={showWiggle}
                      onExpired={onEventUpdated}
                      onButtonClick={(e) =>
                        handlePillClick(e, () => {
                          if (countdownOpenUrl) window.open(countdownOpenUrl, '_blank', 'noopener,noreferrer');
                        })
                      }
                      onMouseDown={() => startLongPress('header_tags')}
                      onMouseUp={(e: React.MouseEvent) => clearLongPress(e)}
                      onMouseLeave={(e: React.MouseEvent) => clearLongPress(e)}
                      onTouchStart={() => startLongPress('header_tags')}
                      onTouchEnd={(e: React.TouchEvent) => clearLongPress(e)}
                    />
                  )}
                  {suggestPill('header_tags')}
                  {isAnyReorderMode && addingFor?.section !== 'header_tags' && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setAddingFor({ section: 'header_tags' }); setNewTagValue(''); }}
                      className="text-xs px-2 py-1 rounded-md border border-dashed border-gray-300 text-gray-500 hover:bg-gray-50 inline-flex items-center"
                      title="Suggest tag"
                    >
                      <Plus size={12} />
                    </button>
                  )}
                  {tags.length > TAG_LIMIT && (
                    <button
                      type="button"
                      onClick={() => toggleTagSection('header_tags')}
                      className="text-xs text-gray-400 hover:text-gray-600 inline-flex items-center shrink-0 justify-center rounded-md"
                      title={expandedTagSections['header_tags'] ? 'Show less' : 'View more tags'}
                    >
                      {expandedTagSections['header_tags'] ? '−' : `+${tags.length - TAG_LIMIT}`}
                    </button>
                  )}
                </div>
              </div>
            );
          })()}

          {event.description && (
            <p className="text-gray-600 mb-4 text-sm">{event.description}</p>
          )}

          <div className="space-y-1 mb-4">
            <div className="flex items-center text-gray-500 text-sm">
              <Calendar size={16} className="mr-2 flex-shrink-0" />
              {formatEventDateDisplay(event.date)}
            </div>
            {(() => {
              const addressLine =
                (event.formatted_address && event.formatted_address.trim()) ||
                (event.address && event.address.trim()) ||
                '';
              if (!event.location && !addressLine) return null;
              return (
                <div className="flex items-start text-gray-500 text-sm">
                  <MapPin size={16} className="mr-2 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    {event.location && <span className="block">{event.location}</span>}
                    {addressLine && (
                      <span className={`block whitespace-pre-line ${event.location ? 'text-xs mt-0.5' : ''}`}>
                        {addressLine}
                      </span>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="space-y-3 mb-4 pt-4 border-t">
            {pendingError && (
              <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1">
                Pending tag suggestions unavailable: {pendingError}
              </div>
            )}
            {(orderedTags.producers?.length > 0 || pendingForSection('producers').length > 0 || isAnyReorderMode) && (() => {
              const tags = orderedTags.producers;
              const showMore = !isAnyReorderMode && tags.length > TAG_LIMIT && !expandedTagSections['producers'];
              const visible = showMore ? tags.slice(0, TAG_LIMIT) : tags;
              return (
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-gray-700 mb-1">
                    <div className="flex items-center">
                      <ProducerIcon size={14} className="mr-1" />
                      Produced By
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 items-center">
                    {visible.map((producer, idx) => (
                      <button
                        key={idx}
                        onClick={(e) => handlePillClick(e, () => {
                          if (!isAnyReorderMode) onTagClick('producer', resolveTag('producer', producer).identityId || producer, producer);
                        })}
                        data-tag-pill
                        className={`${tagPillSplitSegmentGroupClass} p-0 text-xs transition-colors hover:opacity-80 ${showWiggle ? 'pill-wiggle' : ''} ${isAnyReorderMode && dropIndex === idx ? 'ring-2 ring-blue-400 ring-offset-1' : ''}`}
                        {...tagInteractionProps('producers', idx, 'producer', producer)}
                        style={
                          isAnyReorderMode && dropIndex === idx ? ({ '--pill-scale': 1.05 } as React.CSSProperties) : undefined
                        }
                      >
                        <TagPillSplitLabel fitToContainer
                          text={resolveTag('producer', producer).display}
                          segmentColors={{
                            backgroundColor: tagColors?.producer_bg_color || '#f3f4f6',
                            color: tagColors?.producer_text_color || '#374151',
                          }}
                        />
                      </button>
                    ))}
                    {pendingForSection('producers').map((suggestion) => {
                      const isOwn = !!user && suggestion.suggested_by === user.id;
                      const canRemove = isApprover || isOwn;
                      return (
                      <span
                        key={suggestion.id}
                        data-tag-pill
                        className={`relative ${tagPillSplitSegmentGroupClass} p-0 text-xs cursor-pointer select-none ${showWiggle ? 'pill-wiggle' : ''}`}
                        onMouseDown={() => startLongPress('producers')}
                        onMouseUp={(e) => clearLongPress(e)}
                        onTouchStart={() => startLongPress('producers')}
                        onTouchEnd={(e) => clearLongPress(e)}
                      >
                        <TagPillSplitLabel fitToContainer text={suggestion.proposed_name} segmentColors={PENDING_TAG_PILL_COLORS} />
                        {renderSuggestionActions(suggestion, isOwn, canRemove)}
                      </span>
                    );})}
                    {suggestPill('producers')}
                    {isAnyReorderMode && addingFor?.section !== 'producers' && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setAddingFor({ section: 'producers' }); setNewTagValue(''); }}
                        className="text-xs px-2 py-1 rounded-md border border-dashed border-gray-300 text-gray-500 hover:bg-gray-50 inline-flex items-center"
                        title="Suggest producer"
                      >
                        <Plus size={12} />
                      </button>
                    )}
                    {tags.length > TAG_LIMIT && (
                      <button type="button" onClick={() => toggleTagSection('producers')} className="text-xs text-gray-400 hover:text-gray-600 inline-flex shrink-0 items-center justify-center rounded-md" title={expandedTagSections['producers'] ? 'Show less' : 'View more tags'}>
                        {expandedTagSections['producers'] ? '−' : `+${tags.length - TAG_LIMIT}`}
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            {(orderedTags.featured_designers?.length > 0 || pendingForSection('featured_designers').length > 0 || isAnyReorderMode) && (() => {
              const tags = orderedTags.featured_designers;
              const showMore = !isAnyReorderMode && tags.length > TAG_LIMIT && !expandedTagSections['designers'];
              const visible = showMore ? tags.slice(0, TAG_LIMIT) : tags;
              return (
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-gray-700 mb-1">
                    <div className="flex items-center">
                      <DesignerIcon size={14} className="mr-1" />
                      Featured Designers
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 items-center">
                    {visible.map((designer, idx) => (
                      <button
                        key={idx}
                        onClick={(e) => handlePillClick(e, () => {
                          if (!isAnyReorderMode) onTagClick('designer', resolveTag('designer', designer).identityId || designer, designer);
                        })}
                        data-tag-pill
                        className={`${tagPillSplitSegmentGroupClass} p-0 text-xs transition-colors hover:opacity-80 ${showWiggle ? 'pill-wiggle' : ''} ${isAnyReorderMode && dropIndex === idx ? 'ring-2 ring-blue-400 ring-offset-1' : ''}`}
                        {...tagInteractionProps('featured_designers', idx, 'designer', designer)}
                        style={
                          isAnyReorderMode && dropIndex === idx ? ({ '--pill-scale': 1.05 } as React.CSSProperties) : undefined
                        }
                      >
                        <TagPillSplitLabel fitToContainer
                          text={resolveTag('designer', designer).display}
                          segmentColors={{
                            backgroundColor: tagColors?.designer_bg_color || '#fef3c7',
                            color: tagColors?.designer_text_color || '#b45309',
                          }}
                        />
                      </button>
                    ))}
                    {pendingForSection('featured_designers').map((suggestion) => {
                      const isOwn = !!user && suggestion.suggested_by === user.id;
                      const canRemove = isApprover || isOwn;
                      return (
                      <span key={suggestion.id} data-tag-pill className={`relative ${tagPillSplitSegmentGroupClass} p-0 text-xs cursor-pointer select-none ${showWiggle ? 'pill-wiggle' : ''}`} onMouseDown={() => startLongPress('featured_designers')} onMouseUp={(e) => clearLongPress(e)} onTouchStart={() => startLongPress('featured_designers')} onTouchEnd={(e) => clearLongPress(e)}>
                        <TagPillSplitLabel fitToContainer text={suggestion.proposed_name} segmentColors={PENDING_TAG_PILL_COLORS} />
                        {renderSuggestionActions(suggestion, isOwn, canRemove)}
                      </span>
                    );})}
                    {suggestPill('featured_designers')}
                    {isAnyReorderMode && addingFor?.section !== 'featured_designers' && (
                      <button type="button" onClick={(e) => { e.stopPropagation(); setAddingFor({ section: 'featured_designers' }); setNewTagValue(''); }} className="text-xs px-2 py-1 rounded-md border border-dashed border-gray-300 text-gray-500 hover:bg-gray-50 inline-flex items-center" title="Suggest designer">
                        <Plus size={12} />
                      </button>
                    )}
                    {tags.length > TAG_LIMIT && (
                      <button type="button" onClick={() => toggleTagSection('designers')} className="text-xs text-gray-400 hover:text-gray-600 inline-flex shrink-0 items-center justify-center rounded-md" title={expandedTagSections['designers'] ? 'Show less' : 'View more tags'}>
                        {expandedTagSections['designers'] ? '−' : `+${tags.length - TAG_LIMIT}`}
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            {(orderedTags.models?.length > 0 || pendingForSection('models').length > 0 || isAnyReorderMode) && (() => {
              const tags = orderedTags.models;
              const showMore = !isAnyReorderMode && tags.length > TAG_LIMIT && !expandedTagSections['models'];
              const visible = showMore ? tags.slice(0, TAG_LIMIT) : tags;
              return (
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-gray-700 mb-1">
                    <div className="flex items-center">
                      <ModelIcon size={14} className="mr-1" />
                      Featured Models
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 items-center">
                    {visible.map((model, idx) => (
                      <button
                        key={idx}
                        onClick={(e) => handlePillClick(e, () => {
                          if (!isAnyReorderMode) onTagClick('model', resolveTag('model', model).identityId || model, model);
                        })}
                        data-tag-pill
                        className={`${tagPillSplitSegmentGroupClass} p-0 text-xs transition-colors hover:opacity-80 ${showWiggle ? 'pill-wiggle' : ''} ${isAnyReorderMode && dropIndex === idx ? 'ring-2 ring-blue-400 ring-offset-1' : ''}`}
                        {...tagInteractionProps('models', idx, 'model', model)}
                        style={
                          isAnyReorderMode && dropIndex === idx ? ({ '--pill-scale': 1.05 } as React.CSSProperties) : undefined
                        }
                      >
                        <TagPillSplitLabel fitToContainer
                          text={resolveTag('model', model).display}
                          segmentColors={{
                            backgroundColor: tagColors?.model_bg_color || '#fce7f3',
                            color: tagColors?.model_text_color || '#be185d',
                          }}
                        />
                      </button>
                    ))}
                    {pendingForSection('models').map((suggestion) => {
                      const isOwn = !!user && suggestion.suggested_by === user.id;
                      const canRemove = isApprover || isOwn;
                      return (
                      <span key={suggestion.id} data-tag-pill className={`relative ${tagPillSplitSegmentGroupClass} p-0 text-xs cursor-pointer select-none ${showWiggle ? 'pill-wiggle' : ''}`} onMouseDown={() => startLongPress('models')} onMouseUp={(e) => clearLongPress(e)} onTouchStart={() => startLongPress('models')} onTouchEnd={(e) => clearLongPress(e)}>
                        <TagPillSplitLabel fitToContainer text={suggestion.proposed_name} segmentColors={PENDING_TAG_PILL_COLORS} />
                        {renderSuggestionActions(suggestion, isOwn, canRemove)}
                      </span>
                    );})}
                    {suggestPill('models')}
                    {isAnyReorderMode && addingFor?.section !== 'models' && (
                      <button type="button" onClick={(e) => { e.stopPropagation(); setAddingFor({ section: 'models' }); setNewTagValue(''); }} className="text-xs px-2 py-1 rounded-md border border-dashed border-gray-300 text-gray-500 hover:bg-gray-50 inline-flex items-center" title="Suggest model">
                        <Plus size={12} />
                      </button>
                    )}
                    {tags.length > TAG_LIMIT && (
                      <button type="button" onClick={() => toggleTagSection('models')} className="text-xs text-gray-400 hover:text-gray-600 inline-flex shrink-0 items-center justify-center rounded-md" title={expandedTagSections['models'] ? 'Show less' : 'View more tags'}>
                        {expandedTagSections['models'] ? '−' : `+${tags.length - TAG_LIMIT}`}
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            {(orderedTags.hair_makeup?.length > 0 || pendingForSection('hair_makeup').length > 0 || isAnyReorderMode) && (() => {
              const tags = orderedTags.hair_makeup;
              const showMore = !isAnyReorderMode && tags.length > TAG_LIMIT && !expandedTagSections['hair_makeup'];
              const visible = showMore ? tags.slice(0, TAG_LIMIT) : tags;
              return (
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-gray-700 mb-1">
                    <div className="flex items-center">
                      <HairMakeupIcon size={14} className="mr-1" />
                      Hair & Makeup
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 items-center">
                    {visible.map((artist, idx) => (
                      <button
                        key={idx}
                        onClick={(e) => handlePillClick(e, () => {
                          if (!isAnyReorderMode) onTagClick('hair_makeup', resolveTag('hair_makeup', artist).identityId || artist, artist);
                        })}
                        data-tag-pill
                        className={`${tagPillSplitSegmentGroupClass} p-0 text-xs transition-colors hover:opacity-80 ${showWiggle ? 'pill-wiggle' : ''} ${isAnyReorderMode && dropIndex === idx ? 'ring-2 ring-blue-400 ring-offset-1' : ''}`}
                        {...tagInteractionProps('hair_makeup', idx, 'hair_makeup', artist)}
                        style={
                          isAnyReorderMode && dropIndex === idx ? ({ '--pill-scale': 1.05 } as React.CSSProperties) : undefined
                        }
                      >
                        <TagPillSplitLabel fitToContainer
                          text={resolveTag('hair_makeup', artist).display}
                          segmentColors={{
                            backgroundColor: tagColors?.hair_makeup_bg_color || '#f3e8ff',
                            color: tagColors?.hair_makeup_text_color || '#7e22ce',
                          }}
                        />
                      </button>
                    ))}
                    {pendingForSection('hair_makeup').map((suggestion) => {
                      const isOwn = !!user && suggestion.suggested_by === user.id;
                      const canRemove = isApprover || isOwn;
                      return (
                      <span
                        key={suggestion.id}
                        data-tag-pill
                        className={`relative ${tagPillSplitSegmentGroupClass} p-0 text-xs cursor-pointer select-none ${showWiggle ? 'pill-wiggle' : ''}`}
                        onMouseDown={() => startLongPress('hair_makeup')}
                        onMouseUp={(e) => clearLongPress(e)}
                        onTouchStart={() => startLongPress('hair_makeup')}
                        onTouchEnd={(e) => clearLongPress(e)}
                      >
                        <TagPillSplitLabel fitToContainer text={suggestion.proposed_name} segmentColors={PENDING_TAG_PILL_COLORS} />
                        {renderSuggestionActions(suggestion, isOwn, canRemove)}
                      </span>
                    );})}
                    {suggestPill('hair_makeup')}
                    {isAnyReorderMode && addingFor?.section !== 'hair_makeup' && (
                      <button type="button" onClick={(e) => { e.stopPropagation(); setAddingFor({ section: 'hair_makeup' }); setNewTagValue(''); }} className="text-xs px-2 py-1 rounded-md border border-dashed border-gray-300 text-gray-500 hover:bg-gray-50 inline-flex items-center" title="Suggest artist">
                        <Plus size={12} />
                      </button>
                    )}
                    {tags.length > TAG_LIMIT && (
                      <button type="button" onClick={() => toggleTagSection('hair_makeup')} className="text-xs text-gray-400 hover:text-gray-600 inline-flex shrink-0 items-center justify-center rounded-md" title={expandedTagSections['hair_makeup'] ? 'Show less' : 'View more tags'}>
                        {expandedTagSections['hair_makeup'] ? '−' : `+${tags.length - TAG_LIMIT}`}
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            {(() => {
              const ct = orderedCustomTags;
              const meta = (event.custom_tag_meta && typeof event.custom_tag_meta === 'object') ? event.custom_tag_meta : {};
              const slugToLabel = (s: string) => s.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
              const sharedBg = tagColors?.optional_tags_bg_color ?? '#e0e7ff';
              const sharedText = tagColors?.optional_tags_text_color ?? '#3730a3';
              const allTagDefs = Object.keys(ct).map((slug) => ({
                id: slug,
                slug,
                label: slugToLabel(slug),
                icon: meta[slug]?.icon ?? 'Tag',
                bg_color: sharedBg,
                text_color: sharedText,
              }));
              return allTagDefs
                .sort((a, b) => ((a as { sort_order?: number }).sort_order ?? 999) - ((b as { sort_order?: number }).sort_order ?? 999))
                .map((tagDef) => {
                  const tags = ct[tagDef.slug];
                  if (!tags || (tags.length === 0 && pendingForSection('custom', tagDef.slug).length === 0)) return null;
                  const CustomIcon = getIcon(tagDef.icon, 'producer_icon');
                  const showMore = !isAnyReorderMode && tags.length > TAG_LIMIT && !expandedTagSections[`custom_${tagDef.slug}`];
                  const visible = showMore ? tags.slice(0, TAG_LIMIT) : tags;
                  return (
                    <div key={tagDef.id ?? tagDef.slug}>
                      <div className="flex items-center justify-between text-xs font-semibold text-gray-700 mb-1">
                        <div className="flex items-center">
                          <CustomIcon size={14} className="mr-1" />
                          {tagDef.label}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1 items-center">
                        {visible.map((val, idx) => (
                          <button
                            key={idx}
                            onClick={(e) => handlePillClick(e, () => {
                              if (!isAnyReorderMode) {
                                const r = resolveTag(`custom:${tagDef.slug}`, val);
                                onTagClick(`custom_performer`, `${tagDef.slug}\x00${r.identityId || val}`, val);
                              }
                            })}
                            data-tag-pill
                            className={`${tagPillSplitSegmentGroupClass} p-0 text-xs transition-colors hover:opacity-80 ${showWiggle ? 'pill-wiggle' : ''} ${isAnyReorderMode && customDropIndex === idx ? 'ring-2 ring-blue-400 ring-offset-1' : ''}`}
                            {...customTagInteractionProps(tagDef.slug, idx, val)}
                            style={
                              isAnyReorderMode && customDropIndex === idx ? ({ '--pill-scale': 1.05 } as React.CSSProperties) : undefined
                            }
                          >
                            <TagPillSplitLabel fitToContainer
                              text={resolveTag(`custom:${tagDef.slug}`, val).display}
                              segmentColors={{
                                backgroundColor: tagDef.bg_color || '#e0e7ff',
                                color: tagDef.text_color || '#3730a3',
                              }}
                            />
                          </button>
                        ))}
                        {pendingForSection('custom', tagDef.slug).map((suggestion) => {
                          const isOwn = !!user && suggestion.suggested_by === user.id;
                          const canRemove = isApprover || isOwn;
                          return (
                          <span
                            key={suggestion.id}
                            data-tag-pill
                            className={`relative ${tagPillSplitSegmentGroupClass} p-0 text-xs cursor-pointer select-none ${showWiggle ? 'pill-wiggle' : ''}`}
                            onMouseDown={() => startCustomLongPress(tagDef.slug)}
                            onMouseUp={(e) => clearLongPress(e)}
                            onTouchStart={() => startCustomLongPress(tagDef.slug)}
                            onTouchEnd={(e) => clearLongPress(e)}
                          >
                            <TagPillSplitLabel fitToContainer text={suggestion.proposed_name} segmentColors={PENDING_TAG_PILL_COLORS} />
                            {renderSuggestionActions(suggestion, isOwn, canRemove)}
                          </span>
                        );})}
                        {suggestPill('custom', tagDef.slug, tagDef.label)}
                        {isAnyReorderMode && (addingFor?.section !== 'custom' || addingFor?.customSlug !== tagDef.slug) && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setAddingFor({ section: 'custom', customSlug: tagDef.slug, label: tagDef.label }); setNewTagValue(''); }}
                            className="text-xs px-2 py-1 rounded-md border border-dashed border-gray-300 text-gray-500 hover:bg-gray-50 inline-flex items-center"
                            title={`Suggest ${tagDef.label}`}
                          >
                            <Plus size={12} />
                          </button>
                        )}
                        {tags.length > TAG_LIMIT && (
                          <button
                            type="button"
                            onClick={() => toggleTagSection(`custom_${tagDef.slug}`)}
                            className="text-xs text-gray-400 hover:text-gray-600 inline-flex shrink-0 items-center justify-center rounded-md"
                          >
                            {expandedTagSections[`custom_${tagDef.slug}`] ? '−' : `+${tags.length - TAG_LIMIT}`}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                });
            })()}
            </div>

          {ratingAllowed && (
          <div className="flex items-center pt-4 border-t">
            <button
              type="button"
              onClick={() => openEventPanel('view-ratings')}
              className="flex items-center hover:bg-gray-50 p-2 -ml-2 transition-colors group"
              title="View all ratings"
            >
              <div className="flex items-center">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    size={18}
                    className={star <= averageRating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
                  />
                ))}
              </div>
              <span className="ml-2 text-gray-600 text-sm group-hover:text-blue-600 transition-colors">
                {averageRating > 0 ? averageRating.toFixed(1) : 'No ratings'} ({ratingCount})
              </span>
            </button>
          </div>
          )}

          {ratingAllowed && userRating && (
            <div className="mt-3 pt-3 border-t">
              <p className="text-sm text-gray-600 font-medium">
                Your rating: {userRating.rating} stars
              </p>
              {userRating.comment && (
                <p className="text-sm text-gray-500 mt-1 italic">
                  <CommentWithTags
                    comment={userRating.comment}
                    event={event}
                    tagColors={tagColors}
                    customPerformerTags={customPerformerTags}
                    wiggle={showWiggle}
                    fitTagPillsToContainer
                    onTagClick={onTagClick}
                  />
                </p>
              )}
            </div>
          )}

          {((orderedTags.footer_tags?.length > 0) || pendingForSection('footer_tags').length > 0 || isAnyReorderMode) && (() => {
            const tags = orderedTags.footer_tags || [];
            const showMore = !isAnyReorderMode && tags.length > TAG_LIMIT && !expandedTagSections['footer_tags'];
            const visible = showMore ? tags.slice(0, TAG_LIMIT) : tags;
            return (
              <div className="mt-3 pt-3 border-t">
                <div className="flex flex-wrap gap-1 items-center">
                  {visible.map((tag, idx) => (
                    <button
                      key={idx}
                      onClick={(e) => handlePillClick(e, () => {
                        if (!isAnyReorderMode) onTagClick('footer_tags', resolveTag('footer_tags', tag).identityId || tag, tag);
                      })}
                      data-tag-pill
                      className={`${tagPillSplitSegmentGroupClass} p-0 text-xs transition-colors hover:opacity-80 ${showWiggle ? 'pill-wiggle' : ''} ${isAnyReorderMode && dropIndex === idx ? 'ring-2 ring-blue-400 ring-offset-1' : ''}`}
                      {...tagInteractionProps('footer_tags', idx, 'footer_tags', tag)}
                      style={
                        isAnyReorderMode && dropIndex === idx ? ({ '--pill-scale': 1.05 } as React.CSSProperties) : undefined
                      }
                    >
                      <TagPillSplitLabel fitToContainer
                        text={resolveTag('footer_tags', tag).display}
                        segmentColors={{
                          backgroundColor: tagColors?.footer_tags_bg_color || '#d1fae5',
                          color: tagColors?.footer_tags_text_color || '#065f46',
                        }}
                      />
                    </button>
                  ))}
                    {pendingForSection('footer_tags').map((suggestion) => {
                      const isOwn = !!user && suggestion.suggested_by === user.id;
                      const canRemove = isApprover || isOwn;
                      return (
                    <span
                      key={suggestion.id}
                      data-tag-pill
                      className={`relative ${tagPillSplitSegmentGroupClass} p-0 text-xs cursor-pointer select-none ${showWiggle ? 'pill-wiggle' : ''}`}
                      onMouseDown={() => startLongPress('footer_tags')}
                      onMouseUp={(e) => clearLongPress(e)}
                      onTouchStart={() => startLongPress('footer_tags')}
                      onTouchEnd={(e) => clearLongPress(e)}
                    >
                      <TagPillSplitLabel fitToContainer text={suggestion.proposed_name} segmentColors={PENDING_TAG_PILL_COLORS} />
                      {renderSuggestionActions(suggestion, isOwn, canRemove)}
                    </span>
                  );})}
                  {suggestPill('footer_tags')}
                  {isAnyReorderMode && addingFor?.section !== 'footer_tags' && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setAddingFor({ section: 'footer_tags' }); setNewTagValue(''); }}
                      className="text-xs px-2 py-1 rounded-md border border-dashed border-gray-300 text-gray-500 hover:bg-gray-50 inline-flex items-center"
                      title="Suggest collection"
                    >
                      <Plus size={12} />
                    </button>
                  )}
                  {tags.length > TAG_LIMIT && (
                    <button type="button" onClick={() => toggleTagSection('footer_tags')} className="text-xs text-gray-400 hover:text-gray-600 inline-flex shrink-0 items-center justify-center rounded-md" title={expandedTagSections['footer_tags'] ? 'Show less' : 'View more tags'}>
                      {expandedTagSections['footer_tags'] ? '−' : `+${tags.length - TAG_LIMIT}`}
                    </button>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      <RatingModal
        isOpen={isRatingModalOpen && ratingAllowed}
        onClose={closeEventPanels}
        event={event}
        existingRating={userRating}
        onRatingSubmitted={onRatingSubmitted}
        tagColors={tagColors}
        customPerformerTags={customPerformerTags}
      />

      <ViewRatingsModal
        isOpen={isViewRatingsModalOpen && ratingAllowed}
        onClose={closeEventPanels}
        eventId={event.id}
        eventName={event.name}
        event={event}
        currentUserId={user?.id}
        onRatingSubmitted={onRatingSubmitted}
        tagColors={tagColors}
        customPerformerTags={customPerformerTags}
        allowRatingEdits={ratingAllowed}
        onTagClick={onTagClick}
      />

      <EditEventModal
        isOpen={isEditModalOpen}
        onClose={closeEventPanels}
        event={event}
        onEventUpdated={onEventUpdated}
      />

    </>
  );
}
