-- 05_grants_cleanup_and_touch_rate_limit
-- Only privileges that RLS already denies are removed (no behaviour change for the live site).
revoke truncate, trigger, references on all tables in schema public from anon, authenticated;
revoke all on public.amr_bridge_config from anon, authenticated;
revoke all on public.permitted_operators from anon, authenticated;            -- edge function uses service role; RLS had no policies
revoke insert, update, delete on public.site_videos from anon, authenticated;  -- only "select published" policy exists
revoke select, update, delete on public.contact_submissions from anon, authenticated;  -- only the insert policy exists
revoke all on public.amr_bots from anon;                                       -- only an authenticated select policy exists
revoke insert, update, delete on public.amr_bots from authenticated;
revoke all on public.operator_profiles from anon;                              -- only an authenticated select policy exists
revoke insert, update, delete on public.operator_profiles from authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;  -- future tables of this role

-- touch_amr_bot: same signature/behaviour, plus failure rate limit (10 bad tokens per minute -> locked for the minute)
create table if not exists public.bridge_touch_failures (
  id bigint generated always as identity primary key,
  at timestamptz not null default now()
);
create index if not exists bridge_touch_failures_at on public.bridge_touch_failures (at);
alter table public.bridge_touch_failures enable row level security;
revoke all on public.bridge_touch_failures from anon, authenticated, public;

create or replace function public.touch_amr_bot(
  p_bot_id text, p_token text, p_bridge_version text default null, p_camera_url text default null)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare expected text; recent int;
begin
  if p_bot_id not in ('amr4', 'hardware-bot') then return false; end if;
  select count(*) into recent from public.bridge_touch_failures where at > now() - interval '1 minute';
  if recent >= 10 then return false; end if;
  select token_sha256 into expected from public.amr_bridge_config where id = 1;
  if expected is null or encode(digest(p_token, 'sha256'), 'hex') is distinct from expected then
    insert into public.bridge_touch_failures default values;
    delete from public.bridge_touch_failures where at < now() - interval '1 hour';
    return false;
  end if;
  update public.amr_bots
     set last_seen_at = now(), bridge_version = coalesce(p_bridge_version, bridge_version),
         camera_url = coalesce(p_camera_url, camera_url), online = true, updated_at = now()
   where id = p_bot_id;
  return found;
end $$;
