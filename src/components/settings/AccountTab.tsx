import type { Dispatch, FormEvent, KeyboardEvent, RefObject, SetStateAction } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import TagPillSplitLabel, { tagPillSplitSegmentGroupClass } from '../TagPillSplitLabel';
import { normalizeTagName, type TagType } from '../../lib/tagIdentity';
import { Button, Input, Label } from '../ui';
import {
  ALIAS_NEUTRAL_PILL_COLORS,
  CONNECT_CREATE_TYPE_PILLS,
  connectSearchTypePrefix,
  creditPillClass,
  creditPillSegmentColors,
  formatTagTypeLabel,
} from './pillHelpers';

export type CreditRow = {
  id: string;
  identity_id: string;
  preferred_alias_id: string | null;
  public_display_alias_id: string | null;
  tag_type: string;
  canonical_name: string;
  aliases: { id: string; alias: string }[];
};

export type CreditSearchResult = {
  id: string;
  tag_type: string;
  canonical_name: string;
  fromEvent?: boolean;
};

export type AccountTabProps = {
  editName: string;
  setEditName: (v: string) => void;
  editUsername: string;
  setEditUsername: (v: string) => void;
  profileSaveError: string;
  profileSaving: boolean;
  saveAccountProfile: (e: FormEvent) => void | Promise<void>;
  connectName: string;
  setConnectName: (v: string) => void;
  connectType: TagType;
  setConnectType: (v: TagType) => void;
  creditSearchResults: CreditSearchResult[];
  creditSearching: boolean;
  connectListActiveIdx: number;
  setConnectListActiveIdx: (v: number) => void;
  showCreateTagForm: boolean;
  setShowCreateTagForm: Dispatch<SetStateAction<boolean>>;
  creditConnectSuccess: string;
  creditsError: string | null;
  credits: CreditRow[];
  aliasDeleteModeIdentityId: string | null;
  setAliasDeleteModeIdentityId: (v: string | null) => void;
  addingAliasForIdentityId: string | null;
  setAddingAliasForIdentityId: (v: string | null) => void;
  newAliasByIdentity: Record<string, string>;
  setNewAliasByIdentity: Dispatch<SetStateAction<Record<string, string>>>;
  connectSearchInputRef: RefObject<HTMLInputElement | null>;
  handleConnectSearchKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  selectCreditSearchResult: (item: CreditSearchResult) => void | Promise<void>;
  connectOrCreateCredit: (createIfMissing: boolean) => void | Promise<void>;
  removeCredit: (creditId: string) => void | Promise<void>;
  setPublicDisplayAlias: (identityId: string, aliasId: string | null) => void | Promise<void>;
  removeAliasForCredit: (credit: CreditRow, aliasId: string) => void | Promise<void>;
  addAliasForCredit: (credit: CreditRow) => void | Promise<void>;
  addProfileNameAsAlias: (credit: CreditRow) => void | Promise<void>;
};

