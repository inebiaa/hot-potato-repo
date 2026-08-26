import { createPortal } from "react-dom";
import {
  Edit,
  Trash2,
  Share2,
  Mail,
  MoreVertical,
  ListPlus,
  ListMinus,
  Check,
  Plus,
  Flag,
} from "lucide-react";
import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { Event, supabase, type UserList } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import {
  buildEventEmailPlainText,
  buildEventEmailRichHtml,
} from "../../lib/eventEmailRichCard";
import { canonicalEventUrl, listPagePath } from "../../lib/siteBase";
import { fetchUserPublicHandle } from "../../lib/userProfile";
import { setAppModalParams } from "../../lib/searchParamsModal";
import { useT } from "../../hooks/useCopy";
import { deleteStoredEventImage } from "../../lib/eventImageUpload";
import {
  addEventToListAndLiked,
  createUserPlaylist,
  fetchUserPlaylists,
  removeEventFromList,
} from "../../lib/userLists";
import { BackIconButton, formErrorClass, inlineStatusClass } from "../ui";
import ReportContentModal from "../ReportContentModal";
import { useAppSettings } from "../../hooks/useAppSettings";
import {
  formControlClass,
  formControlPaddingClass,
  formControlTextClass,
} from "../ui/field";

interface EventCardActionsMenuProps {
  event: Event;
  /** When set (own library board), overflow menu can remove this show from that list. */
  listMembership?: {
    listId: string;
    isLikedList?: boolean;
  };
  onEventUpdated: () => void;
  onOpenEdit: () => void;
  /** Sync heart state when show is added to a list (lists also like). */
  onLikedChange?: (liked: boolean) => void;
}

