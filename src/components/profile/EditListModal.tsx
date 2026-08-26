import { useRef } from 'react';
import { Button, Input, Label, Modal, formErrorClass, formHintClass } from '../ui';
import { useT } from '../../hooks/useCopy';
import { deleteStoredListCover } from '../../lib/listCoverUpload';

interface EditListModalProps {
 name: string;
 description: string;
 coverUrl: string;
 coverOriginal: string;
 nameEditable: boolean;
 coverBusy: boolean;
 busy: boolean;
 error: string;
 canUpload: boolean;
 onNameChange: (value: string) => void;
 onDescriptionChange: (value: string) => void;
 onCoverUrlChange: (value: string) => void;
 onCoverFile: (file: File | null) => void;
 onSubmit: (e: React.FormEvent) => void;
 onClose: () => void;
}

export default function EditListModal({
 name,
 description,
 coverUrl,
 coverOriginal,
 nameEditable,
 coverBusy,
 busy,
 error,
 canUpload,
 onNameChange,
 onDescriptionChange,
 onCoverUrlChange,
 onCoverFile,
 onSubmit,
 onClose,
}: EditListModalProps) {
 const t = useT();
 const coverFileRef = useRef<HTMLInputElement | null>(null);

 return (
 <Modal onClose={onClose} title={t('event.editList')} panelClassName="max-w-md sm:rounded-lg">
 <form onSubmit={onSubmit} className="space-y-4 p-4 sm:p-6">
 {nameEditable ? (
 <div>
 <Label htmlFor="edit-list-name">Name</Label>
 <Input
 id="edit-list-name"
 type="text"
 value={name}
 onChange={(e) => onNameChange(e.target.value)}
 autoFocus
 />
 </div>
 ) : null}
 <div>
 <Label htmlFor="edit-list-description">Description</Label>
 <Input
 id="edit-list-description"
 type="text"
 value={description}
 onChange={(e) => onDescriptionChange(e.target.value)}
 />
 </div>
 <div className="space-y-3">
 <Label htmlFor="edit-list-cover">{t('form.listCover')}</Label>
 <div className="flex items-center gap-4">
 <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
 {coverUrl.trim() ? (
 <img src={coverUrl.trim()} alt="" className="h-full w-full object-cover" />
 ) : null}
 </div>
 <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
 <Input
 ref={coverFileRef}
 id="edit-list-cover"
 type="file"
 accept="image/*"
 disabled={coverBusy || busy || !canUpload}
 className="max-w-full"
 onChange={(e) => {
 void onCoverFile(e.target.files?.[0] ?? null);
 if (coverFileRef.current) coverFileRef.current.value = '';
 }}
 />
 {coverUrl.trim() ? (
 <Button
 type="button"
 variant="ghost"
 size="sm"
 disabled={coverBusy || busy}
 onClick={() => {
 if (coverUrl && coverUrl !== coverOriginal) {
 void deleteStoredListCover(coverUrl);
 }
 onCoverUrlChange('');
 }}
 >
 {t('form.listCoverRemove')}
 </Button>
 ) : null}
 </div>
 </div>
 {coverBusy ? (
 <p className={formHintClass}>{t('form.imageUploading')}</p>
 ) : null}
 </div>
 {error ? <p className={formErrorClass}>{error}</p> : null}
 <div className="flex gap-2">
 <Button type="submit" disabled={busy || coverBusy}>
 Save
 </Button>
 <Button type="button" variant="secondary" onClick={onClose}>
 Cancel
 </Button>
 </div>
 </form>
 </Modal>
 );
}
