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
`;

export const TAG_IDENTITY_RLS_SQL = `-- RLS policies for tag identity tables
ALTER TABLE tag_identities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read tag_identities"
  ON tag_identities FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Authenticated can insert tag_identities"
  ON tag_identities FOR INSERT TO authenticated WITH CHECK (true);
`;
