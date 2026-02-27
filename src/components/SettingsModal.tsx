import { useState, useEffect } from 'react';
import { X, Save, UserPlus, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import ColorPicker from './ColorPicker';

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
}

interface AdminUser {
  id: string;
  user_id: string;
  created_at: string;
  email?: string;
}

export default function SettingsModal({ isOpen, onClose, onSettingsUpdated }: SettingsModalProps) {
  const [settings, setSettings] = useState<AppSettings>({
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
  });
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
      const { data, error } = await supabase
        .from('app_settings')
        .select('key, value');

      if (error) throw error;

      const settingsObj: any = {};
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
      });
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  };

  const fetchAdminUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select('id, user_id, created_at');

      if (error) throw error;

      const usersWithEmails = await Promise.all(
        (data || []).map(async (admin) => {
          const { data: userData } = await supabase.auth.admin.getUserById(admin.user_id);
          return {
            ...admin,
            email: userData.user?.email || 'Unknown',
          };
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
      const { data: userData, error: userError } = await supabase
        .from('auth.users')
        .select('id')
        .eq('email', adminEmail.trim())
        .maybeSingle();

      if (userError) {
        const { data: { users }, error: searchError } = await supabase.auth.admin.listUsers();

        if (searchError) throw searchError;

        const foundUser = users.find(u => u.email?.toLowerCase() === adminEmail.trim().toLowerCase());

        if (!foundUser) {
          setError('No user found with that email address');
          setAdminLoading(false);
          return;
        }

        const { error: insertError } = await supabase
          .from('admin_users')
          .insert({ user_id: foundUser.id });

        if (insertError) {
          if (insertError.code === '23505') {
            setError('This user is already an admin');
          } else {
            throw insertError;
          }
        } else {
          setSuccess('Admin added successfully!');
          setAdminEmail('');
          fetchAdminUsers();
          setTimeout(() => setSuccess(''), 3000);
        }
      } else if (userData) {
        const { error: insertError } = await supabase
          .from('admin_users')
          .insert({ user_id: userData.id });

        if (insertError) {
          if (insertError.code === '23505') {
            setError('This user is already an admin');
          } else {
            throw insertError;
          }
        } else {
          setSuccess('Admin added successfully!');
          setAdminEmail('');
          fetchAdminUsers();
          setTimeout(() => setSuccess(''), 3000);
        }
      }
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

    if (!confirm('Are you sure you want to remove this admin?')) {
      return;
    }

    setError('');
    setSuccess('');

    try {
      const { error } = await supabase
        .from('admin_users')
        .delete()
        .eq('id', adminId);

      if (error) throw error;

      setSuccess('Admin removed successfully!');
      fetchAdminUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove admin');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      setError('You must be logged in to update settings');
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
      ];

      for (const update of updates) {
        const { error: upsertError } = await supabase
          .from('app_settings')
          .upsert(
            {
              key: update.key,
              value: update.value,
              updated_by: user.id,
              updated_at: new Date().toISOString()
            },
            { onConflict: 'key' }
          );

        if (upsertError) throw upsertError;
      }

      setSuccess('Settings updated successfully!');
      onSettingsUpdated();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update settings');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X size={24} />
        </button>

        <h2 className="text-2xl font-bold mb-6">App Settings & Branding</h2>

        <div className="mb-8 bg-gray-50 rounded-lg p-6 border border-gray-200">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <UserPlus size={20} />
            Admin Users
          </h3>

          <form onSubmit={handleAddAdmin} className="mb-4">
            <div className="flex gap-2">
              <input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="Enter user email to add as admin"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={adminLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 font-medium whitespace-nowrap"
              >
                {adminLoading ? 'Adding...' : 'Add Admin'}
              </button>
            </div>
          </form>

          <div className="space-y-2">
            {adminUsers.map((admin) => (
              <div key={admin.id} className="flex items-center justify-between bg-white p-3 rounded-md border border-gray-200">
                <span className="text-sm font-medium">{admin.email}</span>
                <button
                  onClick={() => handleRemoveAdmin(admin.id)}
                  disabled={adminUsers.length <= 1}
                  className="text-red-600 hover:text-red-800 disabled:text-gray-400 disabled:cursor-not-allowed"
                  title={adminUsers.length <= 1 ? 'Cannot remove the last admin' : 'Remove admin'}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">How to Upload Images</h3>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>Upload your images to a free service like <a href="https://imgur.com" target="_blank" rel="noopener noreferrer" className="underline">Imgur</a> or <a href="https://postimages.org" target="_blank" rel="noopener noreferrer" className="underline">PostImages</a></li>
              <li>Copy the direct image URL (must end in .png, .jpg, .jpeg, .gif, or .webp)</li>
              <li>Paste the URL in the fields below</li>
            </ol>
          </div>

          <div>
            <label htmlFor="appName" className="block text-sm font-medium text-gray-700 mb-1">
              App Name
            </label>
            <input
              id="appName"
              type="text"
              value={settings.app_name}
              onChange={(e) => setSettings({ ...settings, app_name: e.target.value })}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Runway Rate"
            />
          </div>

          <div>
            <label htmlFor="tagline" className="block text-sm font-medium text-gray-700 mb-1">
              Tagline
            </label>
            <input
              id="tagline"
              type="text"
              value={settings.tagline}
              onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Fashion Show Reviews"
            />
          </div>

          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <input
              id="collapsibleCards"
              type="checkbox"
              checked={settings.collapsible_cards_enabled === 'true'}
              onChange={(e) => setSettings({ ...settings, collapsible_cards_enabled: e.target.checked ? 'true' : 'false' })}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="collapsibleCards" className="text-sm font-medium text-gray-700 cursor-pointer">
              Enable Collapsible Event Cards (users can click to expand/collapse card details)
            </label>
          </div>

          <div>
            <label htmlFor="appIconUrl" className="block text-sm font-medium text-gray-700 mb-1">
              App Icon URL
            </label>
            <input
              id="appIconUrl"
              type="url"
              value={settings.app_icon_url}
              onChange={(e) => setSettings({ ...settings, app_icon_url: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://example.com/icon.png"
            />
            <p className="text-xs text-gray-500 mt-1">Small square icon (recommended: 48x48px or larger)</p>
            {settings.app_icon_url && (
              <div className="mt-2">
                <img src={settings.app_icon_url} alt="App Icon Preview" className="w-12 h-12 rounded-lg border" />
              </div>
            )}
          </div>

          <div>
            <label htmlFor="appLogoUrl" className="block text-sm font-medium text-gray-700 mb-1">
              App Logo URL (Optional)
            </label>
            <input
              id="appLogoUrl"
              type="url"
              value={settings.app_logo_url}
              onChange={(e) => setSettings({ ...settings, app_logo_url: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://example.com/logo.png"
            />
            <p className="text-xs text-gray-500 mt-1">Horizontal logo for header (recommended: 200x50px or similar ratio)</p>
            {settings.app_logo_url && (
              <div className="mt-2 bg-gray-100 p-4 rounded-lg">
                <img src={settings.app_logo_url} alt="App Logo Preview" className="h-12 object-contain" />
              </div>
            )}
          </div>

          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4">Tag Colors</h3>
            <p className="text-sm text-gray-600 mb-4">Select a color scheme for each tag type by clicking on a color swatch.</p>

            <div className="space-y-6">
              <ColorPicker
                label="Producer Tags"
                bgValue={settings.producer_bg_color}
                textValue={settings.producer_text_color}
                onBgChange={(value) => setSettings(prev => ({ ...prev, producer_bg_color: value }))}
                onTextChange={(value) => setSettings(prev => ({ ...prev, producer_text_color: value }))}
              />

              <ColorPicker
                label="Designer Tags"
                bgValue={settings.designer_bg_color}
                textValue={settings.designer_text_color}
                onBgChange={(value) => setSettings(prev => ({ ...prev, designer_bg_color: value }))}
                onTextChange={(value) => setSettings(prev => ({ ...prev, designer_text_color: value }))}
              />

              <ColorPicker
                label="Model Tags"
                bgValue={settings.model_bg_color}
                textValue={settings.model_text_color}
                onBgChange={(value) => setSettings(prev => ({ ...prev, model_bg_color: value }))}
                onTextChange={(value) => setSettings(prev => ({ ...prev, model_text_color: value }))}
              />

              <ColorPicker
                label="Hair & Makeup Tags"
                bgValue={settings.hair_makeup_bg_color}
                textValue={settings.hair_makeup_text_color}
                onBgChange={(value) => setSettings(prev => ({ ...prev, hair_makeup_bg_color: value }))}
                onTextChange={(value) => setSettings(prev => ({ ...prev, hair_makeup_text_color: value }))}
              />

              <ColorPicker
                label="City Tags"
                bgValue={settings.city_bg_color}
                textValue={settings.city_text_color}
                onBgChange={(value) => setSettings(prev => ({ ...prev, city_bg_color: value }))}
                onTextChange={(value) => setSettings(prev => ({ ...prev, city_text_color: value }))}
              />

              <ColorPicker
                label="Season Tags"
                bgValue={settings.season_bg_color}
                textValue={settings.season_text_color}
                onBgChange={(value) => setSettings(prev => ({ ...prev, season_bg_color: value }))}
                onTextChange={(value) => setSettings(prev => ({ ...prev, season_text_color: value }))}
              />

              <ColorPicker
                label="Header Tags"
                bgValue={settings.header_tags_bg_color}
                textValue={settings.header_tags_text_color}
                onBgChange={(value) => setSettings(prev => ({ ...prev, header_tags_bg_color: value }))}
                onTextChange={(value) => setSettings(prev => ({ ...prev, header_tags_text_color: value }))}
              />

              <ColorPicker
                label="Footer Tags"
                bgValue={settings.footer_tags_bg_color}
                textValue={settings.footer_tags_text_color}
                onBgChange={(value) => setSettings(prev => ({ ...prev, footer_tags_bg_color: value }))}
                onTextChange={(value) => setSettings(prev => ({ ...prev, footer_tags_text_color: value }))}
              />
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
              {error}
            </div>
          )}

          {success && (
            <div className="text-sm text-green-600 bg-green-50 p-3 rounded-md">
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 font-medium"
          >
            <Save size={18} />
            {loading ? 'Saving...' : 'Save Settings'}
          </button>
        </form>
      </div>
    </div>
  );
}
