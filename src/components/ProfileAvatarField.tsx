import { useState } from 'react';
import { Label, formErrorClass, formHintClass } from './ui';
import FileUploadPillRow from './FileUploadPillRow';
import ProfileAvatarCard from './profile/ProfileAvatarCard';
import { uploadProfileImageFile } from '../lib/profileImageUpload';
import { useT } from '../hooks/useCopy';

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
 }
 };

 const preview = avatarUrl.trim();

 return (
 <div className="space-y-3">
 <Label>{t('form.profilePicture')}</Label>
 <div className="flex items-center gap-4">
 <ProfileAvatarCard src={preview} preview />
 <FileUploadPillRow
 fileInputId="profile-avatar-file"
 accept="image/*"
 disabled={uploading || !userId}
 chooseLabel={t('form.chooseFile')}
 onFile={(file) => void onPickFile(file)}
 showRemove={!!preview}
 removeLabel={t('form.profilePictureRemove')}
 onRemove={() => onAvatarUrlChange('')}
 />
 </div>
 {uploading ? <p className={formHintClass}>{t('form.imageUploading')}</p> : null}
 {uploadError ? <p className={formErrorClass}>{uploadError}</p> : null}
 </div>
 );
}
