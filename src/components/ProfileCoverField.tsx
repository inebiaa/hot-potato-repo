import { useRef, useState } from 'react';
import { Input, Label, Button } from './ui';
import { uploadProfileCoverFile } from '../lib/profileImageUpload';
import { useT } from '../hooks/useCopy';

type ProfileCoverFieldProps = {
  coverUrl: string;
  onCoverUrlChange: (url: string) => void;
  userId: string | undefined;
};

export default function ProfileCoverField({
  coverUrl,
  onCoverUrlChange,
  userId,
}: ProfileCoverFieldProps) {
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
      const result = await uploadProfileCoverFile(file, userId);
      if ('error' in result) {
        setUploadError(result.error);
        return;
      }
      onCoverUrlChange(result.url);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const preview = coverUrl.trim();

  return (
    <div className="space-y-3">
      <Label htmlFor="profile-cover-file">{t('form.profileCover')}</Label>
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
          {preview ? (
            <img src={preview} alt="" className="h-full w-full object-cover" />
          ) : null}
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <Input
            ref={fileRef}
            id="profile-cover-file"
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
              onClick={() => onCoverUrlChange('')}
            >
              {t('form.profileCoverRemove')}
            </Button>
          ) : null}
        </div>
      </div>
      {uploading ? <p className="text-xs text-muted-foreground">{t('form.imageUploading')}</p> : null}
      {uploadError ? <p className="text-sm text-destructive">{uploadError}</p> : null}
    </div>
  );
}
