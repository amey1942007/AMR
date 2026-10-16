-- 02_bot_control_tables: lease, tokens, sessions, handoff requests, command audit. Additive.
create table public.bot_control (
  bot_id text primary key check (bot_id in ('amr4','hardware-bot')),
  controller uuid references auth.users(id) on delete set null,
  epoch bigint not null default 0,
  lease_expires_at timestamptz,
  heartbeat_at timestamptz,
  updated_at timestamptz not null default now()
);
insert into public.bot_control (bot_id) values ('amr4'), ('hardware-bot');

create table public.bot_control_tokens (
  bot_id text primary key references public.bot_control(bot_id) on delete cascade,
  epoch bigint not null,
  token uuid not null default gen_random_uuid()
);
create table public.bot_sessions (
  bot_id text not null references public.bot_control(bot_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  primary key (bot_id, user_id)
);
create table public.control_requests (
  id uuid primary key default gen_random_uuid(),
  bot_id text not null references public.bot_control(bot_id) on delete cascade,
  requester uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','denied','expired','cancelled')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '10 seconds',
  resolved_at timestamptz
);
create unique index control_requests_one_pending on public.control_requests (bot_id, requester) where status = 'pending';
create index control_requests_bot_status on public.control_requests (bot_id, status, created_at);
create table public.bot_commands (
  id uuid primary key default gen_random_uuid(),
  bot_id text not null references public.bot_control(bot_id) on delete cascade,
  sender uuid not null,
  epoch bigint not null,
  seq bigint not null,
  cmd jsonb not null check (pg_column_size(cmd) <= 4096),
  created_at timestamptz not null default now()
);
create index bot_commands_bot_epoch_seq on public.bot_commands (bot_id, epoch, seq desc);

alter table public.bot_control        enable row level security;
alter table public.bot_control_tokens enable row level security;
alter table public.bot_sessions       enable row level security;
alter table public.control_requests   enable row level security;
alter table public.bot_commands       enable row level security;

-- minimal grants on NEW tables only (reads for signed-in; all writes go through RPCs)
revoke all on public.bot_control, public.bot_control_tokens, public.bot_sessions,
              public.control_requests, public.bot_commands from anon, authenticated, public;
grant select on public.bot_control, public.bot_control_tokens, public.bot_sessions,
                public.control_requests, public.bot_commands to authenticated;

create or replace function private.is_controller(bot text) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_active_operator(auth.uid())
     and exists (select 1 from public.bot_control c
                  where c.bot_id = bot and c.controller = auth.uid() and c.lease_expires_at > now());
$$;
revoke all on function private.is_controller(text) from public, anon;
grant execute on function private.is_controller(text) to authenticated;

create policy ctl_select  on public.bot_control        for select to authenticated
  using (private.is_active_operator(auth.uid()) or private.is_bridge_for(bot_id));
create policy tok_select  on public.bot_control_tokens for select to authenticated
  using (private.is_bridge_for(bot_id) or private.is_controller(bot_id));
create policy sess_select on public.bot_sessions       for select to authenticated
  using (private.is_active_operator(auth.uid()));
create policy req_select  on public.control_requests   for select to authenticated
  using (requester = auth.uid() or private.is_controller(bot_id) or private.is_bridge_for(bot_id));
create policy cmd_select  on public.bot_commands       for select to authenticated
  using (sender = auth.uid() or private.is_bridge_for(bot_id));
