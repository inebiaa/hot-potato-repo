import { useEffect, useRef, useState } from "react";
import { Ban, Flag, MoreVertical } from "lucide-react";
import { ListCover } from "../ListCoverCollage";
import { useT } from "../../hooks/useCopy";
import type { ProfilePageProps } from "./types";
import ProfileAvatarCard from "./ProfileAvatarCard";
import { Button } from "../ui";

interface ProfileHeaderProps {
  coverUrl: string;
  avatarUrl: string;
  username: string;
  userIdPublic: string;
  isOwnProfile: boolean;
  currentUserFullName?: string;
  currentUserEmailPrefix?: string;
  tagColors?: ProfilePageProps["tagColors"];
  showSafetyMenu?: boolean;
  isBlocked?: boolean;
  onReport?: () => void;
  onBlock?: () => void;
  onUnblock?: () => void;
}

export default function ProfileHeader({
  coverUrl,
  avatarUrl,
  username,
  userIdPublic,
  isOwnProfile,
  currentUserFullName,
  currentUserEmailPrefix,
  tagColors,
  showSafetyMenu = false,
  isBlocked = false,
  onReport,
  onBlock,
  onUnblock,
}: ProfileHeaderProps) {
  const t = useT();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const displayName =
    username.trim() ||
    (isOwnProfile && currentUserFullName?.trim()) ||
    (isOwnProfile && currentUserEmailPrefix?.trim()) ||
    t("nav.profile");

  const cover = coverUrl.trim();
  const pillBg = tagColors?.optional_tags_bg_color || "#e0e7ff";
  const pillText = tagColors?.optional_tags_text_color || "#3730a3";

  return (
    <header className="mb-10">
      {isBlocked ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/60 px-4 py-3 type-callout">
          <span className="text-foreground">{t("safety.block.banner")}</span>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => onUnblock?.()}
          >
            {t("safety.block.unblock")}
          </Button>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="relative h-40 bg-muted sm:h-52 lg:h-56">
          {cover ? (
            <ListCover coverUrl={cover} className="h-full w-full" />
          ) : (
            <div className="h-full w-full bg-muted" aria-hidden />
          )}
          {showSafetyMenu ? (
            <div ref={menuRef} className="absolute right-3 top-3 z-20">
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-card/90 text-muted-foreground shadow-sm hover:bg-card"
                aria-label="Profile options"
                onClick={() => setMenuOpen((v) => !v)}
              >
                <MoreVertical size={18} />
              </button>
              {menuOpen ? (
                <div className="absolute right-0 mt-1 min-w-[10rem] overflow-hidden rounded-lg border border-border bg-card py-1 shadow-lg">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left type-body hover:bg-muted"
                    onClick={() => {
                      setMenuOpen(false);
                      onReport?.();
                    }}
                  >
                    <Flag
                      size={14}
                      className="shrink-0 text-muted-foreground"
                    />
                    <span>{t("safety.report.action")}</span>
                  </button>
                  {!isBlocked ? (
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left type-body hover:bg-muted"
                      onClick={() => {
                        setMenuOpen(false);
                        onBlock?.();
                      }}
                    >
                      <Ban
                        size={14}
                        className="shrink-0 text-muted-foreground"
                      />
                      <span>{t("safety.block.action")}</span>
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="relative border-t border-border bg-card px-4 sm:px-6">
          <div className="absolute left-4 top-0 z-10 -translate-y-[38%] sm:left-6">
            <ProfileAvatarCard src={avatarUrl} priority />
          </div>

          <div className="flex min-h-20 items-center py-4 sm:min-h-24 sm:py-5">
            <div className="flex min-w-0 items-center gap-2.5 pl-[7.5rem] sm:gap-3 sm:pl-[9rem]">
              <h1 className="min-w-0 max-w-full">
                <span
                  className="inline-block max-w-full truncate rounded-md px-3 py-1.5 text-sm font-medium"
                  style={{ backgroundColor: pillBg, color: pillText }}
                >
                  {displayName}
                </span>
              </h1>
              {userIdPublic ? (
                <p className="shrink-0 type-callout text-muted-foreground">
                  @{userIdPublic}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
