import { Link2, Lock, MoreVertical, Pencil, Plus, Trash2, Unlock } from 'lucide-react';
import EventCard from '../EventCard';
import MasonryLaneFeed, { type MasonryLaneItem } from '../MasonryLaneFeed';
import { TagDisplayProvider } from '../../contexts/TagDisplayContext';
import type { TagResolutionMap } from '../../lib/tagDisplayResolution';
import { compareEventsForFeed, type EventWithStats } from '../../lib/eventsFeed';
import { ListCover } from '../ListCoverCollage';
import { pickListCollageUrls } from '../../lib/listCoverCollage';
import {
  isSystemLibraryList,
  VIRTUAL_LIKED_LIST_ID,
  VIRTUAL_RATINGS_LIST_ID,
} from '../../lib/userLists';
import { useT } from '../../hooks/useCopy';
import type { BoardRow, ListWithCount, ProfilePageProps } from './types';
import AddEventToListModal from './AddEventToListModal';
import EditListModal from './EditListModal';
import PageBack from '../layout/PageBack';
import type { Event } from '../../lib/supabase';

interface ProfileBoardViewProps {
  manageListId: string;
  currentList: ListWithCount | undefined;
  listEvents: BoardRow[];
  boardTagMap: TagResolutionMap | null;
  isOwnProfile: boolean;
  searchActive: boolean;
  searchEvents: EventWithStats[];
  showBoardMenu: boolean;
  boardMenuRef: React.RefObject<HTMLDivElement | null>;
  listLinkCopied: boolean;
  shareBusy: boolean;
  listDisplayName: (list: ListWithCount | undefined) => string;
  onToggleBoardMenu: () => void;
  onCloseBoardMenu: () => void;
  onOpenEditList: () => void;
  onOpenAddEvent: () => void;
  onCopyBoardLink: () => void;
  onToggleBoardPublic: () => void;
  onDeleteList: (listId: string) => void;
  onReloadBoard: () => void;
  onRefreshProfile: () => void;
  onTagClick?: ProfilePageProps['onTagClick'];
  onOpenEvent?: ProfilePageProps['onOpenEvent'];
  tagColors?: ProfilePageProps['tagColors'];
  customPerformerTags?: ProfilePageProps['customPerformerTags'];
  isAddEventOpen: boolean;
  addEventSearch: string;
  addEventError: string;
  filteredAddEvents: Event[];
  onAddEventSearchChange: (value: string) => void;
  onAddEvent: (eventId: string) => void;
  onCloseAddEvent: () => void;
  isEditListOpen: boolean;
  editListName: string;
  editListDescription: string;
  editListCoverUrl: string;
  editListCoverOriginal: string;
  editListCoverBusy: boolean;
  editListBusy: boolean;
  editListError: string;
  canUploadCover: boolean;
  onEditListNameChange: (value: string) => void;
  onEditListDescriptionChange: (value: string) => void;
  onEditListCoverUrlChange: (value: string) => void;
  onEditListCoverFile: (file: File | null) => void;
  onSaveEditList: (e: React.FormEvent) => void;
  onCloseEditList: () => void;
  onLeaveBoard: () => void;
}

