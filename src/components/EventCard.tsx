import { Calendar, MapPin, Star, Edit, Trash2, FileEdit, Share2, MoreVertical } from 'lucide-react';
import { Event, Rating, supabase } from '../lib/supabase';
import { getIcon } from '../lib/eventCardIcons';
import { getSeasonFromDate } from '../lib/season';
import { useState } from 'react';
import RatingModal from './RatingModal';
import EditEventModal from './EditEventModal';
import SuggestEditModal from './SuggestEditModal';
import ViewRatingsModal from './ViewRatingsModal';
import CommentWithTags from './CommentWithTags';
import { useAuth } from '../contexts/AuthContext';

interface EventCardProps {
  event: Event;
  averageRating: number;
  ratingCount: number;
  userRating?: Rating;
  onRatingSubmitted: () => void;
  onEventUpdated: () => void;
  onTagClick: (type: string, value: string) => void;
  /** When set, the card title links to this URL (e.g. single-event view) */
  viewHref?: string;
  /** When set, clicking the title opens overlay instead of navigating (e.g. openEventOverlay) */
  onViewClick?: (eventId: string) => void;
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
  };
  customPerformerTags?: { id: string; label: string; slug: string; icon: string; bg_color: string; text_color: string; sort_order?: number }[];
  /** When true, only show the photo (for stacked upcoming cards) */
  stackPhotoOnly?: boolean;
  /** Opacity for the image only (for stack front card photo blending) */
  imageOpacity?: number;
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
  imageOpacity
}: EventCardProps) {
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [isViewRatingsModalOpen, setIsViewRatingsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSuggestEditModalOpen, setIsSuggestEditModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [shareCopied, setShareCopied] = useState<'link' | 'embed' | 'embedcode' | null>(null);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [expandedTagSections, setExpandedTagSections] = useState<Record<string, boolean>>({});

  const TAG_LIMIT = 8; // ~2 lines of tags; beyond this show "View more"
  const toggleTagSection = (key: string) => {
    setExpandedTagSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };
  const { user, isAdmin } = useAuth();

  const ProducerIcon = getIcon(tagColors?.producer_icon, 'producer_icon');
  const DesignerIcon = getIcon(tagColors?.designer_icon, 'designer_icon');
  const ModelIcon = getIcon(tagColors?.model_icon, 'model_icon');
  const HairMakeupIcon = getIcon(tagColors?.hair_makeup_icon, 'hair_makeup_icon');
  const CityIcon = getIcon(tagColors?.city_icon, 'city_icon');
  const SeasonIcon = getIcon(tagColors?.season_icon, 'season_icon');
  const HeaderTagsIcon = getIcon(tagColors?.header_tags_icon, 'header_tags_icon');
  const FooterTagsIcon = getIcon(tagColors?.footer_tags_icon, 'footer_tags_icon');

  const baseUrl = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '';
  const shareLink = `${baseUrl}?event=${event.id}`;
  const embedLink = `${baseUrl}?embed=1&event=${event.id}`;
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

  const canEdit = user && (isAdmin || event.created_by === user.id);

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

  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (!onViewClick) return;
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a') || target.closest('[data-event-actions]')) return;
    onViewClick(event.id);
  };

  if (stackPhotoOnly) {
    return (
      <div className={`rounded-lg overflow-hidden shrink-0 h-48 ${event.image_url ? 'bg-transparent' : 'bg-gray-200'}`}>
        {event.image_url ? (
          <img
            src={event.image_url}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : null}
      </div>
    );
  }

  return (
    <>
      <div
        className={`${imageOpacity !== undefined ? 'bg-transparent' : 'bg-white'} rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-all relative ${onViewClick ? 'cursor-pointer' : ''}`}
        onClick={handleCardClick}
        role={onViewClick ? 'button' : undefined}
        tabIndex={onViewClick ? 0 : undefined}
        onKeyDown={onViewClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onViewClick(event.id); } } : undefined}
      >
        {event.image_url && (
          <img
            src={event.image_url}
            alt={event.name}
            className="w-full h-48 object-cover flex-shrink-0 rounded-t-lg"
            style={imageOpacity !== undefined ? { opacity: imageOpacity } : undefined}
          />
        )}
        <div className={`p-6 ${imageOpacity !== undefined ? 'bg-white' : ''}`}>
          <div className="flex items-start justify-between gap-2 mb-2">
            {viewHref && !onViewClick ? (
              <a href={viewHref} className="text-xl font-bold text-gray-900 flex-1 block min-w-0">
                {event.name}
              </a>
            ) : (
              <h3 className="text-xl font-bold text-gray-900 flex-1 min-w-0">
                {event.name}
              </h3>
            )}
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
                    {canEdit && (
                      <>
                        <div className="border-t border-gray-100 my-1" />
                        <button
                          onClick={() => { setIsEditModalOpen(true); setShowActionsMenu(false); }}
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
                    {!canEdit && user && (
                      <>
                        <div className="border-t border-gray-100 my-1" />
                        <button
                          onClick={() => { setIsSuggestEditModalOpen(true); setShowActionsMenu(false); }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                        >
                          <FileEdit size={14} className="text-blue-600" />
                          <span>Suggest an edit</span>
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
                onClick={() => onTagClick('city', event.city)}
                className="px-2 py-1 rounded-md text-xs transition-all hover:opacity-80"
                style={{
                  backgroundColor: tagColors?.city_bg_color || '#dbeafe',
                  color: tagColors?.city_text_color || '#1e40af'
                }}
              >
                <CityIcon size={12} className="inline mr-1 -mt-0.5" />
                {event.city}
              </button>
            )}
            {(() => {
              const season = getSeasonFromDate(event.date);
              return (
                <button
                  onClick={() => onTagClick('season', season)}
                  className="px-2 py-1 rounded-md text-xs transition-all hover:opacity-80"
                  style={{
                    backgroundColor: tagColors?.season_bg_color || '#ffedd5',
                    color: tagColors?.season_text_color || '#c2410c'
                  }}
                >
                  <SeasonIcon size={12} className="inline mr-1 -mt-0.5" />
                  {season}
                </button>
              );
            })()}
          </div>

          {(() => {
            const genreTags = (event.genre || event.header_tags || []);
            if (genreTags.length === 0) return null;
            const tags = genreTags;
            const showMore = tags.length > TAG_LIMIT && !expandedTagSections['header_tags'];
            const visible = showMore ? tags.slice(0, TAG_LIMIT) : tags;
            return (
              <div className="mb-3">
                <div className="flex flex-wrap gap-1 items-center">
                  {visible.map((tag: string, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => onTagClick('header_tags', tag)}
                      className="text-xs px-2 py-1 rounded-md transition-colors hover:opacity-80"
                      style={{
                        backgroundColor: tagColors?.header_tags_bg_color || '#ccfbf1',
                        color: tagColors?.header_tags_text_color || '#0f766e'
                      }}
                    >
                      <HeaderTagsIcon size={12} className="inline mr-1 -mt-0.5" />
                      {tag}
                    </button>
                  ))}
                  {tags.length > TAG_LIMIT && (
                    <button
                      type="button"
                      onClick={() => toggleTagSection('header_tags')}
                      className="text-xs text-gray-400 hover:text-gray-600 inline-flex items-center shrink-0"
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
              {formatDate(event.date)}
            </div>
            {event.location && (
              <div className="flex items-center text-gray-500 text-sm">
                <MapPin size={16} className="mr-2 flex-shrink-0" />
                <span>{event.location}</span>
              </div>
            )}
            {event.address && (
              <div className="flex items-start text-gray-400 text-xs leading-tight ml-6">
                <span className="whitespace-pre-line">{event.address}</span>
              </div>
            )}
          </div>

          <div className="space-y-3 mb-4 pt-4 border-t">
            {event.producers && event.producers.length > 0 && (() => {
              const tags = event.producers;
              const showMore = tags.length > TAG_LIMIT && !expandedTagSections['producers'];
              const visible = showMore ? tags.slice(0, TAG_LIMIT) : tags;
              return (
                <div>
                  <div className="flex items-center text-xs font-semibold text-gray-700 mb-1">
                    <ProducerIcon size={14} className="mr-1" />
                    Produced By
                  </div>
                  <div className="flex flex-wrap gap-1 items-center">
                    {visible.map((producer, idx) => (
                      <button
                        key={idx}
                        onClick={() => onTagClick('producer', producer)}
                        className="text-xs px-2 py-1 rounded-md transition-colors hover:opacity-80"
                        style={{
                          backgroundColor: tagColors?.producer_bg_color || '#f3f4f6',
                          color: tagColors?.producer_text_color || '#374151'
                        }}
                      >
                        {producer}
                      </button>
                    ))}
                    {tags.length > TAG_LIMIT && (
                      <button type="button" onClick={() => toggleTagSection('producers')} className="text-xs text-gray-400 hover:text-gray-600 inline-flex shrink-0" title={expandedTagSections['producers'] ? 'Show less' : 'View more tags'}>
                        {expandedTagSections['producers'] ? '−' : `+${tags.length - TAG_LIMIT}`}
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            {event.featured_designers && event.featured_designers.length > 0 && (() => {
              const tags = event.featured_designers;
              const showMore = tags.length > TAG_LIMIT && !expandedTagSections['designers'];
              const visible = showMore ? tags.slice(0, TAG_LIMIT) : tags;
              return (
                <div>
                  <div className="flex items-center text-xs font-semibold text-gray-700 mb-1">
                    <DesignerIcon size={14} className="mr-1" />
                    Featured Designers
                  </div>
                  <div className="flex flex-wrap gap-1 items-center">
                    {visible.map((designer, idx) => (
                      <button
                        key={idx}
                        onClick={() => onTagClick('designer', designer)}
                        className="text-xs px-2 py-1 rounded-md transition-colors hover:opacity-80"
                        style={{
                          backgroundColor: tagColors?.designer_bg_color || '#fef3c7',
                          color: tagColors?.designer_text_color || '#b45309'
                        }}
                      >
                        {designer}
                      </button>
                    ))}
                    {tags.length > TAG_LIMIT && (
                      <button type="button" onClick={() => toggleTagSection('designers')} className="text-xs text-gray-400 hover:text-gray-600 inline-flex shrink-0" title={expandedTagSections['designers'] ? 'Show less' : 'View more tags'}>
                        {expandedTagSections['designers'] ? '−' : `+${tags.length - TAG_LIMIT}`}
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            {event.models && event.models.length > 0 && (() => {
              const tags = event.models;
              const showMore = tags.length > TAG_LIMIT && !expandedTagSections['models'];
              const visible = showMore ? tags.slice(0, TAG_LIMIT) : tags;
              return (
                <div>
                  <div className="flex items-center text-xs font-semibold text-gray-700 mb-1">
                    <ModelIcon size={14} className="mr-1" />
                    Featured Models
                  </div>
                  <div className="flex flex-wrap gap-1 items-center">
                    {visible.map((model, idx) => (
                      <button
                        key={idx}
                        onClick={() => onTagClick('model', model)}
                        className="text-xs px-2 py-1 rounded-md transition-colors hover:opacity-80"
                        style={{
                          backgroundColor: tagColors?.model_bg_color || '#fce7f3',
                          color: tagColors?.model_text_color || '#be185d'
                        }}
                      >
                        {model}
                      </button>
                    ))}
                    {tags.length > TAG_LIMIT && (
                      <button type="button" onClick={() => toggleTagSection('models')} className="text-xs text-gray-400 hover:text-gray-600 inline-flex shrink-0" title={expandedTagSections['models'] ? 'Show less' : 'View more tags'}>
                        {expandedTagSections['models'] ? '−' : `+${tags.length - TAG_LIMIT}`}
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            {event.hair_makeup && event.hair_makeup.length > 0 && (() => {
              const tags = event.hair_makeup;
              const showMore = tags.length > TAG_LIMIT && !expandedTagSections['hair_makeup'];
              const visible = showMore ? tags.slice(0, TAG_LIMIT) : tags;
              return (
                <div>
                  <div className="flex items-center text-xs font-semibold text-gray-700 mb-1">
                    <HairMakeupIcon size={14} className="mr-1" />
                    Hair & Makeup
                  </div>
                  <div className="flex flex-wrap gap-1 items-center">
                    {visible.map((artist, idx) => (
                      <button
                        key={idx}
                        onClick={() => onTagClick('hair_makeup', artist)}
                        className="text-xs px-2 py-1 rounded-md transition-colors hover:opacity-80"
                        style={{
                          backgroundColor: tagColors?.hair_makeup_bg_color || '#f3e8ff',
                          color: tagColors?.hair_makeup_text_color || '#7e22ce'
                        }}
                      >
                        {artist}
                      </button>
                    ))}
                    {tags.length > TAG_LIMIT && (
                      <button type="button" onClick={() => toggleTagSection('hair_makeup')} className="text-xs text-gray-400 hover:text-gray-600 inline-flex shrink-0" title={expandedTagSections['hair_makeup'] ? 'Show less' : 'View more tags'}>
                        {expandedTagSections['hair_makeup'] ? '−' : `+${tags.length - TAG_LIMIT}`}
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            {(() => {
              const ct = (event.custom_tags && typeof event.custom_tags === 'object' && !Array.isArray(event.custom_tags)) ? event.custom_tags : {};
              const definedSlugs = new Set(customPerformerTags.map((t) => t.slug));
              const adHocSlugs = Object.keys(ct).filter((slug) => !definedSlugs.has(slug));
              const slugToLabel = (s: string) => s.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
              const allTagDefs = [
                ...customPerformerTags.map((t) => ({ ...t, slug: t.slug, label: t.label, icon: t.icon, bg_color: t.bg_color, text_color: t.text_color })),
                ...adHocSlugs.map((slug) => ({ id: slug, slug, label: slugToLabel(slug), icon: 'Tag', bg_color: '#e0e7ff', text_color: '#3730a3' })),
              ];
              return allTagDefs
                .sort((a, b) => ((a as { sort_order?: number }).sort_order ?? 999) - ((b as { sort_order?: number }).sort_order ?? 999))
                .map((tagDef) => {
                  const tags = ct[tagDef.slug];
                  if (!tags || tags.length === 0) return null;
                  const CustomIcon = getIcon(tagDef.icon, 'producer_icon');
                  const showMore = tags.length > TAG_LIMIT && !expandedTagSections[`custom_${tagDef.slug}`];
                  const visible = showMore ? tags.slice(0, TAG_LIMIT) : tags;
                  return (
                    <div key={tagDef.id ?? tagDef.slug}>
                      <div className="flex items-center text-xs font-semibold text-gray-700 mb-1">
                        <CustomIcon size={14} className="mr-1" />
                        {tagDef.label}
                      </div>
                      <div className="flex flex-wrap gap-1 items-center">
                        {visible.map((val, idx) => (
                          <button
                            key={idx}
                            onClick={() => onTagClick(`custom_performer`, `${tagDef.slug}\x00${val}`)}
                            className="text-xs px-2 py-1 rounded-md transition-colors hover:opacity-80"
                            style={{
                              backgroundColor: tagDef.bg_color || '#e0e7ff',
                              color: tagDef.text_color || '#3730a3',
                            }}
                          >
                            {val}
                          </button>
                        ))}
                        {tags.length > TAG_LIMIT && (
                          <button
                            type="button"
                            onClick={() => toggleTagSection(`custom_${tagDef.slug}`)}
                            className="text-xs text-gray-400 hover:text-gray-600 inline-flex shrink-0"
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

          <div className="flex items-center justify-between pt-4 border-t">
            <button
              onClick={() => setIsViewRatingsModalOpen(true)}
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

            {user && (
              <button
                onClick={() => setIsRatingModalOpen(true)}
                className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                {userRating ? 'Update' : 'Rate Show'}
              </button>
            )}
          </div>

          {userRating && (
            <div className="mt-3 pt-3 border-t">
              <p className="text-sm text-gray-600 font-medium">
                Your rating: {userRating.rating} stars
              </p>
              {userRating.comment && (
                <p className="text-sm text-gray-500 mt-1 italic">
                  "<CommentWithTags
                    comment={userRating.comment}
                    event={event}
                    tagColors={tagColors}
                    customPerformerTags={customPerformerTags}
                  />"
                </p>
              )}
            </div>
          )}

          {event.footer_tags && event.footer_tags.length > 0 && (() => {
            const tags = event.footer_tags;
            const showMore = tags.length > TAG_LIMIT && !expandedTagSections['footer_tags'];
            const visible = showMore ? tags.slice(0, TAG_LIMIT) : tags;
            return (
              <div className="mt-3 pt-3 border-t">
                <div className="flex flex-wrap gap-1 items-center">
                  {visible.map((tag, idx) => (
                    <button
                      key={idx}
                      onClick={() => onTagClick('footer_tags', tag)}
                      className="text-xs px-2 py-1 rounded-md transition-colors hover:opacity-80"
                      style={{
                        backgroundColor: tagColors?.footer_tags_bg_color || '#d1fae5',
                        color: tagColors?.footer_tags_text_color || '#065f46'
                      }}
                    >
                      <FooterTagsIcon size={12} className="inline mr-1 -mt-0.5" />
                      {tag}
                    </button>
                  ))}
                  {tags.length > TAG_LIMIT && (
                    <button type="button" onClick={() => toggleTagSection('footer_tags')} className="text-xs text-gray-400 hover:text-gray-600 inline-flex shrink-0" title={expandedTagSections['footer_tags'] ? 'Show less' : 'View more tags'}>
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
        isOpen={isRatingModalOpen}
        onClose={() => setIsRatingModalOpen(false)}
        event={event}
        existingRating={userRating}
        onRatingSubmitted={onRatingSubmitted}
        tagColors={tagColors}
        customPerformerTags={customPerformerTags}
      />

      <ViewRatingsModal
        isOpen={isViewRatingsModalOpen}
        onClose={() => setIsViewRatingsModalOpen(false)}
        eventId={event.id}
        eventName={event.name}
        event={event}
        currentUserId={user?.id}
        onRatingSubmitted={onRatingSubmitted}
        tagColors={tagColors}
        customPerformerTags={customPerformerTags}
      />

      <EditEventModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        event={event}
        onEventUpdated={onEventUpdated}
        customPerformerTags={customPerformerTags}
      />

      <SuggestEditModal
        isOpen={isSuggestEditModalOpen}
        onClose={() => setIsSuggestEditModalOpen(false)}
        event={event}
        customPerformerTags={customPerformerTags}
        onSuggestionSubmitted={() => {
          setIsSuggestEditModalOpen(false);
          alert('Your suggestion has been submitted and will be reviewed by an admin.');
        }}
      />
    </>
  );
}
