import { useEffect, useState } from 'react';
import { Trash2, User } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import ProfileAvatarField from '../ProfileAvatarField';
import ProfileCoverField from '../ProfileCoverField';
import {
 Button,
 Input,
 Label,
 Modal,
 formErrorClass,
 formHintClass,
 menuRowClass,
 sectionHeadClass,
 typeCallout,
} from '../ui';
import { useAuth } from '../../contexts/AuthContext';
import { deleteOwnAccount } from '../../lib/deleteAccount';
import { fetchBlockedUsersWithLabels, unblockUser } from '../../lib/ugcSafety';
import { useT } from '../../hooks/useCopy';

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
 privacyUrl?: string;
 termsUrl?: string;
};

export default function AccountTab(p: AccountTabProps) {
 const {
 editEmail, setEditEmail,
 editName, setEditName, editUsername, setEditUsername,
 editAvatarUrl, setEditAvatarUrl, editCoverUrl, setEditCoverUrl, userId,
 profileSaveError, profileSaving, saveAccountProfile,
 privacyUrl, termsUrl,
 } = p;

 const t = useT();
 const navigate = useNavigate();
 const { signOut, refreshBlocks } = useAuth();

 const [blockedUsers, setBlockedUsers] = useState<
 { userId: string; displayName: string; handle: string | null }[]
 >([]);
 const [blockedLoading, setBlockedLoading] = useState(false);

 const [deletePassword, setDeletePassword] = useState('');
 const [deleteError, setDeleteError] = useState('');
 const [deleteBusy, setDeleteBusy] = useState(false);
 const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

 const loadBlocked = async () => {
 setBlockedLoading(true);
 try {
 setBlockedUsers(await fetchBlockedUsersWithLabels());
 } finally {
 setBlockedLoading(false);
 }
 };

 useEffect(() => {
 void loadBlocked();
 }, [userId]);

 const handleUnblock = async (blockedId: string) => {
 const { error } = await unblockUser(blockedId);
 if (error) return;
 await refreshBlocks();
 await loadBlocked();
 };

 const handleDeleteAccount = async () => {
 setDeleteError('');
 setDeleteBusy(true);
 const { error } = await deleteOwnAccount(deletePassword);
 setDeleteBusy(false);
 if (error) {
 setDeleteError(error);
 return;
 }
 await signOut();
 setDeleteConfirmOpen(false);
 navigate('/');
 };

 const privacy = (privacyUrl || '').trim();
 const terms = (termsUrl || '').trim();

 return (
 <div className="space-y-8">
 <section>
 <h3 className={`mb-2 ${sectionHeadClass}`}>Account</h3>
 <div className="mb-3 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
 {editAvatarUrl.trim() ? (
 <img src={editAvatarUrl.trim()} alt="" className="h-full w-full object-cover" />
 ) : (
 <User size={28} className="text-muted-foreground" strokeWidth={1.5} aria-hidden />
 )}
 </div>
 <dl className={`mb-4 space-y-2 rounded-lg border border-border bg-muted/40 p-3 ${menuRowClass}`}>
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
 <h3 className={`mb-2 ${sectionHeadClass}`}>Profile</h3>
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
 {profileSaveError ? <p className={formErrorClass}>{profileSaveError}</p> : null}
 <Button type="button" disabled={profileSaving} onClick={() => void saveAccountProfile()}>
 {profileSaving ? 'Saving…' : 'Save Profile'}
 </Button>
 </div>
 </section>

 <section>
 <h3 className={`mb-2 ${sectionHeadClass}`}>{t('safety.blocked.title')}</h3>
 {blockedLoading ? (
 <p className={`${typeCallout} text-muted-foreground`}>{t('safety.blocked.loading')}</p>
 ) : blockedUsers.length === 0 ? (
 <p className={`${typeCallout} text-muted-foreground`}>{t('safety.blocked.empty')}</p>
 ) : (
 <ul className="space-y-2">
 {blockedUsers.map((row) => (
 <li
 key={row.userId}
 className={`flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2 ${menuRowClass}`}
 >
 <span className="min-w-0 truncate font-medium text-foreground">
 {row.displayName}
 {row.handle ? (
 <span className="ml-1 font-normal text-muted-foreground">@{row.handle}</span>
 ) : null}
 </span>
 <Button type="button" size="sm" variant="secondary" onClick={() => void handleUnblock(row.userId)}>
 {t('safety.block.unblock')}
 </Button>
 </li>
 ))}
 </ul>
 )}
 </section>

 <section className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
 <h3 className={`mb-2 ${sectionHeadClass} text-destructive`}>{t('safety.delete.title')}</h3>
 <p className={`mb-4 ${typeCallout} text-muted-foreground`}>{t('safety.delete.body')}</p>
 <div className="space-y-3">
 <div>
 <Label htmlFor="delete-account-password">{t('safety.delete.passwordLabel')}</Label>
 <Input
 id="delete-account-password"
 type="password"
 value={deletePassword}
 onChange={(e) => setDeletePassword(e.target.value)}
 autoComplete="current-password"
 />
 </div>
 {deleteError ? <p className={formErrorClass}>{deleteError}</p> : null}
 <Button
 type="button"
 variant="danger"
 disabled={!deletePassword.trim()}
 onClick={() => setDeleteConfirmOpen(true)}
 >
 <Trash2 size={16} />
 {t('safety.delete.submit')}
 </Button>
 </div>
 </section>

 <p className={formHintClass}>
 <Link to="/account-deletion" className="underline underline-offset-2">
 {t('auth.deleteAccountPage.title')}
 </Link>
 {(privacy || terms) && ' · '}
 {privacy ? (
 <a href={privacy} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
 {t('safety.legal.privacy')}
 </a>
 ) : null}
 {privacy && terms ? ' · ' : null}
 {terms ? (
 <a href={terms} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
 {t('safety.legal.terms')}
 </a>
 ) : null}
 </p>

 {deleteConfirmOpen ? (
 <Modal
 onClose={() => setDeleteConfirmOpen(false)}
 title={t('safety.delete.confirmTitle')}
 panelClassName="max-w-md sm:rounded-lg"
 >
 <div className="space-y-4 p-4 sm:p-6">
 <p className={`${typeCallout} text-muted-foreground`}>{t('safety.delete.confirmBody')}</p>
 {deleteError ? <p className={formErrorClass}>{deleteError}</p> : null}
 <div className="flex gap-2">
 <Button
 type="button"
 variant="secondary"
 className="flex-1"
 disabled={deleteBusy}
 onClick={() => setDeleteConfirmOpen(false)}
 >
 {t('safety.delete.confirmCancel')}
 </Button>
 <Button
 type="button"
 variant="danger"
 className="flex-1"
 disabled={deleteBusy || !deletePassword.trim()}
 onClick={() => void handleDeleteAccount()}
 >
 <Trash2 size={16} />
 {deleteBusy ? t('safety.delete.submitting') : t('safety.delete.confirmAction')}
 </Button>
 </div>
 </div>
 </Modal>
 ) : null}
 </div>
 );
}
