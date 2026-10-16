-- 01_allowlist_email_active: permitted_operators becomes the allowlist (email, display_name, active). Additive only.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

alter table public.permitted_operators
  add column if not exists email text,
  add column if not exists active boolean not null default true;   -- existing rows get active=true (see apply_log)

alter table public.permitted_operators
  add constraint permitted_operators_email_chk
  check (email is null or (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'));
create unique index if not exists permitted_operators_email_key on public.permitted_operators (email) where email is not null;

-- New allowlist rows may be inserted with just (email, display_name): legacy NOT NULL columns get defaults.
create or replace function private.allowlist_defaults() returns trigger
language plpgsql set search_path = '' as $$
declare base text;
begin
  if new.email is not null then
    new.email := lower(btrim(new.email));
    if new.auth_email is null then new.auth_email := new.email; end if;
    if new.username is null then
      base := regexp_replace(lower(split_part(new.email, '@', 1)), '[^a-z0-9_]', '_', 'g');
      if base !~ '^[a-z]' then base := 'u' || base; end if;
      base := left(base, 27);
      new.username := base;
      if exists (select 1 from public.permitted_operators p where p.username = new.username) then
        new.username := base || '_' || substr(md5(new.email), 1, 4);
      end if;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists permitted_operators_defaults on public.permitted_operators;
create trigger permitted_operators_defaults before insert on public.permitted_operators
  for each row execute function private.allowlist_defaults();

-- Link a new Auth user to its allowlist row by email (additive; the old profile trigger is untouched).
create or replace function private.link_allowlist_on_user_created() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.permitted_operators set user_id = new.id, updated_at = now()
   where email = lower(new.email) and user_id is null;
  return new;
end $$;
drop trigger if exists on_auth_user_created_link_allowlist on auth.users;
create trigger on_auth_user_created_link_allowlist after insert on auth.users
  for each row execute function private.link_allowlist_on_user_created();

-- Who may use the bot: signed-in AND allowlisted AND active. No ranks.
create or replace function private.is_active_operator(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.permitted_operators o where o.user_id = uid and o.active);
$$;
create or replace function private.is_bridge_for(bot text) returns boolean
language sql stable set search_path = '' as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'amr_role', '') = 'bridge'
     and (auth.jwt() -> 'app_metadata' -> 'bot_ids') ? bot;
$$;
create or replace function private.topic_bot() returns text
language sql stable set search_path = '' as $$
  select split_part(realtime.topic(), ':', 2);
$$;
revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;

-- Names-only list for the UI ("X is there"): active operators only. No emails.
create or replace function public.operator_names() returns table (user_id uuid, display_name text)
language sql stable security definer set search_path = '' as $$
  select o.user_id, coalesce(o.display_name, split_part(o.email, '@', 1), o.username)
    from public.permitted_operators o
   where o.active and o.user_id is not null and private.is_active_operator(auth.uid());
$$;
revoke all on function public.operator_names() from public, anon;
grant execute on function public.operator_names() to authenticated;

-- Called by the set-password page after updateUser({password}).
create or replace function public.mark_password_set() returns void
language sql security definer set search_path = '' as $$
  update public.permitted_operators set password_set = true, updated_at = now()
   where user_id = auth.uid() and active;
$$;
revoke all on function public.mark_password_set() from public, anon;
grant execute on function public.mark_password_set() to authenticated;

-- Optional Auth "Before User Created" hook (NOT enabled by this migration; Amey enables it in the Dashboard if wanted).
create or replace function public.hook_before_user_created(event jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.permitted_operators o
                  where o.active and o.email = lower(event -> 'user' ->> 'email')) then
    return jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'Not on the allowlist'));
  end if;
  return '{}'::jsonb;
end $$;
revoke all on function public.hook_before_user_created(jsonb) from public, anon, authenticated;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
