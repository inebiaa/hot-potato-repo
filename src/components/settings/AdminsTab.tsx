import { Trash2 } from 'lucide-react';

export type AdminUser = {
  id: string;
  user_id: string;
  user_id_public?: string | null;
  username?: string | null;
};

export type AdminsTabProps = {
  adminUserIdPublic: string;
  setAdminUserIdPublic: (v: string) => void;
  adminLoading: boolean;
  adminUsers: AdminUser[];
  handleAddAdmin: () => void | Promise<void>;
  handleRemoveAdmin: (id: string) => void;
};

export default function AdminsTab(p: AdminsTabProps) {
  const {
    adminUserIdPublic,
    setAdminUserIdPublic,
    adminLoading,
    adminUsers,
    handleAddAdmin,
    handleRemoveAdmin,
  } = p;

  return (
              <>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={adminUserIdPublic}
                    onChange={(e) => setAdminUserIdPublic(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void handleAddAdmin();
                      }
                    }}
                    placeholder="User ID"
                    className="flex-1 rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                  />
                  <button
                    type="button"
                    disabled={adminLoading}
                    onClick={() => void handleAddAdmin()}
                    className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-neutral-800 disabled:opacity-50"
                  >
                    {adminLoading ? 'Adding...' : 'Add Admin'}
                  </button>
                </div>
                <div className="space-y-2">
                  {adminUsers.map((admin) => (
                    <div key={admin.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm font-medium">
                        {admin.user_id_public ? `@${admin.user_id_public}` : admin.user_id}
                        {admin.username ? ` (${admin.username})` : ''}
                      </span>
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
  );
}
