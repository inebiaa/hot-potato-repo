import { Plus, Trash2, X } from 'lucide-react';
import TagPillSplitLabel, { tagPillSplitSegmentGroupClass } from '../TagPillSplitLabel';
import type { TagIdentityRecord } from '../../lib/tagIdentity';
import {
  ALIAS_NEUTRAL_PILL_COLORS,
  connectSearchTypePrefix,
  creditPillSegmentColors,
  formatTagTypeLabel,
  linkedGroupPillClass,
} from './pillHelpers';

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
  adminIdentitySearch: string;
  setAdminIdentitySearch: (v: string) => void;
  adminIdentitySearching: boolean;
  adminManagedIdentity: TagIdentityRecord | null;
  setAdminManagedIdentity: (v: TagIdentityRecord | null) => void;
  setAdminManagedAliases: (v: unknown) => void;
  adminIdentitySearchResults: TagIdentityRecord[];
  selectAdminManagedIdentity: (row: TagIdentityRecord) => void;
  adminIdentityClusterMembers: Array<{ id: string; canonical_name: string }>;
  switchAdminToLinkedMember: (row: { id: string; canonical_name: string }) => void;
  runAdminUnlink: (identityId: string) => void | Promise<void>;
  adminLinking: boolean;
  adminAliasLoading: boolean;
  adminAliasError: string;
  adminAliasesForDisplay: Array<{ id: string; alias: string; normalized_alias: string }>;
  adminAliasDeleteMode: boolean;
  setAdminAliasDeleteMode: (v: boolean | ((b: boolean) => boolean)) => void;
  editingAdminAliasId: string | null;
  setEditingAdminAliasId: (v: string | null) => void;
  editAdminAliasDraft: string;
  setEditAdminAliasDraft: (v: string) => void;
  saveAdminAliasEdit: () => void | Promise<void>;
  deleteAdminAliasRow: (id: string) => void | Promise<void>;
  adminAddingAlias: boolean;
  setAdminAddingAlias: (v: boolean) => void;
  newAdminAliasText: string;
  setNewAdminAliasText: (v: string) => void;
  addAdminAliasRow: () => void | Promise<void>;
  adminMergeSearch: string;
  setAdminMergeSearch: (v: string) => void;
  adminMergeSearching: boolean;
  adminMergeSearchResults: TagIdentityRecord[];
  setAdminMergeSearchResults: (v: TagIdentityRecord[]) => void;
  adminMergeAbsorb: TagIdentityRecord | null;
  setAdminMergeAbsorb: (v: TagIdentityRecord | null) => void;
  selectAdminMergeAbsorb: (row: TagIdentityRecord) => void;
  runAdminLink: () => void | Promise<void>;
  setAdminIdentityClusterMembers: (v: Array<{ id: string; canonical_name: string }>) => void;
  fetchAdminLinkContextGenRef: { current: number };
};