export default function EventCardActionsMenu({
  event,
  listMembership,
  onEventUpdated,
  onOpenEdit,
  onLikedChange,
}: EventCardActionsMenuProps) {
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user, isAdmin } = useAuth();
  const { appSettings } = useAppSettings();

  const [isDeleting, setIsDeleting] = useState(false);
  const [shareCopied, setShareCopied] = useState<
    "link" | "embed" | "embedcode" | "email" | null
  >(null);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [actionsView, setActionsView] = useState<
    "main" | "add-to-list" | "create-list"
  >("main");
  const [playlists, setPlaylists] = useState<UserList[]>([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(false);
  const [playlistsError, setPlaylistsError] = useState("");
  const [addingToListId, setAddingToListId] = useState<string | null>(null);
  const [addedToListId, setAddedToListId] = useState<string | null>(null);
  const [newListName, setNewListName] = useState("");
  const [newListPrivate, setNewListPrivate] = useState(false);
  const [createListBusy, setCreateListBusy] = useState(false);
  const [createListError, setCreateListError] = useState("");
  const [removeFromListBusy, setRemoveFromListBusy] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(
    null,
  );
  const actionsMenuBtnRef = useRef<HTMLButtonElement | null>(null);
  const playlistsFetchGen = useRef(0);

  useEffect(() => {
    if (!showActionsMenu) {
      setActionsView("main");
      setPlaylists([]);
      setPlaylistsError("");
      setAddingToListId(null);
      setAddedToListId(null);
      setNewListName("");
      setNewListPrivate(false);
      setCreateListBusy(false);
      setCreateListError("");
      setMenuPos(null);
    }
  }, [showActionsMenu]);

  useLayoutEffect(() => {
    if (!showActionsMenu) return;
    const update = () => {
      const el = actionsMenuBtnRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setMenuPos({
        top: rect.bottom + 4,
        right: Math.max(8, window.innerWidth - rect.right),
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [showActionsMenu, actionsView]);

  const loadPlaylists = async () => {
    if (!user) return;
    const gen = ++playlistsFetchGen.current;
    setPlaylistsLoading(true);
    setPlaylistsError("");
    try {
      const { data, error } = await fetchUserPlaylists(user.id);
      if (gen !== playlistsFetchGen.current) return;
      if (error) {
        setPlaylists([]);
        setPlaylistsError(error.message || "Failed to load lists");
        return;
      }
      setPlaylists(data);
    } catch (err) {
      if (gen !== playlistsFetchGen.current) return;
      setPlaylists([]);
      setPlaylistsError(
        err instanceof Error ? err.message : "Failed to load lists",
      );
    } finally {
      if (gen === playlistsFetchGen.current) setPlaylistsLoading(false);
    }
  };

  const openAddToList = async () => {
    if (!user) {
      setShowActionsMenu(false);
      navigate({
        pathname: location.pathname,
        search: setAppModalParams(searchParams, "auth", {
          authMode: "signin",
          authPrompt: t("auth.prompt.addToList"),
        }),
      });
      return;
    }
    setActionsView("add-to-list");
    await loadPlaylists();
  };

  const openCreateList = () => {
    setCreateListError("");
    setNewListName("");
    setNewListPrivate(false);
    setActionsView("create-list");
  };

  const handleCreateListAndAdd = async () => {
    if (!user || createListBusy) return;
    const name = newListName.trim();
    if (!name) {
      setCreateListError("Name is required");
      return;
    }
    setCreateListBusy(true);
    setCreateListError("");
    try {
      const { data: list, error } = await createUserPlaylist(user.id, name, {
        isPublic: !newListPrivate,
        sortOrder: playlists.length,
      });
      if (error || !list) {
        setCreateListError(error?.message || "Failed to create list");
        return;
      }
      const addRes = await addEventToListAndLiked(user.id, list.id, event.id);
      if (addRes.error) {
        setCreateListError(addRes.error.message || "Failed to add show");
        return;
      }
      onLikedChange?.(true);
      setAddedToListId(list.id);
      setPlaylists((prev) => [list, ...prev]);
      const handle = await fetchUserPublicHandle(user.id);
      setShowActionsMenu(false);
      if (handle) {
        navigate(listPagePath(handle, list.id));
      }
    } finally {
      setCreateListBusy(false);
    }
  };

  const handleAddToPlaylist = async (listId: string) => {
    if (!user || addingToListId) return;
    setAddingToListId(listId);
    try {
      const { error } = await addEventToListAndLiked(user.id, listId, event.id);
      if (!error) {
        setAddedToListId(listId);
        onLikedChange?.(true);
        window.setTimeout(() => {
          setShowActionsMenu(false);
        }, 600);
      }
    } finally {
      setAddingToListId(null);
    }
  };

  const handleRemoveFromList = async () => {
    if (!user || !listMembership || removeFromListBusy) return;
    setRemoveFromListBusy(true);
    try {
      const { error } = await removeEventFromList(
        listMembership.listId,
        event.id,
        {
          userId: user.id,
          isLikedList: listMembership.isLikedList,
        },
      );
      if (error) return;
      if (listMembership.isLikedList) onLikedChange?.(false);
      setShowActionsMenu(false);
      onEventUpdated();
    } finally {
      setRemoveFromListBusy(false);
    }
  };

  const shareLink = canonicalEventUrl(event.id);
  const embedLink = `${canonicalEventUrl(event.id)}?embed=1`;
  const embedCode = `<iframe src="${embedLink}" width="400" height="600" frameborder="0" title="${event.name}"></iframe>`;

  const copyToClipboard = async (
    text: string,
    type: "link" | "embed" | "embedcode",
  ) => {
    try {
      await navigator.clipboard.writeText(text);
      setShareCopied(type);
      setTimeout(() => setShareCopied(null), 2000);
    } catch {
      // fallback for older browsers
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setShareCopied(type);
      setTimeout(() => setShareCopied(null), 2000);
    }
  };

  const copyEventEmailCard = async () => {
    const plain = buildEventEmailPlainText(event);
    const html = buildEventEmailRichHtml(event);
    const markCopied = () => {
      setShareCopied("email");
      setTimeout(() => setShareCopied(null), 2000);
    };
    try {
      if (
        typeof navigator.clipboard?.write === "function" &&
        typeof ClipboardItem !== "undefined"
      ) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/plain": new Blob([plain], { type: "text/plain" }),
            "text/html": new Blob([html], { type: "text/html" }),
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
      const ta = document.createElement("textarea");
      ta.value = plain;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      markCopied();
    }
  };

  const canEdit = user && (isAdmin || event.created_by === user.id);
  const canReport = user && event.created_by !== user.id;

  const handleDelete = async () => {
    if (!user || !canEdit) return;

    if (
      !confirm(
        "Are you sure you want to delete this show? This action cannot be undone.",
      )
    ) {
      return;
    }

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("events")
        .delete()
        .eq("id", event.id);

      if (error) throw error;

      void deleteStoredEventImage(event.image_url);

      onEventUpdated();
    } catch (error) {
      console.error("Error deleting event:", error);
      alert("Failed to delete event");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <button
        ref={actionsMenuBtnRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (showActionsMenu) {
            setShowActionsMenu(false);
            return;
          }
          const el = actionsMenuBtnRef.current;
          if (el) {
            const rect = el.getBoundingClientRect();
            setMenuPos({
              top: rect.bottom + 4,
              right: Math.max(8, window.innerWidth - rect.right),
            });
          }
          setShowActionsMenu(true);
        }}
        className="inline-flex shrink-0 items-center p-0.5 leading-none text-muted-foreground hover:text-muted-foreground rounded transition-colors"
        title="Actions"
        aria-haspopup="true"
        aria-expanded={showActionsMenu}
      >
        <MoreVertical size={16} />
      </button>
      {showActionsMenu &&
        menuPos &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[80]"
              onClick={() => setShowActionsMenu(false)}
              aria-hidden="true"
            />
            <div
              className="fixed z-[90] w-56 bg-card rounded-lg shadow-lg border border-border py-1"
              style={{ top: menuPos.top, right: menuPos.right }}
              onClick={(e) => e.stopPropagation()}
            >
              {actionsView === "create-list" ? (
                <div className="px-3 py-2 space-y-2">
                  <BackIconButton
                    size="sm"
                    label={t("nav.back")}
                    className="-ml-1 mb-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActionsView("add-to-list");
                      setCreateListError("");
                      void loadPlaylists();
                    }}
                  />
                  <input
                    type="text"
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleCreateListAndAdd();
                      }
                    }}
                    autoFocus
                    className={`${formControlClass} ${formControlPaddingClass} ${formControlTextClass}`}
                    aria-label={t("event.createList")}
                  />
                  <button
                    type="button"
                    role="switch"
                    aria-checked={newListPrivate}
                    onClick={() => setNewListPrivate((v) => !v)}
                    className="w-full flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5 type-callout text-foreground hover:bg-muted"
                  >
                    <span>{t("event.listPrivate")}</span>
                    <span
                      className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${
                        newListPrivate ? "bg-primary" : "bg-muted-foreground/40"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-card transition-transform ${
                          newListPrivate ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </span>
                  </button>
                  {createListError ? (
                    <p className={formErrorClass}>{createListError}</p>
                  ) : null}
                  <button
                    type="button"
                    disabled={createListBusy}
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleCreateListAndAdd();
                    }}
                    className="w-full rounded-md bg-primary px-2 py-1.5 type-callout text-primary-foreground hover:opacity-90 disabled:opacity-50"
                  >
                    {addedToListId
                      ? t("event.addedToList")
                      : t("event.createList")}
                  </button>
                </div>
              ) : actionsView === "add-to-list" ? (
                <>
                  <div className="border-b border-border px-2 py-1.5">
                    <BackIconButton
                      size="sm"
                      label={t("nav.back")}
                      className="-ml-0.5"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActionsView("main");
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openCreateList();
                    }}
                    className="w-full text-left px-3 py-2 type-callout hover:bg-muted flex items-center gap-2 border-b border-border"
                  >
                    <Plus size={14} className="text-muted-foreground" />
                    <span>{t("event.newList")}</span>
                  </button>
                  {playlistsLoading ? (
                    <div className="px-3 py-3 type-callout text-muted-foreground">
                      …
                    </div>
                  ) : playlistsError ? (
                    <div className={`px-3 py-3 ${formErrorClass}`}>{playlistsError}</div>
                  ) : playlists.length === 0 ? (
                    <div className="px-3 py-3 type-callout text-muted-foreground">
                      {t("event.noLists")}
                    </div>
                  ) : (
                    <div className="max-h-56 overflow-y-auto">
                      {playlists.map((list) => {
                        const justAdded = addedToListId === list.id;
                        const busy = addingToListId === list.id;
                        return (
                          <button
                            key={list.id}
                            type="button"
                            disabled={busy || justAdded}
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleAddToPlaylist(list.id);
                            }}
                            className="w-full text-left px-3 py-2 type-callout hover:bg-muted flex items-center justify-between gap-2 disabled:opacity-60"
                          >
                            <span className="truncate">{list.name}</span>
                            {justAdded ? (
                              <Check
                                size={14}
                                className="shrink-0 text-foreground"
                              />
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void openAddToList();
                    }}
                    className="w-full text-left px-3 py-2 type-callout hover:bg-muted flex items-center gap-2"
                  >
                    <ListPlus
                      size={14}
                      className="shrink-0 text-muted-foreground"
                    />
                    <span>{t("event.addToList")}</span>
                  </button>
                  {listMembership ? (
                    <button
                      type="button"
                      disabled={removeFromListBusy}
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleRemoveFromList();
                      }}
                      className="w-full text-left px-3 py-2 type-callout hover:bg-muted flex items-center gap-2 disabled:opacity-50"
                    >
                      <ListMinus
                        size={14}
                        className="shrink-0 text-muted-foreground"
                      />
                      <span>{t("event.removeFromList")}</span>
                    </button>
                  ) : null}
                  <div className="border-t border-border my-1" />
                  <button
                    onClick={() => {
                      copyToClipboard(shareLink, "link");
                      setShowActionsMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 type-callout hover:bg-muted flex items-center gap-2"
                  >
                    <Share2
                      size={14}
                      className="shrink-0 text-muted-foreground"
                    />
                    <span className="min-w-0 flex-1">Copy link</span>
                    {shareCopied === "link" && (
                      <span className={inlineStatusClass}>
                        {t("chrome.copied")}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      copyToClipboard(embedLink, "embed");
                      setShowActionsMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 type-callout hover:bg-muted flex items-center gap-2"
                  >
                    <Share2
                      size={14}
                      className="shrink-0 text-muted-foreground"
                    />
                    <span>Copy embed URL</span>
                  </button>
                  <button
                    onClick={() => {
                      copyToClipboard(embedCode, "embedcode");
                      setShowActionsMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 type-callout hover:bg-muted flex items-center gap-2"
                  >
                    <Share2
                      size={14}
                      className="shrink-0 text-muted-foreground"
                    />
                    <span>Copy embed code</span>
                  </button>
                  <button
                    onClick={() => {
                      void copyEventEmailCard();
                      setShowActionsMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 type-callout hover:bg-muted flex items-center gap-2"
                  >
                    <Mail
                      size={14}
                      className="shrink-0 text-muted-foreground"
                    />
                    <span className="min-w-0 flex-1">Copy for email</span>
                    {shareCopied === "email" && (
                      <span className={inlineStatusClass}>
                        {t("chrome.copied")}
                      </span>
                    )}
                  </button>
                  {canReport ? (
                    <>
                      <div className="border-t border-border my-1" />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setReportOpen(true);
                          setShowActionsMenu(false);
                        }}
                        className="w-full text-left px-3 py-2 type-callout hover:bg-muted flex items-center gap-2"
                      >
                        <Flag
                          size={14}
                          className="shrink-0 text-muted-foreground"
                        />
                        <span>{t("safety.report.action")}</span>
                      </button>
                    </>
                  ) : null}
                  {canEdit && (
                    <>
                      <div className="border-t border-border my-1" />
                      <button
                        onClick={() => {
                          onOpenEdit();
                          setShowActionsMenu(false);
                        }}
                        className="w-full text-left px-3 py-2 type-callout hover:bg-muted flex items-center gap-2"
                      >
                        <Edit size={14} className="text-foreground" />
                        <span>Edit show</span>
                      </button>
                      <button
                        onClick={() => {
                          handleDelete();
                          setShowActionsMenu(false);
                        }}
                        disabled={isDeleting}
                        className="w-full text-left px-3 py-2 type-callout hover:bg-muted flex items-center gap-2 disabled:opacity-50 text-red-600"
                      >
                        <Trash2 size={14} />
                        <span>Delete show</span>
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          </>,
          document.body,
        )}
      {reportOpen ? (
        <ReportContentModal
          isOpen={reportOpen}
          onClose={() => setReportOpen(false)}
          targetType="event"
          targetId={event.id}
          targetUserId={event.created_by}
          supportEmail={appSettings?.support_email}
          privacyUrl={appSettings?.privacy_policy_url}
          termsUrl={appSettings?.terms_of_service_url}
        />
      ) : null}
    </>
  );
}
