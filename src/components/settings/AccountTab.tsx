import type { Dispatch, FormEvent, KeyboardEvent, RefObject, SetStateAction } from 'react';
import { Trash2 } from 'lucide-react';
import TagPillSplitLabel from '../TagPillSplitLabel';
import type { TagType } from '../../lib/tagIdentity';
import { Button, Input, Label } from '../ui';
import {
  CONNECT_CREATE_TYPE_PILLS,
  connectSearchTypePrefix,
  creditPillClass,
  creditPillSegmentColors,
  formatTagTypeLabel,
} from './pillHelpers';

export type CreditRow = {
  id: string;
  identity_id: string;
  tag_type: string;
  canonical_name: string;
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
  connectSearchInputRef: RefObject<HTMLInputElement | null>;
  handleConnectSearchKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  selectCreditSearchResult: (item: CreditSearchResult) => void | Promise<void>;
  connectOrCreateCredit: (createIfMissing: boolean) => void | Promise<void>;
  removeCredit: (creditId: string) => void | Promise<void>;
};

export default function AccountTab(p: AccountTabProps) {
  const {
    editName, setEditName, editUsername, setEditUsername, profileSaveError, profileSaving, saveAccountProfile,
    connectName, setConnectName, connectType, setConnectType, creditSearchResults, creditSearching,
    connectListActiveIdx, setConnectListActiveIdx, showCreateTagForm, setShowCreateTagForm,
    creditConnectSuccess, creditsError, credits,
    connectSearchInputRef, handleConnectSearchKeyDown, selectCreditSearchResult, connectOrCreateCredit,
    removeCredit,
  } = p;

  return (
              <div className="space-y-6">
                <section>
                  <h3 className="mb-2 text-sm font-semibold text-foreground">Profile</h3>
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
                    {profileSaveError && <p className="text-sm text-destructive">{profileSaveError}</p>}
                    <Button type="submit" disabled={profileSaving}>
                      {profileSaving ? 'Saving…' : 'Save Profile'}
                    </Button>
                  </form>
                </section>

                <section>
                  <h3 className="text-sm font-semibold text-neutral-800 mb-1">Tags linked to your profile</h3>
                  <div className="space-y-3">
                    <div className="relative">
                      <input
                        ref={connectSearchInputRef}
                        value={connectName}
                        onChange={(e) => setConnectName(e.target.value)}
                        onKeyDown={handleConnectSearchKeyDown}
                        placeholder="Search shows, designers, artists, models…"
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
                            {CONNECT_CREATE_TYPE_PILLS.map((pill) => (
                              <button
                                key={pill.value}
                                type="button"
                                data-tag-pill
                                onClick={() => setConnectType(pill.value)}
                                className={creditPillClass(connectType === pill.value)}
                              >
                                <TagPillSplitLabel text={pill.label} segmentColors={creditPillSegmentColors(connectType === pill.value)} />
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
                    </div>
                  )}
                  {credits.length > 0 && (
                    <div className="space-y-3 mt-4">
                      {credits.map((credit) => (
                        <div key={credit.id} className="rounded-xl border border-neutral-100 p-3 bg-neutral-50/70">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center text-xs px-2 py-1 rounded-md bg-gray-300 text-gray-600">
                              {formatTagTypeLabel(credit.tag_type)}
                            </span>
                            <span className="text-sm font-medium text-neutral-900">{credit.canonical_name}</span>
                            <button
                              type="button"
                              onClick={() => { if (window.confirm('Remove this credit from your profile?')) removeCredit(credit.id); }}
                              className="ml-auto text-[11px] text-neutral-400 hover:text-red-600"
                              title="Remove credit"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
  );
}
