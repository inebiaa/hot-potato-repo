import { useState } from 'react';
import { Label, formErrorClass, formHintClass } from './ui';
import FileUploadPillRow from './FileUploadPillRow';
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
 }
 };

 const preview = coverUrl.trim();

 return (
 <div className="space-y-3">
 <Label>{t('form.profileCover')}</Label>
 <div className="flex items-center gap-4">
 <div className="flex h-16 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
 {preview ? (
 <img src={preview} alt="" className="h-full w-full object-cover" />
 ) : null}
 </div>
 <FileUploadPillRow
 fileInputId="profile-cover-file"
 accept="image/*"
 disabled={uploading || !userId}
 chooseLabel={t('form.chooseFile')}
 onFile={(file) => void onPickFile(file)}
 showRemove={!!preview}
 removeLabel={t('form.profileCoverRemove')}
 onRemove={() => onCoverUrlChange('')}
 />
 </div>
 {uploading ? <p className={formHintClass}>{t('form.imageUploading')}</p> : null}
 {uploadError ? <p className={formErrorClass}>{uploadError}</p> : null}
 </div>
 );
}
