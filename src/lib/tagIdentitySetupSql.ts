export const TAG_IDENTITY_SETUP_SQL = `-- Tag identity system
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

create table if not exists user_tag_credits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  identity_id uuid not null references tag_identities(id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists user_tag_credits_user_identity_unique
  on user_tag_credits (user_id, identity_id);
`;

export const TAG_IDENTITY_RLS_SQL = `-- RLS policies for tag identity tables
ALTER TABLE tag_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tag_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read tag_identities"
  ON tag_identities FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Authenticated can insert tag_identities"
  ON tag_identities FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can read own credits"
  ON user_tag_credits FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own credits"
  ON user_tag_credits FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own credits"
  ON user_tag_credits FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own credits"
  ON user_tag_credits FOR DELETE TO authenticated USING (auth.uid() = user_id);
`;
