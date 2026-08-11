import { useRef, useState } from 'react';
import { Input, Label } from './ui';
import {
  ensureEventImageStored,
  eventImageStoragePathFromUrl,
  uploadEventImageFile,
} from '../lib/eventImageUpload';
import { useT } from '../contexts/CopyContext';

type EventImageFieldProps = {
  imageUrl: string;
  onImageUrlChange: (url: string) => void;
  userId: string | undefined;
};

/** File upload or paste URL — both end up as a durable copy in Supabase Storage. */
export default function EventImageField({
  imageUrl,
  onImageUrlChange,
  userId,
}: EventImageFieldProps) {
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
      const result = await uploadEventImageFile(file, userId);
      if ('error' in result) {
        setUploadError(result.error);
        return;
      }
      onImageUrlChange(result.url);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const rehostUrl = async (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed || eventImageStoragePathFromUrl(trimmed)) return;
    if (!userId) {
      setUploadError(t('form.imageUploadSignIn'));
      return;
    }
    setUploadError(null);
    setUploading(true);
    try {
      const result = await ensureEventImageStored(trimmed);
      if ('error' in result) {
        setUploadError(result.error);
        return;
      }
      if (result.url) onImageUrlChange(result.url);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="event-image-file">{t('form.showPhoto')}</Label>
      <Input
        ref={fileRef}
        id="event-image-file"
        type="file"
        accept="image/*"
        disabled={uploading || !userId}
        onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)}
      />
      <Label htmlFor="imageUrl">{t('form.imageUrl')}</Label>
      <Input
        id="imageUrl"
        type="url"
        value={imageUrl}
        onChange={(e) => {
          setUploadError(null);
          onImageUrlChange(e.target.value);
        }}
        onBlur={() => void rehostUrl(imageUrl)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            void rehostUrl(imageUrl);
          }
        }}
        placeholder={t('form.imageUrl.placeholder')}
        disabled={uploading}
      />
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          className="mt-1 h-24 w-full max-w-xs rounded-md object-cover"
        />
      ) : null}
      {uploading ? <p className="text-xs text-muted-foreground">{t('form.imageUploading')}</p> : null}
      {uploadError ? <p className="text-sm text-destructive">{uploadError}</p> : null}
    </div>
  );
}
