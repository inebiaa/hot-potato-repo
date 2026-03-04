import { useState, useEffect } from 'react';
import { Save, UserPlus, Trash2, Image, Users, Tags } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import TagEditorRow from './TagEditorRow';
import IconPicker from './IconPicker';
import ColorPicker from './ColorPicker';
import { DEFAULT_ICONS } from '../lib/eventCardIcons';

export interface CustomPerformerTag {
  id: string;
  label: string;
  slug: string;
  icon: string;
  bg_color: string;
  text_color: string;
  sort_order: number;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsUpdated: () => void;
}

interface AppSettings {
  app_name: string;
  app_icon_url: string;
  app_logo_url: string;
  tagline: string;
  collapsible_cards_enabled: string;
  producer_bg_color: string;
  producer_text_color: string;
  designer_bg_color: string;
  designer_text_color: string;
  model_bg_color: string;
  model_text_color: string;
  hair_makeup_bg_color: string;
  hair_makeup_text_color: string;
  city_bg_color: string;
  city_text_color: string;
  season_bg_color: string;
  season_text_color: string;
  header_tags_bg_color: string;
  header_tags_text_color: string;
  footer_tags_bg_color: string;
  footer_tags_text_color: string;
  producer_icon: string;
  designer_icon: string;
  model_icon: string;
  hair_makeup_icon: string;
  city_icon: string;
  season_icon: string;
  header_tags_icon: string;
  footer_tags_icon: string;
}

interface AdminUser {
  id: string;
  user_id: string;
  created_at: string;
  email?: string;
}

type TabId = 'branding' | 'admins' | 'tags';

