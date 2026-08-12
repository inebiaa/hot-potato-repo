import { useRef, useState } from 'react';
import { User } from 'lucide-react';
import { Input, Label, Button } from './ui';
import { uploadProfileImageFile } from '../lib/profileImageUpload';
import { useT } from '../contexts/CopyContext';

type ProfileAvatarFieldProps = {
  avatarUrl: string;
  onAvatarUrlChange: (url: string) => void;
  userId: string | undefined;
};

export default function ProfileAvatarField({
  avatarUrl,
  onAvatarUrlChange,
  userId,
}: ProfileAvatarFieldProps) {
  const t = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const onPickFile = async (file: File | null) => {
    setUploadError(null);
    if (!file) return;
    if (!userId) {
      setUploadError(t('form.imageUploadSignIn'));
      return;
    }
    setUploading(true);
    try {
      const result = await uploadProfileImageFile(file, userId);
      if ('error' in result) {
        setUploadError(result.error);
        return;
      }
      onAvatarUrlChange(result.url);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const preview = avatarUrl.trim();

  return (
    <div className="space-y-3">
      <Label htmlFor="profile-avatar-file">{t('form.profilePicture')}</Label>
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
          {preview ? (
            <img src={preview} alt="" className="h-full w-full object-cover" />
          ) : (
            <User size={28} className="text-muted-foreground" strokeWidth={1.5} aria-hidden />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <Input
            ref={fileRef}
            id="profile-avatar-file"
            type="file"
            accept="image/*"
            disabled={uploading || !userId}
            className="max-w-full"
            onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)}
          />
          {preview ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={uploading}
              onClick={() => onAvatarUrlChange('')}
            >
              {t('form.profilePictureRemove')}
            </Button>
          ) : null}
        </div>
      </div>
      {uploading ? <p className="text-xs text-muted-foreground">{t('form.imageUploading')}</p> : null}
      {uploadError ? <p className="text-sm text-destructive">{uploadError}</p> : null}
    </div>
  );
}