export default function AdminsTab(p: AdminsTabProps) {
  const {
    adminUserIdPublic,
    setAdminUserIdPublic,
    adminLoading,
    adminUsers,
    handleAddAdmin,
    handleRemoveAdmin,
    adminIdentitySearch,
    setAdminIdentitySearch,
    adminIdentitySearching,
    adminManagedIdentity,
    setAdminManagedIdentity,
    setAdminManagedAliases,
    adminIdentitySearchResults,
    selectAdminManagedIdentity,
    adminIdentityClusterMembers,
    switchAdminToLinkedMember,
    runAdminUnlink,
    adminLinking,
    adminAliasLoading,
    adminAliasError,
    adminAliasesForDisplay,
    adminAliasDeleteMode,
    setAdminAliasDeleteMode,
    editingAdminAliasId,
    setEditingAdminAliasId,
    editAdminAliasDraft,
    setEditAdminAliasDraft,
    saveAdminAliasEdit,
    deleteAdminAliasRow,
    adminAddingAlias,
    setAdminAddingAlias,
    newAdminAliasText,
    setNewAdminAliasText,
    addAdminAliasRow,
    adminMergeSearch,
    setAdminMergeSearch,
    adminMergeSearching,
    adminMergeSearchResults,
    setAdminMergeSearchResults,
    adminMergeAbsorb,
    setAdminMergeAbsorb,
    selectAdminMergeAbsorb,
    runAdminLink,
    setAdminIdentityClusterMembers,
    fetchAdminLinkContextGenRef,
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
                <p className="text-xs text-gray-500 -mt-1">Use the member's public User ID from their profile.</p>
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

                <section
                  className="border-t border-neutral-100 pt-5 mt-5 space-y-3"
                  aria-labelledby="admin-tag-aliases-heading"
                >
                  <h3 id="admin-tag-aliases-heading" className="text-sm font-semibold text-neutral-800">
                    Tag aliases
                  </h3>
                  <div className="relative">
                    <input
                      type="text"
                      value={adminIdentitySearch}
                      onChange={(e) => setAdminIdentitySearch(e.target.value)}
                      placeholder="Search (2+ letters)…"
                      className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                      autoComplete="off"
                    />
                    {adminIdentitySearching && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400">…</span>
                    )}
                  </div>
                  {adminIdentitySearch.trim().length >= 2 && !adminManagedIdentity && adminIdentitySearchResults.length > 0 && (
                    <div className="rounded-md border border-neutral-200 bg-white divide-y divide-neutral-100 max-h-40 overflow-y-auto">
                      {adminIdentitySearchResults.map((row) => (
                        <button
                          key={row.id}
                          type="button"
                          onClick={() => selectAdminManagedIdentity(row)}
                          className="w-full flex items-stretch gap-2 px-3 py-2 text-left hover:bg-neutral-50"
                        >
                          <span className="text-neutral-400 text-xs shrink-0">{connectSearchTypePrefix(row.tag_type)}</span>
                          <span className="text-sm text-neutral-900 truncate flex-1">{row.canonical_name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {adminIdentitySearch.trim().length >= 2 && !adminManagedIdentity && !adminIdentitySearching && adminIdentitySearchResults.length === 0 && (
                    <p className="text-xs text-neutral-500">No match.</p>
                  )}

                  {adminManagedIdentity && (
                    <div className="rounded-xl border border-neutral-200 bg-white p-3 space-y-3">
                      <div className="flex flex-wrap items-start gap-2">
                        <div className="min-w-0 flex-1">
                          {adminIdentityClusterMembers.length >= 2 ? (
                            <div className="space-y-2 min-w-0">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <span className="inline-flex items-center text-xs px-2 py-1 rounded-md bg-gray-300 text-gray-600 shrink-0">
                                  {formatTagTypeLabel(adminManagedIdentity.tag_type)}
                                </span>
                                <span className="text-neutral-300 text-[11px] select-none" aria-hidden>
                                  ·
                                </span>
                                <span className="text-sm font-medium text-neutral-900 min-w-0 break-words">
                                  {adminManagedIdentity.canonical_name}
                                </span>
                              </div>
                              <div
                                className="flex flex-wrap items-center gap-1.5 pl-0"
                                role="group"
                                aria-label="Other names in this linked set"
                              >
                                {adminIdentityClusterMembers
                                  .filter((m) => m.id !== adminManagedIdentity.id)
                                  .sort((a, b) => a.canonical_name.localeCompare(b.canonical_name))
                                  .map((m) => (
                                    <span
                                      key={m.id}
                                      className="inline-flex items-center max-w-full gap-0.5"
                                    >
                                      <button
                                        type="button"
                                        data-tag-pill
                                        className={linkedGroupPillClass()}
                                        onClick={() => switchAdminToLinkedMember(m)}
                                        title={`Edit “${m.canonical_name}”`}
                                      >
                                        <TagPillSplitLabel
                                          text={m.canonical_name}
                                          segmentColors={creditPillSegmentColors(false)}
                                        />
                                      </button>
                                      <button
                                        type="button"
                                        className="shrink-0 p-0.5 leading-none text-neutral-400 hover:text-red-600 disabled:opacity-40"
                                        disabled={adminLinking}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          void runAdminUnlink(m.id);
                                        }}
                                        title={`Remove “${m.canonical_name}” from the linked set`}
                                        aria-label={`Remove ${m.canonical_name} from the linked set`}
                                      >
                                        <X size={12} />
                                      </button>
                                    </span>
                                  ))}
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                              <span className="inline-flex items-center text-xs px-2 py-1 rounded-md bg-gray-300 text-gray-600 shrink-0">
                                {formatTagTypeLabel(adminManagedIdentity.tag_type)}
                              </span>
                              <span className="text-neutral-300 text-[11px] select-none" aria-hidden>
                                ·
                              </span>
                              <span className="text-sm font-medium text-neutral-900 break-words min-w-0">
                                {adminManagedIdentity.canonical_name}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              fetchAdminLinkContextGenRef.current += 1;
                              setAdminManagedIdentity(null);
                              setAdminManagedAliases([]);
                              setAdminAliasDeleteMode(false);
                              setEditingAdminAliasId(null);
                              setAdminAddingAlias(false);
                              setNewAdminAliasText('');
                              setAdminMergeSearch('');
                              setAdminMergeSearchResults([]);
                              setAdminMergeAbsorb(null);
                              setAdminIdentityClusterMembers([]);
                            }}
                            className="text-xs px-2 py-1 rounded border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                          >
                            Back
                          </button>
                        </div>
                      </div>
                      {adminAliasLoading && <p className="text-xs text-neutral-500">Loading…</p>}
                      {adminAliasError && <p className="text-xs text-amber-800">{adminAliasError}</p>}

                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] text-neutral-500">Aliases</span>
                          {adminAliasesForDisplay.length > 0 && (
                            adminAliasDeleteMode ? (
                              <button
                                type="button"
                                onClick={() => setAdminAliasDeleteMode(false)}
                                className="text-[11px] text-neutral-600"
                              >
                                Done
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setAdminAliasDeleteMode(true)}
                                className="text-[11px] text-neutral-500"
                              >
                                Remove
                              </button>
                            )
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5 items-center">
                          {adminAliasesForDisplay.map((al) =>
                            editingAdminAliasId === al.id ? (
                              <div key={al.id} className="inline-flex flex-wrap items-center gap-1.5">
                                <input
                                  value={editAdminAliasDraft}
                                  onChange={(e) => setEditAdminAliasDraft(e.target.value)}
                                  className="text-xs px-2 py-1.5 rounded-md border border-neutral-200 bg-white min-w-[140px]"
                                  autoFocus
                                />
                                <button
                                  type="button"
                                  onClick={() => void saveAdminAliasEdit()}
                                  className="text-xs px-2.5 py-1.5 rounded-md border border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingAdminAliasId(null);
                                    setEditAdminAliasDraft('');
                                  }}
                                  className="text-xs text-neutral-500 hover:text-neutral-800"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <span
                                key={al.id}
                                data-tag-pill
                                className={`relative ${tagPillSplitSegmentGroupClass} p-0 text-xs ${adminAliasDeleteMode ? 'pill-wiggle' : ''}`}
                              >
                                <TagPillSplitLabel text={al.alias} segmentColors={ALIAS_NEUTRAL_PILL_COLORS} />
                                {!adminAliasDeleteMode && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingAdminAliasId(al.id);
                                      setEditAdminAliasDraft(al.alias);
                                    }}
                                    className="ml-1 text-[10px] text-neutral-400 hover:text-neutral-700 underline"
                                  >
                                    Edit
                                  </button>
                                )}
                                {adminAliasDeleteMode && (
                                  <button
                                    type="button"
                                    className="absolute -top-2 -right-2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white border border-neutral-300 text-neutral-600 shadow-sm hover:bg-neutral-50"
                                    title="Remove alias"
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      if (!window.confirm('Remove this alias?')) return;
                                      void deleteAdminAliasRow(al.id);
                                    }}
                                    aria-label={`Remove alias ${al.alias}`}
                                  >
                                    <X size={16} strokeWidth={2} />
                                  </button>
                                )}
                              </span>
                            )
                          )}
                          {adminAddingAlias ? (
                            <div className="inline-flex flex-wrap items-center gap-1.5">
                              <input
                                value={newAdminAliasText}
                                onChange={(e) => setNewAdminAliasText(e.target.value)}
                                placeholder="New alias"
                                className="text-xs px-2 py-1.5 rounded-md border border-neutral-200 bg-white min-w-[140px]"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => void addAdminAliasRow()}
                                className="text-xs px-2.5 py-1.5 rounded-md border border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                              >
                                Add
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setAdminAddingAlias(false);
                                  setNewAdminAliasText('');
                                }}
                                className="text-xs text-neutral-500 hover:text-neutral-800"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setAdminAddingAlias(true)}
                              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-dashed border-neutral-300 text-neutral-600 hover:bg-neutral-50"
                            >
                              <Plus size={14} className="shrink-0" />
                              Add spelling
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-neutral-200/80 space-y-2">
                        <p className="text-[11px] text-neutral-500">Link a second profile (same type)</p>
                        <div className="relative">
                          <input
                            type="text"
                            value={adminMergeSearch}
                            onChange={(e) => setAdminMergeSearch(e.target.value)}
                            placeholder="Search other name…"
                            className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                            autoComplete="off"
                          />
                          {adminMergeSearching && (
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400">…</span>
                          )}
                        </div>
                        {adminMergeSearch.trim().length >= 2 && adminMergeSearchResults.length > 0 && (
                          <div className="rounded-md border border-neutral-200 max-h-32 overflow-y-auto divide-y divide-neutral-100">
                            {adminMergeSearchResults.map((row) => (
                              <button
                                key={row.id}
                                type="button"
                                onClick={() => selectAdminMergeAbsorb(row)}
                                className="w-full flex items-center gap-2 text-left px-3 py-2 text-sm text-neutral-900 hover:bg-neutral-50"
                              >
                                <span className="text-neutral-400 text-xs shrink-0">{connectSearchTypePrefix(row.tag_type)}</span>
                                <span className="truncate">{row.canonical_name}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        {adminMergeSearch.trim().length >= 2 && !adminMergeSearching && adminMergeSearchResults.length === 0 && (
                          <p className="text-xs text-neutral-500">No match.</p>
                        )}
                        {adminMergeAbsorb && (
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                            <span className="text-xs text-neutral-600">
                              Link &quot;{adminMergeAbsorb.canonical_name}&quot; with &quot;{adminManagedIdentity.canonical_name}&quot;?
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                className="text-xs px-2 py-1 rounded border border-neutral-200"
                                onClick={() => setAdminMergeAbsorb(null)}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                disabled={adminLinking}
                                onClick={() => void runAdminLink()}
                                className="text-xs px-2 py-1 rounded bg-amber-200 text-amber-950 font-medium disabled:opacity-50"
                              >
                                {adminLinking ? '…' : 'Link'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </section>
              </>
  );
}