export default function SettingsModal({ isOpen, onClose, onSettingsUpdated }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>('branding');
  const [settings, setSettings] = useState<AppSettings>(() => ({
    app_name: 'Runway Rate',
    app_icon_url: '',
    app_logo_url: '',
    tagline: 'Fashion Show Reviews',
    collapsible_cards_enabled: 'true',
    producer_bg_color: '#f3f4f6',
    producer_text_color: '#374151',
    designer_bg_color: '#fef3c7',
    designer_text_color: '#b45309',
    model_bg_color: '#fce7f3',
    model_text_color: '#be185d',
    hair_makeup_bg_color: '#f3e8ff',
    hair_makeup_text_color: '#7e22ce',
    city_bg_color: '#dbeafe',
    city_text_color: '#1e40af',
    season_bg_color: '#ffedd5',
    season_text_color: '#c2410c',
    header_tags_bg_color: '#ccfbf1',
    header_tags_text_color: '#0f766e',
    footer_tags_bg_color: '#d1fae5',
    footer_tags_text_color: '#065f46',
    producer_icon: DEFAULT_ICONS.producer_icon,
    designer_icon: DEFAULT_ICONS.designer_icon,
    model_icon: DEFAULT_ICONS.model_icon,
    hair_makeup_icon: DEFAULT_ICONS.hair_makeup_icon,
    city_icon: DEFAULT_ICONS.city_icon,
    season_icon: DEFAULT_ICONS.season_icon,
    header_tags_icon: DEFAULT_ICONS.header_tags_icon,
    footer_tags_icon: DEFAULT_ICONS.footer_tags_icon,
  }));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (isOpen) {
      fetchSettings();
      fetchAdminUsers();
    }
  }, [isOpen]);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase.from('app_settings').select('key, value');
      if (error) throw error;
      const settingsObj: Record<string, string> = {};
      data?.forEach((item) => {
        settingsObj[item.key] = item.value || '';
      });

      setSettings({
        app_name: settingsObj.app_name || 'Runway Rate',
        app_icon_url: settingsObj.app_icon_url || '',
        app_logo_url: settingsObj.app_logo_url || '',
        tagline: settingsObj.tagline || 'Fashion Show Reviews',
        collapsible_cards_enabled: settingsObj.collapsible_cards_enabled || 'true',
        producer_bg_color: settingsObj.producer_bg_color || '#f3f4f6',
        producer_text_color: settingsObj.producer_text_color || '#374151',
        designer_bg_color: settingsObj.designer_bg_color || '#fef3c7',
        designer_text_color: settingsObj.designer_text_color || '#b45309',
        model_bg_color: settingsObj.model_bg_color || '#fce7f3',
        model_text_color: settingsObj.model_text_color || '#be185d',
        hair_makeup_bg_color: settingsObj.hair_makeup_bg_color || '#f3e8ff',
        hair_makeup_text_color: settingsObj.hair_makeup_text_color || '#7e22ce',
        city_bg_color: settingsObj.city_bg_color || '#dbeafe',
        city_text_color: settingsObj.city_text_color || '#1e40af',
        season_bg_color: settingsObj.season_bg_color || '#ffedd5',
        season_text_color: settingsObj.season_text_color || '#c2410c',
        header_tags_bg_color: settingsObj.header_tags_bg_color || '#ccfbf1',
        header_tags_text_color: settingsObj.header_tags_text_color || '#0f766e',
        footer_tags_bg_color: settingsObj.footer_tags_bg_color || '#d1fae5',
        footer_tags_text_color: settingsObj.footer_tags_text_color || '#065f46',
        producer_icon: settingsObj.producer_icon || DEFAULT_ICONS.producer_icon,
        designer_icon: settingsObj.designer_icon || DEFAULT_ICONS.designer_icon,
        model_icon: settingsObj.model_icon || DEFAULT_ICONS.model_icon,
        hair_makeup_icon: settingsObj.hair_makeup_icon || DEFAULT_ICONS.hair_makeup_icon,
        city_icon: settingsObj.city_icon || DEFAULT_ICONS.city_icon,
        season_icon: settingsObj.season_icon || DEFAULT_ICONS.season_icon,
        header_tags_icon: settingsObj.header_tags_icon || DEFAULT_ICONS.header_tags_icon,
        footer_tags_icon: settingsObj.footer_tags_icon || DEFAULT_ICONS.footer_tags_icon,
      });
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  };

  const fetchAdminUsers = async () => {
    try {
      const { data, error } = await supabase.from('admin_users').select('id, user_id, created_at');
      if (error) throw error;
      const usersWithEmails = await Promise.all(
        (data || []).map(async (admin) => {
          const { data: userData } = await supabase.auth.admin.getUserById(admin.user_id);
          return { ...admin, email: userData.user?.email || 'Unknown' };
        })
      );
      setAdminUsers(usersWithEmails);
    } catch (err) {
      console.error('Error fetching admin users:', err);
    }
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminEmail.trim()) {
      setError('Please enter an email address');
      return;
    }
    setError('');
    setSuccess('');
    setAdminLoading(true);
    try {
      const { data: { users } = { users: [] }, error: searchError } = await supabase.auth.admin.listUsers();
      if (searchError) throw searchError;
      const foundUser = users?.find((u) => u.email?.toLowerCase() === adminEmail.trim().toLowerCase());
      if (!foundUser) {
        setError('No user found with that email');
        setAdminLoading(false);
        return;
      }
      const { error: insertError } = await supabase.from('admin_users').insert({ user_id: foundUser.id });
      if (insertError) {
        setError(insertError.code === '23505' ? 'User is already an admin' : insertError.message);
        setAdminLoading(false);
        return;
      }
      setSuccess('Admin added');
      setAdminEmail('');
      fetchAdminUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add admin');
    } finally {
      setAdminLoading(false);
    }
  };

  const handleRemoveAdmin = async (adminId: string) => {
    if (adminUsers.length <= 1) {
      setError('Cannot remove the last admin');
      return;
    }
    if (!confirm('Remove this admin?')) return;
    setError('');
    try {
      const { error } = await supabase.from('admin_users').delete().eq('id', adminId);
      if (error) throw error;
      setSuccess('Admin removed');
      fetchAdminUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove admin');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError('You must be logged in');
      return;
    }
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const updates = [
        { key: 'app_name', value: settings.app_name },
        { key: 'app_icon_url', value: settings.app_icon_url },
        { key: 'app_logo_url', value: settings.app_logo_url },
        { key: 'tagline', value: settings.tagline },
        { key: 'collapsible_cards_enabled', value: settings.collapsible_cards_enabled },
        { key: 'producer_bg_color', value: settings.producer_bg_color },
        { key: 'producer_text_color', value: settings.producer_text_color },
        { key: 'designer_bg_color', value: settings.designer_bg_color },
        { key: 'designer_text_color', value: settings.designer_text_color },
        { key: 'model_bg_color', value: settings.model_bg_color },
        { key: 'model_text_color', value: settings.model_text_color },
        { key: 'hair_makeup_bg_color', value: settings.hair_makeup_bg_color },
        { key: 'hair_makeup_text_color', value: settings.hair_makeup_text_color },
        { key: 'city_bg_color', value: settings.city_bg_color },
        { key: 'city_text_color', value: settings.city_text_color },
        { key: 'season_bg_color', value: settings.season_bg_color },
        { key: 'season_text_color', value: settings.season_text_color },
        { key: 'header_tags_bg_color', value: settings.header_tags_bg_color },
        { key: 'header_tags_text_color', value: settings.header_tags_text_color },
        { key: 'footer_tags_bg_color', value: settings.footer_tags_bg_color },
        { key: 'footer_tags_text_color', value: settings.footer_tags_text_color },
        { key: 'producer_icon', value: settings.producer_icon },
        { key: 'designer_icon', value: settings.designer_icon },
        { key: 'model_icon', value: settings.model_icon },
        { key: 'hair_makeup_icon', value: settings.hair_makeup_icon },
        { key: 'city_icon', value: settings.city_icon },
        { key: 'season_icon', value: settings.season_icon },
        { key: 'header_tags_icon', value: settings.header_tags_icon },
        { key: 'footer_tags_icon', value: settings.footer_tags_icon },
      ];

      for (const u of updates) {
        const { error: err } = await supabase
          .from('app_settings')
          .upsert({ key: u.key, value: u.value, updated_by: user.id, updated_at: new Date().toISOString() }, { onConflict: 'key' });
        if (err) throw err;
      }
      setSuccess('Settings saved');
      onSettingsUpdated();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'branding', label: 'Branding', icon: <Image size={18} /> },
    { id: 'admins', label: 'Admins', icon: <Users size={18} /> },
    { id: 'tags', label: 'Tags', icon: <Tags size={18} /> },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="relative max-w-2xl w-full my-8">
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 w-8 h-8 flex items-center justify-center text-white/90 hover:text-white rounded-full hover:bg-white/10 transition-colors text-xl leading-none"
          aria-label="Close"
        >
          ×
        </button>
        <div className="bg-white rounded-xl shadow-xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        <div className="p-4 border-b shrink-0">
          <h2 className="text-xl font-bold">Settings</h2>
        </div>

        <div className="flex border-b shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-5 space-y-5">
            {activeTab === 'branding' && (
              <>
                <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-sm text-blue-800">
                  <strong>Images:</strong> Upload to <a href="https://imgur.com" target="_blank" rel="noopener noreferrer" className="underline">Imgur</a> or <a href="https://postimages.org" target="_blank" rel="noopener noreferrer" className="underline">PostImages</a>, then paste the direct URL.
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">App Name</label>
                  <input
                    type="text"
                    value={settings.app_name}
                    onChange={(e) => setSettings((s) => ({ ...s, app_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tagline</label>
                  <input
                    type="text"
                    value={settings.tagline}
                    onChange={(e) => setSettings((s) => ({ ...s, tagline: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">App Icon URL</label>
                  <input
                    type="url"
                    value={settings.app_icon_url}
                    onChange={(e) => setSettings((s) => ({ ...s, app_icon_url: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="https://..."
                  />
                  {settings.app_icon_url && <img src={settings.app_icon_url} alt="" className="mt-2 w-12 h-12 rounded-lg border object-cover" />}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">App Logo URL</label>
                  <input
                    type="url"
                    value={settings.app_logo_url}
                    onChange={(e) => setSettings((s) => ({ ...s, app_logo_url: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="https://..."
                  />
                  {settings.app_logo_url && <img src={settings.app_logo_url} alt="" className="mt-2 h-10 object-contain" />}
                </div>
              </>
            )}

            {activeTab === 'admins' && (
              <>
                <form onSubmit={handleAddAdmin} className="flex gap-2">
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="User email"
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <button type="submit" disabled={adminLoading} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50">
                    {adminLoading ? 'Adding...' : 'Add Admin'}
                  </button>
                </form>
                <div className="space-y-2">
                  {adminUsers.map((admin) => (
                    <div key={admin.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm font-medium">{admin.email}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAdmin(admin.id)}
                        disabled={adminUsers.length <= 1}
                        className="text-red-500 hover:text-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {activeTab === 'tags' && (
              <>
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Core Tags</h3>
                  <p className="text-xs text-gray-500 mb-3">Icon + colors for each built-in tag type. Only admins can change these.</p>
                  <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 p-2">
                    {[
                      { k: 'producer', label: 'Producer' },
                      { k: 'designer', label: 'Designer' },
                      { k: 'model', label: 'Model' },
                      { k: 'hair_makeup', label: 'Hair & Makeup' },
                      { k: 'city', label: 'City' },
                      { k: 'season', label: 'Season' },
                      { k: 'header_tags', label: 'Genre' },
                      { k: 'footer_tags', label: 'Footer Tags' },
                    ].map(({ k, label }) => (
                      <TagEditorRow
                        key={k}
                        label={label}
                        iconValue={(settings as Record<string, string>)[`${k}_icon`]}
                        onIconChange={(v) => setSettings((s) => ({ ...s, [`${k}_icon`]: v }))}
                        bgValue={(settings as Record<string, string>)[`${k}_bg_color`]}
                        textValue={(settings as Record<string, string>)[`${k}_text_color`]}
                        onBgChange={(v) => setSettings((s) => ({ ...s, [`${k}_bg_color`]: v }))}
                        onTextChange={(v) => setSettings((s) => ({ ...s, [`${k}_text_color`]: v }))}
                        compact
                      />
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {(error || success) && (
            <div className="px-5 pb-2">
              {error && <p className="text-sm text-red-600">{error}</p>}
              {success && <p className="text-sm text-green-600">{success}</p>}
            </div>
          )}

          <div className="p-5 border-t bg-gray-50">
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
            >
              <Save size={18} />
              {loading ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
}