export default function ProfileBoardView({
  manageListId,
  currentList,
  listEvents,
  boardTagMap,
  isOwnProfile,
  searchActive,
  searchEvents,
  showBoardMenu,
  boardMenuRef,
  listLinkCopied,
  shareBusy,
  listDisplayName,
  onToggleBoardMenu,
  onCloseBoardMenu,
  onOpenEditList,
  onOpenAddEvent,
  onCopyBoardLink,
  onToggleBoardPublic,
  onDeleteList,
  onReloadBoard,
  onRefreshProfile,
  onTagClick,
  onOpenEvent,
  tagColors,
  customPerformerTags = [],
  isAddEventOpen,
  addEventSearch,
  addEventError,
  filteredAddEvents,
  onAddEventSearchChange,
  onAddEvent,
  onCloseAddEvent,
  isEditListOpen,
  editListName,
  editListDescription,
  editListCoverUrl,
  editListCoverOriginal,
  editListCoverBusy,
  editListBusy,
  editListError,
  canUploadCover,
  onEditListNameChange,
  onEditListDescriptionChange,
  onEditListCoverUrlChange,
  onEditListCoverFile,
  onSaveEditList,
  onCloseEditList,
  onLeaveBoard,
}: ProfileBoardViewProps) {
  const t = useT();

  const isRatingsList = manageListId === VIRTUAL_RATINGS_LIST_ID || !!currentList?.is_rated_list;
  const isLikedList = manageListId === VIRTUAL_LIKED_LIST_ID || !!currentList?.is_liked_list;
  const canDeleteList =
    isOwnProfile &&
    !isSystemLibraryList(currentList) &&
    manageListId !== VIRTUAL_RATINGS_LIST_ID &&
    manageListId !== VIRTUAL_LIKED_LIST_ID;
  const canAddShows = isOwnProfile && !isRatingsList;

  const boardRows = listEvents;
  const searchEventIds = searchActive ? new Set(searchEvents.map((e) => e.id)) : null;
  const orderedBoardRows = (searchEventIds
    ? boardRows.filter((r) => r.event?.id && searchEventIds.has(r.event.id))
    : boardRows
  ).slice();
  if (searchActive) {
    orderedBoardRows.sort((a, b) => compareEventsForFeed(a.event, b.event));
  }

  const canRemoveFromBoard = isOwnProfile && !isRatingsList;
  const laneItems: MasonryLaneItem[] = orderedBoardRows.map(
    ({ event, listEvent, averageRating, ratingCount, userRating }, index) => ({
      id: listEvent.id,
      children: (
        <EventCard
          event={event}
          averageRating={averageRating}
          ratingCount={ratingCount}
          userRating={userRating}
          onRatingSubmitted={() => {
            onReloadBoard();
            onRefreshProfile();
          }}
          onEventUpdated={() => {
            onReloadBoard();
            onRefreshProfile();
          }}
          onTagClick={onTagClick || (() => {})}
          onViewClick={onOpenEvent}
          tagColors={tagColors}
          customPerformerTags={customPerformerTags}
          imagePriority={index < 4}
          listMembership={
            canRemoveFromBoard
              ? { listId: listEvent.list_id, isLikedList }
              : undefined
          }
        />
      ),
    }),
  );

  const liveCollage = pickListCollageUrls(boardRows.map((r) => r.event?.image_url));
  const boardCollageUrls =
    liveCollage.length > 0 ? liveCollage : currentList?.cover_collage_urls || [];

  return (
    <div className="pb-16">
      <PageBack onClick={onLeaveBoard} className="mb-6" />
      <ListCover
        coverUrl={currentList?.cover_image_url}
        collageUrls={boardCollageUrls}
        className="mb-6 h-40 w-full rounded-xl sm:h-52"
      />
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-neutral-900 tracking-tight">
            {listDisplayName(currentList)}
          </h2>
          {currentList?.description && (
            <p className="text-sm text-neutral-500 mt-1">{currentList.description}</p>
          )}
        </div>
        {isOwnProfile && (
          <div className="relative shrink-0" ref={boardMenuRef}>
            <button
              type="button"
              onClick={onToggleBoardMenu}
              className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-lg transition-colors"
              title="Actions"
              aria-haspopup="true"
              aria-expanded={showBoardMenu}
            >
              <MoreVertical size={20} />
            </button>
            {showBoardMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={onCloseBoardMenu}
                  aria-hidden="true"
                />
                <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-lg shadow-lg border border-neutral-200 py-1 z-50">
                  <button
                    type="button"
                    onClick={() => {
                      void onOpenEditList();
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 flex items-center gap-2"
                  >
                    <Pencil size={14} className="text-neutral-500" />
                    <span>{t('event.editList')}</span>
                  </button>
                  {canAddShows && (
                    <button
                      type="button"
                      onClick={() => {
                        onCloseBoardMenu();
                        void onOpenAddEvent();
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 flex items-center gap-2"
                    >
                      <Plus size={14} className="text-neutral-500" />
                      <span>{t('event.addShow')}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={shareBusy}
                    onClick={() => {
                      void onCopyBoardLink();
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 flex items-center gap-2 disabled:opacity-50"
                  >
                    <Link2 size={14} className="shrink-0 text-neutral-500" />
                    <span className="min-w-0 flex-1">{t('event.copyListLink')}</span>
                    {listLinkCopied ? (
                      <span className="shrink-0 text-xs text-neutral-500">{t('event.listLinkCopied')}</span>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    disabled={shareBusy}
                    onClick={() => {
                      void onToggleBoardPublic();
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 flex items-center gap-2 disabled:opacity-50"
                  >
                    {(currentList?.is_public !== false) ? (
                      <Lock size={14} className="shrink-0 text-neutral-500" />
                    ) : (
                      <Unlock size={14} className="shrink-0 text-neutral-500" />
                    )}
                    <span>
                      {(currentList?.is_public !== false)
                        ? t('event.makeListPrivate')
                        : t('event.makeListPublic')}
                    </span>
                  </button>
                  {canDeleteList && (
                    <button
                      type="button"
                      onClick={() => onDeleteList(manageListId)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 flex items-center gap-2 text-red-600 border-t border-neutral-100 mt-1"
                    >
                      <Trash2 size={14} />
                      <span>{t('event.deleteList')}</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {orderedBoardRows.length === 0 ? (
        <div className="rounded-2xl bg-white/80 py-16 px-6 text-center">
          <p className="text-neutral-500 text-sm">
            {searchActive
              ? 'No matching shows in this list.'
              : isRatingsList
                ? 'No ratings yet.'
                : isLikedList
                  ? 'No saved shows yet.'
                  : 'No shows in this list yet.'}
          </p>
        </div>
      ) : (
        <TagDisplayProvider map={boardTagMap}>
          <MasonryLaneFeed items={laneItems} columnMinWidthPx={220} gapPx={24} />
        </TagDisplayProvider>
      )}

      {isAddEventOpen && (
        <AddEventToListModal
          search={addEventSearch}
          error={addEventError}
          events={filteredAddEvents}
          onSearchChange={onAddEventSearchChange}
          onAdd={onAddEvent}
          onClose={onCloseAddEvent}
        />
      )}

      {isEditListOpen && (
        <EditListModal
          name={editListName}
          description={editListDescription}
          coverUrl={editListCoverUrl}
          coverOriginal={editListCoverOriginal}
          nameEditable={!isSystemLibraryList(currentList)}
          coverBusy={editListCoverBusy}
          busy={editListBusy}
          error={editListError}
          canUpload={canUploadCover}
          onNameChange={onEditListNameChange}
          onDescriptionChange={onEditListDescriptionChange}
          onCoverUrlChange={onEditListCoverUrlChange}
          onCoverFile={onEditListCoverFile}
          onSubmit={onSaveEditList}
          onClose={onCloseEditList}
        />
      )}
    </div>
  );
}