export default function AccountTab(p: AccountTabProps) {
  const {
    editName, setEditName, editUsername, setEditUsername, profileSaveError, profileSaving, saveAccountProfile,
    connectName, setConnectName, connectType, setConnectType, creditSearchResults, creditSearching,
    connectListActiveIdx, setConnectListActiveIdx, showCreateTagForm, setShowCreateTagForm,
    creditConnectSuccess, creditsError, credits, aliasDeleteModeIdentityId, setAliasDeleteModeIdentityId,
    addingAliasForIdentityId, setAddingAliasForIdentityId, newAliasByIdentity, setNewAliasByIdentity,
    connectSearchInputRef, handleConnectSearchKeyDown, selectCreditSearchResult, connectOrCreateCredit,
    removeCredit, setPublicDisplayAlias, removeAliasForCredit, addAliasForCredit, addProfileNameAsAlias,
  } = p;

  return (
              <div className="space-y-6">
                <section>
                  <h3 className="mb-2 text-sm font-semibold text-foreground">Profile</h3>
                  <p className="mb-3 text-xs text-muted-foreground">Display name and username.</p>
                  <form onSubmit={saveAccountProfile} className="space-y-4">
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
                      <p className="mt-0.5 text-xs text-muted-foreground">Shown on your profile.</p>
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
                      <p className="mt-0.5 text-xs text-muted-foreground">Letters, numbers, underscore, hyphen.</p>
                    </div>
                    {profileSaveError && <p className="text-sm text-destructive">{profileSaveError}</p>}
                    <Button type="submit" disabled={profileSaving}>
                      {profileSaving ? 'Saving…' : 'Save Profile'}
                    </Button>
                  </form>
                </section>

                <section>
                  <h3 className="text-sm font-semibold text-neutral-800 mb-1">Tags linked to your profile</h3>
                  <p className="text-xs text-neutral-500 mb-3">Link credits from shows. Pick the name shown on cards.</p>
                  <div className="space-y-3">
                    <div className="relative">
                      <input
                        ref={connectSearchInputRef}
                        value={connectName}
                        onChange={(e) => setConnectName(e.target.value)}
                        onKeyDown={handleConnectSearchKeyDown}
                        placeholder="Search shows, designers, models…"
                        className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                        aria-autocomplete="list"
                        aria-controls="connect-tag-results"
                        aria-expanded={connectName.trim().length >= 2 && creditSearchResults.length > 0}
                      />
                      {creditSearching && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400">Searching…</span>
                      )}
                    </div>
                    {connectName.trim().length >= 2 && creditSearchResults.length > 0 && (
                      <div
                        id="connect-tag-results"
                        role="listbox"
                        className="rounded-md border border-neutral-200 bg-white divide-y divide-neutral-100 max-h-56 overflow-y-auto shadow-sm"
                      >
                        {creditSearchResults.map((identity, idx) => (
                          <div
                            key={identity.id}
                            role="option"
                            aria-selected={idx === connectListActiveIdx}
                            id={`connect-opt-${idx}`}
                            className={`flex items-stretch gap-2 px-3 py-2 ${idx === connectListActiveIdx ? 'bg-gray-50' : ''}`}
                            onMouseEnter={() => setConnectListActiveIdx(idx)}
                          >
                            <div className="flex flex-1 min-w-0 items-center gap-2 text-left">
                              <span className="text-gray-400 text-xs shrink-0">{connectSearchTypePrefix(identity.tag_type)}</span>
                              <span className="text-sm text-gray-900 truncate">{identity.canonical_name}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => selectCreditSearchResult(identity)}
                              className="shrink-0 self-center text-xs px-2.5 py-1.5 rounded-md bg-neutral-900 text-white hover:bg-neutral-800"
                            >
                              Connect
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {connectName.trim().length >= 2 && !creditSearching && creditSearchResults.length === 0 && (
                      <p className="text-xs text-neutral-600">
                        No match.{' '}
                        <button
                          type="button"
                          className="text-neutral-800 underline hover:no-underline"
                          onClick={() => setShowCreateTagForm(true)}
                        >
                          Create tag
                        </button>
                      </p>
                    )}
                    <div className="pt-1 border-t border-neutral-100">
                      <button
                        type="button"
                        onClick={() => setShowCreateTagForm((v) => !v)}
                        aria-expanded={showCreateTagForm}
                        className="text-xs text-neutral-700 underline hover:text-neutral-900"
                      >
                        {showCreateTagForm ? 'Hide' : 'Create new tag'}
                      </button>
                      {showCreateTagForm && (
                        <div className="mt-3 p-3 rounded-lg border border-neutral-200 bg-white space-y-2">
                          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Tag type">
                            {CONNECT_CREATE_TYPE_PILLS.map((p) => (
                              <button
                                key={p.value}
                                type="button"
                                data-tag-pill
                                onClick={() => setConnectType(p.value)}
                                className={creditPillClass(connectType === p.value)}
                              >
                                <TagPillSplitLabel text={p.label} segmentColors={creditPillSegmentColors(connectType === p.value)} />
                              </button>
                            ))}
                          </div>
                          <div className="flex flex-wrap gap-2 items-end">
                            <div className="flex-1 min-w-[140px]">
                              <label htmlFor="connect-create-name" className="block text-[11px] text-neutral-500 mb-0.5">Name</label>
                              <input
                                id="connect-create-name"
                                value={connectName}
                                onChange={(e) => setConnectName(e.target.value)}
                                placeholder="Name as it should appear"
                                className="w-full text-xs px-2 py-1.5 rounded-md border border-neutral-200 bg-white"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => connectOrCreateCredit(true)}
                              className="text-xs px-2.5 py-1.5 rounded-md bg-neutral-900 text-white hover:bg-neutral-800"
                            >
                              Create and link
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  {creditConnectSuccess && <p className="text-xs text-green-700 mt-2">{creditConnectSuccess}</p>}
                  {creditsError && <p className="text-xs text-amber-700 mt-2">{creditsError}</p>}
                  {credits.length === 0 && (
                    <div className="mt-4 rounded-lg border border-dashed border-neutral-200 bg-neutral-50/50 p-4 text-sm text-neutral-600">
                      <p className="font-medium text-neutral-800 mb-1">No tags yet</p>
                      <p className="text-xs text-neutral-500">Search for how you are credited on a show. Add aliases after linking.</p>
                    </div>
                  )}
                  {credits.length > 0 && (
                    <div className="space-y-3 mt-4">
                      {credits.map((credit) => {
                        const publicLabel =
                          credit.aliases.find((a) => a.id === credit.public_display_alias_id)?.alias ?? credit.canonical_name;
                        const aliasRemovable = (alias: { alias: string }) =>
                          normalizeTagName(alias.alias) !== normalizeTagName(credit.canonical_name);
                        const inDeleteMode = aliasDeleteModeIdentityId === credit.identity_id;
                        return (
                          <div key={credit.id} className="rounded-xl border border-neutral-100 p-3 bg-neutral-50/70 space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center text-xs px-2 py-1 rounded-md bg-gray-300 text-gray-600">
                                {formatTagTypeLabel(credit.tag_type)}
                              </span>
                              <span className="text-sm font-medium text-neutral-900">{publicLabel}</span>
                              <button
                                type="button"
                                onClick={() => { if (window.confirm('Remove this credit from your profile?')) removeCredit(credit.id); }}
                                className="ml-auto text-[11px] text-neutral-400 hover:text-red-600"
                                title="Remove credit"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                            <div>
                              <label className="block text-[11px] font-medium text-neutral-600 mb-1">Name on event cards</label>
                              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Name on event cards">
                                <button
                                  type="button"
                                  data-tag-pill
                                  onClick={() => setPublicDisplayAlias(credit.identity_id, null)}
                                  className={creditPillClass(!credit.public_display_alias_id)}
                                  title={`Default · ${credit.canonical_name}`}
                                >
                                  <TagPillSplitLabel
                                    text={`Default · ${credit.canonical_name}`}
                                    segmentColors={creditPillSegmentColors(!credit.public_display_alias_id)}
                                  />
                                </button>
                                {credit.aliases.map((a) => (
                                  <button
                                    key={a.id}
                                    type="button"
                                    data-tag-pill
                                    onClick={() => setPublicDisplayAlias(credit.identity_id, a.id)}
                                    className={creditPillClass(credit.public_display_alias_id === a.id)}
                                  >
                                    <TagPillSplitLabel
                                      text={a.alias}
                                      segmentColors={creditPillSegmentColors(credit.public_display_alias_id === a.id)}
                                    />
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div>
                              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                <span className="text-[11px] font-medium text-neutral-600">Also credited as</span>
                                {inDeleteMode ? (
                                  <button
                                    type="button"
                                    onClick={() => setAliasDeleteModeIdentityId(null)}
                                    className="text-[11px] text-neutral-600 hover:text-neutral-900"
                                  >
                                    Done
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setAliasDeleteModeIdentityId(credit.identity_id)}
                                    className="text-[11px] text-neutral-500 hover:text-neutral-800"
                                  >
                                    Remove aliases
                                  </button>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-1.5 items-center">
                                {credit.aliases.map((alias) => {
                                  const removable = aliasRemovable(alias);
                                  return (
                                    <span
                                      key={alias.id}
                                      data-tag-pill
                                      className={`relative ${tagPillSplitSegmentGroupClass} p-0 text-xs ${inDeleteMode && removable ? 'pill-wiggle' : ''}`}
                                    >
                                      <TagPillSplitLabel text={alias.alias} segmentColors={ALIAS_NEUTRAL_PILL_COLORS} />
                                      {inDeleteMode && removable && (
                                        <button
                                          type="button"
                                          className="absolute -top-2 -right-2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white border border-neutral-300 text-neutral-600 shadow-sm hover:bg-neutral-50"
                                          title="Remove alias"
                                          onMouseDown={(e) => e.stopPropagation()}
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            if (!window.confirm('Remove this alias?')) return;
                                            void removeAliasForCredit(credit, alias.id);
                                          }}
                                          aria-label={`Remove alias ${alias.alias}`}
                                        >
                                          <X size={16} strokeWidth={2} />
                                        </button>
                                      )}
                                    </span>
                                  );
                                })}
                                {addingAliasForIdentityId === credit.identity_id ? (
                                  <div className="inline-flex flex-wrap items-center gap-1.5">
                                    <input
                                      value={newAliasByIdentity[credit.identity_id] || ''}
                                      onChange={(e) => setNewAliasByIdentity((prev) => ({ ...prev, [credit.identity_id]: e.target.value }))}
                                      placeholder="New alias"
                                      className="text-xs px-2 py-1.5 rounded-md border border-neutral-200 bg-white min-w-[140px]"
                                      autoFocus
                                    />
                                    <button
                                      type="button"
                                      onClick={() => addAliasForCredit(credit)}
                                      className="text-xs px-2.5 py-1.5 rounded-md border border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                                    >
                                      Add
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setAddingAliasForIdentityId(null)}
                                      className="text-xs text-neutral-500 hover:text-neutral-800"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setAddingAliasForIdentityId(credit.identity_id)}
                                    className="inline-flex items-center justify-center text-xs px-2 py-1 rounded-md border border-dashed border-gray-300 text-gray-500 hover:bg-gray-50"
                                    title="Add alias"
                                  >
                                    <Plus size={14} />
                                  </button>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => addProfileNameAsAlias(credit)}
                                className="mt-2 text-xs text-neutral-600 hover:text-neutral-900 underline-offset-2 hover:underline"
                              >
                                Use profile name as alias
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>
  );
}
