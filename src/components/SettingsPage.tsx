import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useAccountProfile } from '../hooks/useAccountProfile';
import { useAdminUsers } from '../hooks/useAdminUsers';
import { useSettingsEditor } from '../hooks/useSettingsEditor';
import { useTagPalette } from '../hooks/useTagPalette';
import {
 resolvePinnedArtistNamesToIds,
 serializeHeaderPinnedArtistIds,
} from '../lib/headerPinnedArtists';
import { Button, formErrorClass, formSuccessClass } from './ui';
import AccountTab from './settings/AccountTab';
import AdminsTab from './settings/AdminsTab';
import BrandingTab from './settings/BrandingTab';
import CopyTab from './settings/CopyTab';
import LegalTab from './settings/LegalTab';
import ModerationTab from './settings/ModerationTab';
import SettingsNav, { settingsNavItems } from './settings/SettingsNav';
import TagsTab from './settings/TagsTab';
import { type SwatchColorKey, type TabId } from './settings/settingsConstants';

interface SettingsPageProps {
 onSettingsUpdated: () => void;
 onSettingsPreview?: (settings: import('../types/appSettings').AppSettings) => void;
 onAccountUpdated?: () => void;
}

export default function SettingsPage({
 onSettingsUpdated,
 onSettingsPreview,
 onAccountUpdated,
}: SettingsPageProps) {
 const { user, isAdmin } = useAuth();
 const navItems = settingsNavItems(!!isAdmin);
 const [activeTab, setActiveTab] = useState<TabId>(() => (isAdmin ? 'branding' : 'account'));

 const editor = useSettingsEditor({ onSettingsUpdated, onSettingsPreview });
 const account = useAccountProfile({
 onAccountUpdated,
 onSavedMessage: (message) => {
 onSettingsUpdated();
 editor.flashSuccess(message, message.includes('Confirm') ? 5000 : 3000);
 },
 });
 const palette = useTagPalette({
 settings: editor.settings,
 setSettings: editor.setSettings,
 onSettingsPreview,
 flashSuccess: editor.flashSuccess,
 setError: editor.setError,
 });
 const admins = useAdminUsers({
 enabled: !!isAdmin,
 flashSuccess: editor.flashSuccess,
 setError: editor.setError,
 });

 useEffect(() => {
 if (!isAdmin) setActiveTab('account');
 else if (activeTab === 'account' && !navItems.some((i) => i.id === activeTab)) {
 setActiveTab('branding');
 }
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [isAdmin]);

 const showSave = activeTab === 'branding' || activeTab === 'copy' || activeTab === 'legal' || activeTab === 'tags';

 return (
 <div className="flex flex-col gap-8 md:flex-row md:gap-10">
 <SettingsNav items={navItems} activeTab={activeTab} onChange={setActiveTab} />

 <div className="min-w-0 flex-1 space-y-6">
 {activeTab === 'account' && user ? (
 <AccountTab
 editEmail={account.editEmail}
 setEditEmail={account.setEditEmail}
 editName={account.editName}
 setEditName={account.setEditName}
 editUsername={account.editUsername}
 setEditUsername={account.setEditUsername}
 editAvatarUrl={account.editAvatarUrl}
 setEditAvatarUrl={account.setEditAvatarUrl}
 editCoverUrl={account.editCoverUrl}
 setEditCoverUrl={account.setEditCoverUrl}
 userId={account.userId}
 profileSaveError={account.profileSaveError}
 profileSaving={account.profileSaving}
 saveAccountProfile={account.saveAccountProfile}
 privacyUrl={editor.settings.privacy_policy_url}
 termsUrl={editor.settings.terms_of_service_url}
 />
 ) : null}

 {activeTab === 'moderation' && isAdmin ? <ModerationTab /> : null}

 {activeTab === 'admins' && isAdmin ? (
 <AdminsTab
 adminUserIdPublic={admins.adminUserIdPublic}
 setAdminUserIdPublic={admins.setAdminUserIdPublic}
 adminLoading={admins.adminLoading}
 adminUsers={admins.adminUsers}
 handleAddAdmin={() => void admins.handleAddAdmin()}
 handleRemoveAdmin={admins.handleRemoveAdmin}
 />
 ) : null}

 {showSave ? (
 <form
 onSubmit={(e) => {
 e.preventDefault();
 void editor.saveSettings();
 }}
 className="space-y-6"
 >
 {activeTab === 'branding' ? (
 <BrandingTab
 settings={editor.settings}
 pinnedArtistNames={editor.pinnedArtistNames}
 onPinnedArtistsChange={(names) => {
 editor.setPinnedArtistNames(names);
 void resolvePinnedArtistNamesToIds(names, user?.id).then((ids) => {
 const serialized = serializeHeaderPinnedArtistIds(ids);
 editor.setSettings((s) => {
 const next = { ...s, header_pinned_artists: serialized };
 onSettingsPreview?.(next);
 return next;
 });
 });
 }}
 onChange={editor.patchSettings}
 />
 ) : null}

 {activeTab === 'copy' ? (
 <CopyTab settings={editor.settings} onChange={editor.patchSettings} />
 ) : null}

 {activeTab === 'legal' ? (
 <LegalTab settings={editor.settings} onChange={editor.patchSettings} />
 ) : null}

 {activeTab === 'tags' ? (
 <TagsTab
 settings={editor.settings}
 setSettings={editor.setSettings}
 onSettingsPreview={onSettingsPreview}
 paletteColors={palette.paletteColors}
 editingColor={palette.editingColor}
 setEditingColor={palette.setEditingColor}
 editingHex={palette.editingHex}
 setEditingHex={palette.setEditingHex}
 editColorInPalette={palette.editColorInPalette}
 removeFromPalette={palette.removeFromPalette}
 addToPalette={palette.addToPalette}
 resetPaletteToDefaults={palette.resetPaletteToDefaults}
 collections={palette.collections}
 createCollection={palette.createCollection}
 dragOverCollectionId={palette.dragOverCollectionId}
 setDragOverCollectionId={palette.setDragOverCollectionId}
 addColorToCollection={palette.addColorToCollection}
 updateCollectionName={palette.updateCollectionName}
 deleteCollection={palette.deleteCollection}
 removeColorFromCollection={palette.removeColorFromCollection}
 assigningTag={palette.assigningTag}
 setAssigningTag={(v) => palette.setAssigningTag((v as SwatchColorKey | null) ?? null)}
 assignColorToTag={palette.assignColorToTag}
 tagOptions={palette.tagOptions}
 coreTagOptions={palette.coreTagOptions}
 setAsDefault={palette.setAsDefault}
 revertToDefault={palette.revertToDefault}
 />
 ) : null}

 {(editor.error || editor.success) && (
 <div>
 {editor.error ? <p className={formErrorClass}>{editor.error}</p> : null}
 {editor.success ? <p className={formSuccessClass}>{editor.success}</p> : null}
 </div>
 )}

 <Button type="submit" disabled={editor.loading}>
 <Save size={18} />
 {editor.loading ? 'Saving...' : 'Save Settings'}
 </Button>
 </form>
 ) : null}

 {!showSave && (editor.error || editor.success) ? (
 <div>
 {editor.error ? <p className={formErrorClass}>{editor.error}</p> : null}
 {editor.success ? <p className={formSuccessClass}>{editor.success}</p> : null}
 </div>
 ) : null}
 </div>
 </div>
 );
}
