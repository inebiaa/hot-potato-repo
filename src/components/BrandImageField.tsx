import { useState } from 'react';
import FileUploadPillRow from './FileUploadPillRow';
import { Input, Label, formErrorClass, formHintClass } from './ui';
import {
 ensureBrandImageStored,
 uploadBrandImageFile,
 type BrandImageSlot,
} from '../lib/brandImageUpload';
import { isCdnImageUrl } from '../lib/imageCdn';
import { useT } from '../hooks/useCopy';

type BrandImageFieldProps = {
 label: string;
 slot: BrandImageSlot;
 imageUrl: string;
 onImageUrlChange: (url: string) => void;
 previewClassName?: string;
 fileInputId: string;
 urlInputId: string;
};

/** Admin branding asset: file upload or URL paste → durable copy on the image CDN. */
export default function BrandImageField({
 label,
 slot,
 imageUrl,
 onImageUrlChange,
 previewClassName = 'mt-2 h-12 w-12 rounded-lg border object-cover',
 fileInputId,
 urlInputId,
}: BrandImageFieldProps) {
 const t = useT();
 const [uploading, setUploading] = useState(false);
 const [uploadError, setUploadError] = useState<string | null>(null);
 const preview = imageUrl.trim();

 const onPickFile = async (file: File | null) => {
 setUploadError(null);
 if (!file) return;
 setUploading(true);
 try {
 const result = await uploadBrandImageFile(file, slot);
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
 setUploadError(null);
 setUploading(true);
 try {
 const result = await ensureBrandImageStored(trimmed, slot);
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
 <Label>{label}</Label>
 <FileUploadPillRow
 fileInputId={fileInputId}
 accept="image/*,.ico"
 disabled={uploading}
 chooseLabel={t('form.chooseFile')}
 onFile={(file) => void onPickFile(file)}
 showRemove={!!preview}
 removeLabel={t('form.imageRemove')}
 onRemove={() => onImageUrlChange('')}
 />
 <Label htmlFor={urlInputId}>{t('form.imageUrl')}</Label>
 <Input
 id={urlInputId}
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
 {preview ? <img src={preview} alt="" className={previewClassName} /> : null}
 {uploading ? <p className={formHintClass}>{t('form.imageUploading')}</p> : null}
 {uploadError ? <p className={formErrorClass}>{uploadError}</p> : null}
 </div>
 );
}
