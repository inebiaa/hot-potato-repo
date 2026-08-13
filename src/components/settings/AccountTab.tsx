import { User } from 'lucide-react';
import ProfileAvatarField from '../ProfileAvatarField';
import ProfileCoverField from '../ProfileCoverField';
import { Button, Input, Label } from '../ui';

export type AccountTabProps = {
  editEmail: string;
  setEditEmail: (v: string) => void;
  editName: string;
  setEditName: (v: string) => void;
  editUsername: string;
  setEditUsername: (v: string) => void;
  editAvatarUrl: string;
  setEditAvatarUrl: (v: string) => void;
  editCoverUrl: string;
  setEditCoverUrl: (v: string) => void;
  userId: string;
  profileSaveError: string;
  profileSaving: boolean;
  saveAccountProfile: () => void | Promise<void>;
};

export default function AccountTab(p: AccountTabProps) {
  const {
    editEmail, setEditEmail,
    editName, setEditName, editUsername, setEditUsername,
    editAvatarUrl, setEditAvatarUrl, editCoverUrl, setEditCoverUrl, userId,
    profileSaveError, profileSaving, saveAccountProfile,
  } = p;

  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-2 text-sm font-semibold text-foreground">Account</h3>
        <div className="mb-3 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
          {editAvatarUrl.trim() ? (
            <img src={editAvatarUrl.trim()} alt="" className="h-full w-full object-cover" />
          ) : (
            <User size={28} className="text-muted-foreground" strokeWidth={1.5} aria-hidden />
          )}
        </div>
        <dl className="mb-4 space-y-2 rounded-lg border border-border bg-muted/40 p-3 text-sm">
          <div className="min-w-0">
            <dt className="text-muted-foreground">Name</dt>
            <dd className="truncate font-medium text-foreground">{editName.trim() || '—'}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-muted-foreground">Email</dt>
            <dd className="truncate font-medium text-foreground">{editEmail.trim() || '—'}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-muted-foreground">Username</dt>
            <dd className="truncate font-medium text-foreground">
              {editUsername.trim() ? `@${editUsername.trim()}` : '—'}
            </dd>
          </div>
        </dl>
      </section>
      <section>
        <h3 className="mb-2 text-sm font-semibold text-foreground">Profile</h3>
        <div className="space-y-4">
          <ProfileAvatarField
            avatarUrl={editAvatarUrl}
            onAvatarUrlChange={setEditAvatarUrl}
            userId={userId}
          />
          <ProfileCoverField
            coverUrl={editCoverUrl}
            onCoverUrlChange={setEditCoverUrl}
            userId={userId}
          />
          <div>
            <Label htmlFor="editName">Your Name</Label>
            <Input
              id="editName"
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              maxLength={80}
              placeholder="Jane Doe"
            />
          </div>
          <div>
            <Label htmlFor="editEmail">Email</Label>
            <Input
              id="editEmail"
              type="email"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <Label htmlFor="editUsername">Username</Label>
            <Input
              id="editUsername"
              type="text"
              value={editUsername}
              onChange={(e) => setEditUsername(e.target.value)}
              minLength={4}
              maxLength={30}
              pattern="[a-zA-Z0-9_-]+"
              placeholder="janedoe2024"
            />
          </div>
          {profileSaveError && <p className="text-sm text-destructive">{profileSaveError}</p>}
          <Button type="button" disabled={profileSaving} onClick={() => void saveAccountProfile()}>
            {profileSaving ? 'Saving…' : 'Save Profile'}
          </Button>
        </div>
      </section>
    </div>
  );
}
