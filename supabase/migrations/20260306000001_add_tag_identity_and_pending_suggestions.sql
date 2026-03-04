-- Tag identity + pending suggestion system
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
