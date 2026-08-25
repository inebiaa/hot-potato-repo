import { ChevronRight, Copy, Pin, Plus, RefreshCw } from 'lucide-react';
import EventCard from '../EventCard';
import MasonryLaneFeed, { type MasonryLaneItem } from '../MasonryLaneFeed';
import { ListCover } from '../ListCoverCollage';
import { useT } from '../../hooks/useCopy';
import { VIRTUAL_RATINGS_LIST_ID } from '../../lib/userLists';
import type { EventWithStats } from '../../lib/eventsFeed';
import type { ListWithCount, ProfilePageProps } from './types';

interface ProfileLibraryBoardsProps {
  isOwnProfile: boolean;
  listsError: string | null;
  reviewsCount: number;
  visibleLibraryLists: ListWithCount[];
  boardSavedSearchEvents: EventWithStats[];
  searchActive: boolean;
  listDisplayName: (list: ListWithCount | undefined) => string;
  onOpenList: (listId: string) => void;
  onEnableLists: () => void;
  onRefresh: () => void;
  copyFeedback: string | null;
  onStartCreateList: () => void;
  onTagClick?: ProfilePageProps['onTagClick'];
  onOpenEvent?: ProfilePageProps['onOpenEvent'];
  tagColors?: ProfilePageProps['tagColors'];
  customPerformerTags?: ProfilePageProps['customPerformerTags'];
  onSearchEventRatingSubmitted?: ProfilePageProps['onSearchEventRatingSubmitted'];
  onSearchEventUpdated?: ProfilePageProps['onSearchEventUpdated'];
}

export default function ProfileLibraryBoards({
  isOwnProfile,
  listsError,
  reviewsCount,
  visibleLibraryLists,
  boardSavedSearchEvents,
  searchActive,
  listDisplayName,
  onOpenList,
  onEnableLists,
  onRefresh,
  copyFeedback,
  onStartCreateList,
  onTagClick,
  onOpenEvent,
  tagColors,
  customPerformerTags = [],
  onSearchEventRatingSubmitted,
  onSearchEventUpdated,
}: ProfileLibraryBoardsProps) {
  const t = useT();

  return (
    <section className="mt-2">
      <h2 className="text-lg font-semibold text-neutral-900 mb-4">
        {isOwnProfile ? t('profile.yourLibrary') : t('profile.library')}
      </h2>
      {listsError && isOwnProfile ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => onOpenList(VIRTUAL_RATINGS_LIST_ID)}
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/90 hover:bg-white transition-all hover:shadow-md hover:shadow-neutral-200/30 text-left min-w-[200px]"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-neutral-900 truncate">{t('event.ratedListName')}</p>
                <p className="text-xs text-neutral-500">
                  {reviewsCount} show{reviewsCount !== 1 ? 's' : ''}
                </p>
              </div>
              <ChevronRight size={16} className="text-neutral-300 shrink-0" />
            </button>
          </div>
          <div className="rounded-2xl bg-amber-50/90 border border-amber-200/80 p-6">
            <p className="text-sm text-amber-800 mb-4">
              Lists require a one-time database setup. Copy the SQL and run it in your Supabase SQL
              Editor.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={onEnableLists}
                className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 text-white rounded-xl text-sm hover:bg-amber-700 transition-colors"
              >
                <Copy size={16} />
                Copy SQL & open Supabase
              </button>
              <button
                onClick={onRefresh}
                className="flex items-center gap-2 px-4 py-2.5 border border-amber-300 rounded-xl text-sm text-amber-800 hover:bg-amber-100 transition-colors"
              >
                <RefreshCw size={16} />
                I&apos;ve run it: Refresh
              </button>
              {copyFeedback && (
                <span className="self-center text-sm text-amber-700">{copyFeedback}</span>
              )}
            </div>
          </div>
        </div>
      ) : (
        (() => {
          const matchIds = searchActive
            ? new Set(boardSavedSearchEvents.map((e) => e.id))
            : null;
          const libraryLaneItems: MasonryLaneItem[] = visibleLibraryLists.map((list) => {
            const isPinned = !!list.is_liked_list || !!list.is_rated_list;
            const matchCount = matchIds
              ? (list.event_ids || []).filter((id) => matchIds.has(id)).length
              : list.event_count;
            return {
              id: `board-${list.id}`,
              children: (
                <button
                  type="button"
                  onClick={() => onOpenList(list.id)}
                  className="flex w-full flex-col overflow-hidden rounded-xl bg-white/90 text-left transition-all hover:bg-white hover:shadow-md hover:shadow-neutral-200/30"
                >
                  <ListCover
                    coverUrl={list.cover_image_url}
                    collageUrls={list.cover_collage_urls}
                    className="aspect-square w-full bg-neutral-100"
                  />
                  <div className="flex min-w-0 items-center gap-2 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="flex min-w-0 items-center gap-1.5 font-medium text-neutral-900">
                        <span className="truncate">{listDisplayName(list)}</span>
                        {isPinned && (
                          <Pin
                            size={12}
                            strokeWidth={2}
                            className="relative top-0.5 shrink-0 rotate-45 text-neutral-400"
                            aria-hidden
                          />
                        )}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {matchCount} show{matchCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <ChevronRight size={16} className="shrink-0 text-neutral-300" />
                  </div>
                </button>
              ),
            };
          });

          if (isOwnProfile && !searchActive) {
            libraryLaneItems.push({
              id: 'new-list',
              children: (
                <button
                  type="button"
                  onClick={onStartCreateList}
                  className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-xl border border-neutral-200/60 text-neutral-500 transition-colors hover:bg-white/60 hover:text-neutral-700"
                >
                  <Plus size={18} />
                  New list
                </button>
              ),
            });
          }

          if (searchActive) {
            let searchIdx = 0;
            for (const event of boardSavedSearchEvents) {
              const imagePriority = searchIdx < 4;
              searchIdx += 1;
              libraryLaneItems.push({
                id: event.id,
                children: (
                  <EventCard
                    event={event}
                    averageRating={event.average_rating}
                    ratingCount={event.rating_count}
                    userRating={event.user_rating}
                    onRatingSubmitted={() => onSearchEventRatingSubmitted?.(event.id)}
                    onEventUpdated={() => onSearchEventUpdated?.()}
                    onTagClick={onTagClick || (() => {})}
                    onViewClick={onOpenEvent}
                    tagColors={tagColors}
                    customPerformerTags={customPerformerTags}
                    imagePriority={imagePriority}
                  />
                ),
              });
            }
          }

          if (libraryLaneItems.length === 0) {
            return (
              <div className="rounded-2xl bg-white/80 py-12 px-6 text-center">
                <p className="text-sm text-neutral-500">
                  {searchActive ? 'No matching shows.' : 'No lists yet.'}
                </p>
              </div>
            );
          }

          return (
            <MasonryLaneFeed items={libraryLaneItems} columnMinWidthPx={220} gapPx={24} />
          );
        })()
      )}
    </section>
  );
}
