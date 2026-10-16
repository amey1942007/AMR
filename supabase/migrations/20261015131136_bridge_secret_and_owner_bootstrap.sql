-- Bridge heartbeat without service_role + bootstrap owner profile.
-- Applied to AMR (khucmrlbstdlbxcuboub).

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.amr_bridge_config (
  id int primary key default 1 check (id = 1),
  token_sha256 text not null,
  created_at timestamptz not null default now()
);

alter table public.amr_bridge_config enable row level security;

create or replace function public.touch_amr_bot(
  p_bot_id text,
  p_token text,
  p_bridge_version text default null,
  p_camera_url text default null
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  expected text;
begin
  if p_bot_id not in ('amr4', 'hardware-bot') then
    return false;
  end if;
  select token_sha256 into expected from public.amr_bridge_config where id = 1;
  if expected is null or encode(digest(p_token, 'sha256'), 'hex') is distinct from expected then
    return false;
  end if;
  update public.amr_bots
  set last_seen_at = now(),
      bridge_version = coalesce(p_bridge_version, bridge_version),
      camera_url = coalesce(p_camera_url, camera_url),
      online = true,
      updated_at = now()
  where id = p_bot_id;
  return found;
end;
$$;

revoke all on function public.touch_amr_bot(text, text, text, text) from public;
grant execute on function public.touch_amr_bot(text, text, text, text) to anon, authenticated;

insert into public.operator_profiles (user_id, email, authority_rank)
select u.id, u.email,
  case when lower(u.email) = 'amey@amrslam.tech' then 3 else 0 end
from auth.users u
on conflict (user_id) do update
set email = excluded.email,
    authority_rank = greatest(public.operator_profiles.authority_rank, excluded.authority_rank),
    updated_at = now();
