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

alter table tag_identities add column if not exists public_display_alias_id uuid references tag_aliases(id) on delete set null;

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
CREATE POLICY "Credited users can update tag identity display"
  ON tag_identities FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_tag_credits utc
      WHERE utc.identity_id = tag_identities.id AND utc.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_tag_credits utc
      WHERE utc.identity_id = tag_identities.id AND utc.user_id = auth.uid()
    )
    AND (
      public_display_alias_id IS NULL
      OR EXISTS (
        SELECT 1 FROM tag_aliases ta
        WHERE ta.id = public_display_alias_id AND ta.identity_id = tag_identities.id
      )
    )
  );

CREATE POLICY "Anyone can read tag_aliases"
  ON tag_aliases FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Authenticated can insert tag_aliases"
  ON tag_aliases FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Credited users can delete tag_aliases"
  ON tag_aliases FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_tag_credits utc
      WHERE utc.identity_id = tag_aliases.identity_id AND utc.user_id = auth.uid()
    )
  );
CREATE POLICY "Admins can update tag_aliases"
  ON tag_aliases FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));
CREATE POLICY "Admins can delete tag_aliases"
  ON tag_aliases FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

-- Optional: admin alias maintenance via RPC (bypasses RLS edge cases on DELETE RETURNING)
CREATE OR REPLACE FUNCTION public.admin_delete_tag_alias(p_alias_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n int;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.tag_aliases WHERE id = p_alias_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN
    RAISE EXCEPTION 'alias not found or could not be deleted' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_tag_alias(p_alias_id uuid, p_new_alias text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n int;
  norm text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  norm := lower(regexp_replace(trim(p_new_alias), '[[:space:]]+', ' ', 'g'));
  IF norm = '' THEN
    RAISE EXCEPTION 'invalid alias' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.tag_aliases
  SET alias = trim(p_new_alias), normalized_alias = norm
  WHERE id = p_alias_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN
    RAISE EXCEPTION 'alias not found' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_tag_alias(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_tag_alias(uuid, text) TO authenticated;

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
CREATE POLICY "Users can delete own suggestions"
  ON pending_tag_suggestions FOR DELETE TO authenticated USING (auth.uid() = suggested_by);
`;
