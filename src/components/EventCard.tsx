import { Calendar, MapPin, Star, Sparkles, Users, Scissors, Edit, Trash2, FileEdit, ChevronDown, ChevronUp, Share2 } from 'lucide-react';
import { Event, Rating, supabase } from '../lib/supabase';
import { useState } from 'react';
import RatingModal from './RatingModal';
import EditEventModal from './EditEventModal';
import SuggestEditModal from './SuggestEditModal';
import ViewRatingsModal from './ViewRatingsModal';
import { useAuth } from '../contexts/AuthContext';

interface EventCardProps {
  event: Event;
  averageRating: number;
  ratingCount: number;
  userRating?: Rating;
  onRatingSubmitted: () => void;
  onEventUpdated: () => void;
  onTagClick: (type: string, value: string) => void;
  collapsibleEnabled?: boolean;
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
  };
}

export default function EventCard({
  event,
  averageRating,
  ratingCount,
  userRating,
  onRatingSubmitted,
  onEventUpdated,
  onTagClick,
  collapsibleEnabled = true,
  tagColors
}: EventCardProps) {
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [isViewRatingsModalOpen, setIsViewRatingsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSuggestEditModalOpen, setIsSuggestEditModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExpanded, setIsExpanded] = useState(!collapsibleEnabled);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [shareCopied, setShareCopied] = useState<'link' | 'embed' | 'embedcode' | null>(null);
  const { user, isAdmin } = useAuth();

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
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (!collapsibleEnabled) return;
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('a')) {
      return;
    }
    setIsExpanded(!isExpanded);
  };

  return (
    <>
      <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-all relative">
        <div className="absolute top-2 right-2 z-10 flex gap-2">
          <div className="relative">
            <button
              onClick={() => setShowShareMenu(!showShareMenu)}
              className="p-2 bg-white/90 hover:bg-white rounded-lg shadow-md transition-colors"
              title="Share"
            >
              <Share2 size={16} className="text-gray-600" />
            </button>
            {showShareMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowShareMenu(false)}
                  aria-hidden="true"
                />
                <div className="absolute right-0 top-full mt-1 w-72 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                  <div className="px-3 py-1.5 text-xs font-medium text-gray-500 uppercase">Share this show</div>
                  <button
                    onClick={() => copyToClipboard(shareLink, 'link')}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between"
                  >
                    <span>Copy link</span>
                    {shareCopied === 'link' && <span className="text-green-600 text-xs">Copied!</span>}
                  </button>
                  <button
                    onClick={() => copyToClipboard(embedLink, 'embed')}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between"
                  >
                    <span>Copy embed URL</span>
                    {shareCopied === 'embed' && <span className="text-green-600 text-xs">Copied!</span>}
                  </button>
                  <button
                    onClick={() => copyToClipboard(embedCode, 'embedcode')}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between border-t border-gray-100"
                  >
                    <span>Copy embed code</span>
                    {shareCopied === 'embedcode' && <span className="text-green-600 text-xs">Copied!</span>}
                  </button>
                </div>
              </>
            )}
          </div>
          {canEdit ? (
            <>
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="p-2 bg-white/90 hover:bg-white rounded-lg shadow-md transition-colors"
                title="Edit show"
              >
                <Edit size={16} className="text-blue-600" />
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="p-2 bg-white/90 hover:bg-white rounded-lg shadow-md transition-colors disabled:opacity-50"
                title="Delete show"
              >
                <Trash2 size={16} className="text-red-600" />
              </button>
            </>
          ) : user ? (
            <button
              onClick={() => setIsSuggestEditModalOpen(true)}
              className="p-2 bg-white/90 hover:bg-white rounded-lg shadow-md transition-colors"
              title="Suggest an edit"
            >
              <FileEdit size={16} className="text-blue-600" />
            </button>
          ) : null}
        </div>
        {event.image_url && (
          <img
            src={event.image_url}
            alt={event.name}
            className={`w-full h-48 object-cover ${collapsibleEnabled ? 'cursor-pointer' : ''}`}
            onClick={handleCardClick}
          />
        )}
        <div className="p-6">
          <div className="flex items-start justify-between mb-2">
            <h3
              className={`text-xl font-bold text-gray-900 flex-1 ${collapsibleEnabled ? 'cursor-pointer hover:text-blue-600 transition-colors' : ''}`}
              onClick={handleCardClick}
            >
              {event.name}
            </h3>
            {collapsibleEnabled && (
              <button
                onClick={handleCardClick}
                className="ml-2 p-1 hover:bg-gray-100 rounded-full transition-colors"
                title={isExpanded ? "Collapse" : "Expand"}
              >
                {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap mb-2">
            {event.city && (
              <button
                onClick={() => onTagClick('city', event.city)}
                className="px-2 py-1 rounded text-xs transition-all hover:opacity-80"
                style={{
                  backgroundColor: tagColors?.city_bg_color || '#dbeafe',
                  color: tagColors?.city_text_color || '#1e40af'
                }}
              >
                <MapPin size={12} className="inline mr-1 -mt-0.5" />
                {event.city}
              </button>
            )}
            {event.season && (
              <button
                onClick={() => onTagClick('season', event.season)}
                className="px-2 py-1 rounded text-xs transition-all hover:opacity-80"
                style={{
                  backgroundColor: tagColors?.season_bg_color || '#ffedd5',
                  color: tagColors?.season_text_color || '#c2410c'
                }}
              >
                <Calendar size={12} className="inline mr-1 -mt-0.5" />
                {event.season}
              </button>
            )}
          </div>

          {event.header_tags && event.header_tags.length > 0 && (
            <div className="mb-3">
              <div className="flex flex-wrap gap-1">
                {event.header_tags.map((tag, idx) => (
                  <button
                    key={idx}
                    onClick={() => onTagClick('header_tags', tag)}
                    className="text-xs px-2 py-1 rounded transition-colors hover:opacity-80"
                    style={{
                      backgroundColor: tagColors?.header_tags_bg_color || '#ccfbf1',
                      color: tagColors?.header_tags_text_color || '#0f766e'
                    }}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}

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

          {(isExpanded || !collapsibleEnabled) && (
            <div className="space-y-3 mb-4 pt-4 border-t">
            {event.producers && event.producers.length > 0 && (
              <div>
                <div className="flex items-center text-xs font-semibold text-gray-700 mb-1">
                  <Sparkles size={14} className="mr-1" />
                  Produced By
                </div>
                <div className="flex flex-wrap gap-1">
                  {event.producers.map((producer, idx) => (
                    <button
                      key={idx}
                      onClick={() => onTagClick('producer', producer)}
                      className="text-xs px-2 py-1 rounded transition-colors hover:opacity-80"
                      style={{
                        backgroundColor: tagColors?.producer_bg_color || '#f3f4f6',
                        color: tagColors?.producer_text_color || '#374151'
                      }}
                    >
                      {producer}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {event.featured_designers && event.featured_designers.length > 0 && (
              <div>
                <div className="flex items-center text-xs font-semibold text-gray-700 mb-1">
                  <Star size={14} className="mr-1" />
                  Featured Designers
                </div>
                <div className="flex flex-wrap gap-1">
                  {event.featured_designers.map((designer, idx) => (
                    <button
                      key={idx}
                      onClick={() => onTagClick('designer', designer)}
                      className="text-xs px-2 py-1 rounded transition-colors hover:opacity-80"
                      style={{
                        backgroundColor: tagColors?.designer_bg_color || '#fef3c7',
                        color: tagColors?.designer_text_color || '#b45309'
                      }}
                    >
                      {designer}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {event.models && event.models.length > 0 && (
              <div>
                <div className="flex items-center text-xs font-semibold text-gray-700 mb-1">
                  <Users size={14} className="mr-1" />
                  Featured Models
                </div>
                <div className="flex flex-wrap gap-1">
                  {event.models.map((model, idx) => (
                    <button
                      key={idx}
                      onClick={() => onTagClick('model', model)}
                      className="text-xs px-2 py-1 rounded transition-colors hover:opacity-80"
                      style={{
                        backgroundColor: tagColors?.model_bg_color || '#fce7f3',
                        color: tagColors?.model_text_color || '#be185d'
                      }}
                    >
                      {model}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {event.hair_makeup && event.hair_makeup.length > 0 && (
              <div>
                <div className="flex items-center text-xs font-semibold text-gray-700 mb-1">
                  <Scissors size={14} className="mr-1" />
                  Hair & Makeup
                </div>
                <div className="flex flex-wrap gap-1">
                  {event.hair_makeup.map((artist, idx) => (
                    <button
                      key={idx}
                      onClick={() => onTagClick('hair_makeup', artist)}
                      className="text-xs px-2 py-1 rounded transition-colors hover:opacity-80"
                      style={{
                        backgroundColor: tagColors?.hair_makeup_bg_color || '#f3e8ff',
                        color: tagColors?.hair_makeup_text_color || '#7e22ce'
                      }}
                    >
                      {artist}
                    </button>
                  ))}
                </div>
              </div>
            )}
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t">
            <button
              onClick={() => setIsViewRatingsModalOpen(true)}
              className="flex items-center hover:bg-gray-50 rounded-lg p-2 -ml-2 transition-colors group"
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
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
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
                <p className="text-sm text-gray-500 mt-1 italic">"{userRating.comment}"</p>
              )}
            </div>
          )}

          {event.footer_tags && event.footer_tags.length > 0 && (
            <div className="mt-3 pt-3 border-t">
              <div className="flex flex-wrap gap-1">
                {event.footer_tags.map((tag, idx) => (
                  <button
                    key={idx}
                    onClick={() => onTagClick('footer_tags', tag)}
                    className="text-xs px-2 py-1 rounded transition-colors hover:opacity-80"
                    style={{
                      backgroundColor: tagColors?.footer_tags_bg_color || '#d1fae5',
                      color: tagColors?.footer_tags_text_color || '#065f46'
                    }}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <RatingModal
        isOpen={isRatingModalOpen}
        onClose={() => setIsRatingModalOpen(false)}
        event={event}
        existingRating={userRating}
        onRatingSubmitted={onRatingSubmitted}
      />

      <ViewRatingsModal
        isOpen={isViewRatingsModalOpen}
        onClose={() => setIsViewRatingsModalOpen(false)}
        eventId={event.id}
        eventName={event.name}
      />

      <EditEventModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        event={event}
        onEventUpdated={onEventUpdated}
      />

      <SuggestEditModal
        isOpen={isSuggestEditModalOpen}
        onClose={() => setIsSuggestEditModalOpen(false)}
        event={event}
        onSuggestionSubmitted={() => {
          setIsSuggestEditModalOpen(false);
          alert('Your suggestion has been submitted and will be reviewed by an admin.');
        }}
      />
    </>
  );
}
