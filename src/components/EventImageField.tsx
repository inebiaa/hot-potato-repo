import { useState } from 'react';
import FileUploadPillRow from './FileUploadPillRow';
import { AdminPlaceholderInput } from './PlaceholderCopyEdit';
import { Label, formErrorClass, formHintClass } from './ui';
import { isCdnImageUrl } from '../lib/imageCdn';
import { ensureEventImageStored, uploadEventImageFile } from '../lib/eventImageUpload';
import { useT } from '../hooks/useCopy';

type EventImageFieldProps = {
 imageUrl: string;
 onImageUrlChange: (url: string) => void;
 userId: string | undefined;
};

/** File upload or paste URL — both end up as a durable copy on the image CDN. */
export default function EventImageField({
 imageUrl,
 onImageUrlChange,
 userId,
}: EventImageFieldProps) {
 const t = useT();
 const [uploading, setUploading] = useState(false);
 const [uploadError, setUploadError] = useState<string | null>(null);
 const imagePlaceholder = t('form.imageUrl.placeholder');
 const preview = imageUrl.trim();

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
 }
 };

 const rehostUrl = async (raw: string) => {
 const trimmed = raw.trim();
 if (!trimmed || isCdnImageUrl(trimmed)) return;
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
 <Label>{t('form.showPhoto')}</Label>
 <FileUploadPillRow
 fileInputId="event-image-file"
 accept="image/*"
 disabled={uploading || !userId}
 chooseLabel={t('form.chooseFile')}
 onFile={(file) => void onPickFile(file)}
 showRemove={!!preview}
 removeLabel={t('form.imageRemove')}
 onRemove={() => onImageUrlChange('')}
 />
 <Label htmlFor="imageUrl">{t('form.imageUrl')}</Label>
 <AdminPlaceholderInput
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
 copyKey="form.imageUrl.placeholder"
 placeholder={imagePlaceholder}
 disabled={uploading}
 />
 {preview ? (
 <img
 src={preview}
 alt=""
 className="mt-1 h-24 w-full max-w-xs rounded-md object-cover"
 />
 ) : null}
 {uploadError ? <p className={formErrorClass}>{uploadError}</p> : null}
 {uploading ? <p className={formHintClass}>{t('form.imageUploading')}</p> : null}
 </div>
 );
}
