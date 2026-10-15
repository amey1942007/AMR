-- Invite-only usernames for /login (no public signup).

create table if not exists public.permitted_operators (
  username text primary key
    check (username = lower(username) and username ~ '^[a-z][a-z0-9_]{1,31}$'),
  display_name text,
  auth_email text not null unique,
  authority_rank smallint not null default 1
    check (authority_rank between 0 and 3),
  user_id uuid references auth.users (id) on delete set null,
  password_set boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.permitted_operators enable row level security;

create or replace function public.operator_login_status(p_username text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  u text := lower(trim(p_username));
  row public.permitted_operators%rowtype;
begin
  if u is null or u = '' then
    return jsonb_build_object('ok', false);
  end if;
  select * into row from public.permitted_operators where username = u;
  if not found then
    return jsonb_build_object('ok', false);
  end if;
  return jsonb_build_object(
    'ok', true,
    'username', row.username,
    'needsPassword', not row.password_set
  );
end;
$$;

revoke all on function public.operator_login_status(text) from public;
grant execute on function public.operator_login_status(text) to anon, authenticated;

insert into public.permitted_operators (username, display_name, auth_email, authority_rank, password_set)
values
  ('amey', 'Amey', 'amey@operators.amrslam.tech', 3, false),
  ('vanshika', 'Vanshika', 'vanshika@operators.amrslam.tech', 1, false),
  ('gautam', 'Gautam', 'gautam@operators.amrslam.tech', 1, false),
  ('lakshya', 'Lakshya', 'lakshya@operators.amrslam.tech', 1, false),
  ('sanidhya', 'Sanidhya', 'sanidhya@operators.amrslam.tech', 1, false),
  ('himanshu', 'Himanshu', 'himanshu@operators.amrslam.tech', 1, false),
  ('ammar', 'Ammar', 'ammar@operators.amrslam.tech', 1, false)
on conflict (username) do update
set display_name = excluded.display_name,
    auth_email = excluded.auth_email,
    authority_rank = excluded.authority_rank,
    updated_at = now();
