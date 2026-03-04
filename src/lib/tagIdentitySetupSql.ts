export const TAG_IDENTITY_SETUP_SQL = `-- Tag identity + pending suggestion system
create table if not exists tag_identities (
  id uuid primary key default gen_random_uuid(),
  tag_type text not null,
  canonical_name text not null,
  normalized_name text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists tag_identities_type_normalized_unique
  on tag_identities (tag_type, normalized_name);

create table if not exists tag_aliases (
  id uuid primary key default gen_random_uuid(),
  identity_id uuid not null references tag_identities(id) on delete cascade,
  alias text not null,
  normalized_alias text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists tag_aliases_identity_normalized_unique
  on tag_aliases (identity_id, normalized_alias);

create table if not exists user_tag_credits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  identity_id uuid not null references tag_identities(id) on delete cascade,
  preferred_alias_id uuid references tag_aliases(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists user_tag_credits_user_identity_unique
  on user_tag_credits (user_id, identity_id);

create table if not exists pending_tag_suggestions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  section_key text not null,
  custom_slug text,
  proposed_name text not null,
  normalized_name text not null,
  linked_identity_id uuid references tag_identities(id) on delete set null,
  suggested_by uuid not null references auth.users(id) on delete cascade,
  connect_as_credit boolean not null default true,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists pending_tag_suggestions_event_status_idx
  on pending_tag_suggestions (event_id, status);
`;

export const TAG_IDENTITY_RLS_SQL = `-- RLS policies for tag identity tables
ALTER TABLE tag_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE tag_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tag_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_tag_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read tag_identities"
  ON tag_identities FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Authenticated can insert tag_identities"
  ON tag_identities FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Anyone can read tag_aliases"
  ON tag_aliases FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Authenticated can insert tag_aliases"
  ON tag_aliases FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can read own credits"
  ON user_tag_credits FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own credits"
  ON user_tag_credits FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own credits"
  ON user_tag_credits FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own credits"
  ON user_tag_credits FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Anyone can read pending_tag_suggestions"
  ON pending_tag_suggestions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert own suggestions"
  ON pending_tag_suggestions FOR INSERT TO authenticated WITH CHECK (auth.uid() = suggested_by);
CREATE POLICY "Event owner or admin can update pending suggestions"
  ON pending_tag_suggestions FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM events e WHERE e.id = pending_tag_suggestions.event_id AND e.created_by = auth.uid())
    OR EXISTS (SELECT 1 FROM admin_users au WHERE au.user_id = auth.uid())
  );
`;
