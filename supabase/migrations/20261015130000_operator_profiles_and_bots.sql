-- Remote control: operator ranks + bot registry (amr-bridge /control).
-- Apply in AMR project (khucmrlbstdlbxcuboub). Realtime broadcast does not need
-- these tables for transport, but ranks and camera tunnel URLs live here.

create table if not exists public.operator_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  -- 0 viewer · 1 operator · 2 admin · 3 owner
  authority_rank smallint not null default 0
    check (authority_rank between 0 and 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.operator_profiles enable row level security;

create policy operator_profiles_select_authenticated
  on public.operator_profiles
  for select
  to authenticated
  using (true);

-- Only service role / dashboard edits ranks (no client UPDATE policy).

create table if not exists public.amr_bots (
  id text primary key check (id in ('amr4', 'hardware-bot')),
  label text not null,
  -- Optional Cloudflare Tunnel / Tailscale Funnel URL for MJPEG camera
  camera_url text,
  -- Last bridge heartbeat (updated by bridge with service role)
  last_seen_at timestamptz,
  bridge_version text,
  online boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.amr_bots enable row level security;

create policy amr_bots_select_authenticated
  on public.amr_bots
  for select
  to authenticated
  using (true);

insert into public.amr_bots (id, label)
values
  ('amr4', 'AMR4'),
  ('hardware-bot', 'Hardware bot')
on conflict (id) do nothing;

-- Auto-create a viewer profile on signup (admins raise ranks in Dashboard).
create or replace function public.handle_new_operator_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.operator_profiles (user_id, email, authority_rank)
  values (new.id, new.email, 0)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_operator on auth.users;
create trigger on_auth_user_created_operator
  after insert on auth.users
  for each row execute function public.handle_new_operator_profile();
