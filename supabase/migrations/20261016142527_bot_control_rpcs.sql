-- 03_bot_control_rpcs: join / heartbeat / request / give-keep / cancel / leave / release / send_command.
-- All SECURITY DEFINER with fixed search_path; caller identity = auth.uid(); no ranks.
-- Numbers: lease 15 s (heartbeat every 5 s), request window 10 s, cooldown 30 s after denied/expired.

create or replace function private.notify(p_topic text, p_event text, p_payload jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform realtime.send(p_payload, p_event, p_topic, true);
exception when others then null;   -- a Realtime hiccup must never break a control RPC
end $$;

create or replace function private.display_name(uid uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(o.display_name, split_part(o.email, '@', 1), o.username)
    from public.permitted_operators o where o.user_id = uid limit 1;
$$;

-- change controller; caller holds the bot_control row lock
create or replace function private.take_control(p_bot text, p_uid uuid) returns bigint
language plpgsql security definer set search_path = '' as $$
declare old uuid; e bigint;
begin
  select controller into old from public.bot_control where bot_id = p_bot;
  update public.bot_control
     set controller = p_uid, epoch = epoch + 1,
         lease_expires_at = now() + interval '15 seconds', heartbeat_at = now(), updated_at = now()
   where bot_id = p_bot returning epoch into e;
  insert into public.bot_control_tokens (bot_id, epoch, token) values (p_bot, e, gen_random_uuid())
    on conflict (bot_id) do update set epoch = excluded.epoch, token = excluded.token;
  perform private.notify('bot:' || p_bot || ':ctl', 'control',
    jsonb_build_object('bot_id', p_bot, 'controller', p_uid, 'controller_name', private.display_name(p_uid), 'epoch', e));
  if old is not null and old <> p_uid then
    perform private.notify('user:' || old || ':notify', 'control_lost',
      jsonb_build_object('bot_id', p_bot, 'epoch', e, 'new_controller_name', private.display_name(p_uid)));
  end if;
  perform private.notify('user:' || p_uid || ':notify', 'control_gained', jsonb_build_object('bot_id', p_bot, 'epoch', e));
  return e;
end $$;

-- controller leaves/releases; oldest live pending request (requester still present) is granted
create or replace function private.release(p_bot text) returns void
language plpgsql security definer set search_path = '' as $$
declare nxt public.control_requests%rowtype;
begin
  update public.bot_control set controller = null, lease_expires_at = null, epoch = epoch + 1, updated_at = now()
   where bot_id = p_bot;
  delete from public.bot_control_tokens where bot_id = p_bot;
  perform private.notify('bot:' || p_bot || ':ctl', 'control',
    jsonb_build_object('bot_id', p_bot, 'controller', null, 'controller_name', null,
                       'epoch', (select epoch from public.bot_control where bot_id = p_bot)));
  select r.* into nxt from public.control_requests r
   where r.bot_id = p_bot and r.status = 'pending' and r.expires_at > now()
     and exists (select 1 from public.bot_sessions s where s.bot_id = r.bot_id and s.user_id = r.requester
                  and s.last_seen_at > now() - interval '30 seconds')
     and private.is_active_operator(r.requester)
   order by r.created_at limit 1;
  if found then
    perform private.take_control(p_bot, nxt.requester);
    update public.control_requests set status = 'accepted', resolved_at = now() where id = nxt.id;
    perform private.notify('user:' || nxt.requester || ':notify', 'control_result',
      jsonb_build_object('request_id', nxt.id, 'bot_id', p_bot, 'status', 'accepted'));
  end if;
end $$;

create or replace function private.housekeep(p_bot text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.control_requests set status = 'expired', resolved_at = now()
   where bot_id = p_bot and status = 'pending' and expires_at <= now();
  update public.control_requests r set status = 'cancelled', resolved_at = now()
   where r.bot_id = p_bot and r.status = 'pending'
     and not exists (select 1 from public.bot_sessions s where s.bot_id = r.bot_id and s.user_id = r.requester
                      and s.last_seen_at > now() - interval '30 seconds');
  delete from public.bot_sessions where bot_id = p_bot and last_seen_at < now() - interval '2 minutes';
end $$;

-- the one state machine behind join_bot / bot_heartbeat / request_control
create or replace function private.sync_bot(p_bot text, p_create_request boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  c public.bot_control%rowtype;
  tok uuid; wait int; req jsonb; pending jsonb := '[]'::jsonb; role text; e bigint;
begin
  if me is null or not private.is_active_operator(me) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into c from public.bot_control where bot_id = p_bot for update;
  if not found then raise exception 'unknown bot'; end if;

  insert into public.bot_sessions (bot_id, user_id) values (p_bot, me)
    on conflict (bot_id, user_id) do update set last_seen_at = now();
  perform private.housekeep(p_bot);

  if c.controller is null or c.lease_expires_at is null or c.lease_expires_at <= now() then
    -- free or lease lapsed: take over immediately (first joiner becomes controller)
    e := private.take_control(p_bot, me);
    update public.control_requests set status = 'accepted', resolved_at = now()
     where bot_id = p_bot and requester = me and status = 'pending';
    role := 'controller';
  elsif c.controller = me then
    update public.bot_control set lease_expires_at = now() + interval '15 seconds', heartbeat_at = now()
     where bot_id = p_bot;
    e := c.epoch; role := 'controller';
  else
    e := c.epoch; role := 'viewer';
    select ceil(extract(epoch from (r.resolved_at + interval '30 seconds' - now())))::int into wait
      from public.control_requests r
     where r.bot_id = p_bot and r.requester = me and r.status in ('denied','expired')
       and r.resolved_at > now() - interval '30 seconds'
     order by r.resolved_at desc limit 1;
    if p_create_request and wait is null
       and not exists (select 1 from public.control_requests where bot_id = p_bot and requester = me and status = 'pending') then
      insert into public.control_requests (bot_id, requester) values (p_bot, me);
      perform private.notify('user:' || c.controller || ':notify', 'control_request',
        jsonb_build_object('bot_id', p_bot, 'requester', me, 'requester_name', private.display_name(me),
          'request_id', (select id from public.control_requests where bot_id = p_bot and requester = me and status = 'pending'),
          'expires_at', (select expires_at from public.control_requests where bot_id = p_bot and requester = me and status = 'pending')));
    end if;
  end if;

  select jsonb_build_object('id', r.id, 'status', r.status, 'expires_at', r.expires_at, 'resolved_at', r.resolved_at)
    into req from public.control_requests r
   where r.bot_id = p_bot and r.requester = me and r.created_at > now() - interval '2 minutes'
   order by r.created_at desc limit 1;

  if role = 'controller' then
    select token into tok from public.bot_control_tokens where bot_id = p_bot;
    select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'requester', r.requester,
             'name', private.display_name(r.requester), 'expires_at', r.expires_at) order by r.created_at), '[]'::jsonb)
      into pending from public.control_requests r where r.bot_id = p_bot and r.status = 'pending';
  end if;

  select * into c from public.bot_control where bot_id = p_bot;
  return jsonb_build_object('role', role, 'bot_id', p_bot, 'epoch', e,
    'controller', c.controller, 'controller_name', private.display_name(c.controller),
    'lease_expires_at', c.lease_expires_at,
    'token', case when role = 'controller' then tok end,
    'pending_requests', pending, 'my_request', req, 'retry_after', wait);
end $$;

create or replace function public.join_bot(p_bot text) returns jsonb
language sql security definer set search_path = '' as $$ select private.sync_bot(p_bot, true); $$;
create or replace function public.request_control(p_bot text) returns jsonb
language sql security definer set search_path = '' as $$ select private.sync_bot(p_bot, true); $$;
create or replace function public.bot_heartbeat(p_bot text) returns jsonb
language sql security definer set search_path = '' as $$ select private.sync_bot(p_bot, false); $$;

-- Give (p_accept=true) or Keep (false). Only the live controller; only while the request is pending and unexpired.
create or replace function public.respond_control_request(p_id uuid, p_accept boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); r public.control_requests%rowtype; c public.bot_control%rowtype;
begin
  if me is null or not private.is_active_operator(me) then raise exception 'not allowed' using errcode = '42501'; end if;
  select bot_id into r.bot_id from public.control_requests where id = p_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  select * into c from public.bot_control where bot_id = r.bot_id for update;
  select * into r from public.control_requests where id = p_id for update;
  if c.controller is distinct from me or c.lease_expires_at is null or c.lease_expires_at <= now() then
    return jsonb_build_object('ok', false, 'reason', 'not_controller');
  end if;
  if r.status <> 'pending' then return jsonb_build_object('ok', false, 'reason', r.status); end if;
  if r.expires_at <= now() then
    update public.control_requests set status = 'expired', resolved_at = now() where id = p_id;
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;
  if p_accept then
    if not private.is_active_operator(r.requester) then
      update public.control_requests set status = 'cancelled', resolved_at = now() where id = p_id;
      return jsonb_build_object('ok', false, 'reason', 'requester_inactive');
    end if;
    perform private.take_control(r.bot_id, r.requester);
    update public.control_requests set status = 'accepted', resolved_at = now() where id = p_id;
  else
    update public.control_requests set status = 'denied', resolved_at = now() where id = p_id;
  end if;
  perform private.notify('user:' || r.requester || ':notify', 'control_result',
    jsonb_build_object('request_id', p_id, 'bot_id', r.bot_id, 'status', case when p_accept then 'accepted' else 'denied' end));
  return jsonb_build_object('ok', true, 'status', case when p_accept then 'accepted' else 'denied' end);
end $$;

create or replace function public.cancel_control_request(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  update public.control_requests set status = 'cancelled', resolved_at = now()
   where id = p_id and requester = auth.uid() and status = 'pending';
  get diagnostics n = row_count;
  return jsonb_build_object('ok', n = 1);
end $$;

create or replace function private.leave(p_bot text, p_drop_session boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); c public.bot_control%rowtype;
begin
  if me is null then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into c from public.bot_control where bot_id = p_bot for update;
  if not found then raise exception 'unknown bot'; end if;
  update public.control_requests set status = 'cancelled', resolved_at = now()
   where bot_id = p_bot and requester = me and status = 'pending';
  if p_drop_session then delete from public.bot_sessions where bot_id = p_bot and user_id = me; end if;
  if c.controller = me then perform private.release(p_bot); end if;
  return jsonb_build_object('ok', true);
end $$;
create or replace function public.leave_bot(p_bot text) returns jsonb
language sql security definer set search_path = '' as $$ select private.leave(p_bot, true); $$;
create or replace function public.release_control(p_bot text) returns jsonb
language sql security definer set search_path = '' as $$ select private.leave(p_bot, false); $$;

-- Discrete commands: stamps the sender from the JWT, checks lease + epoch + seq, audits, forwards on bot:<id>:cmdq.
create or replace function public.send_command(p_bot text, p_epoch bigint, p_seq bigint, p_cmd jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); c public.bot_control%rowtype; last bigint;
begin
  if me is null or not private.is_active_operator(me) then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into c from public.bot_control where bot_id = p_bot for update;
  if not found then raise exception 'unknown bot'; end if;
  if c.controller is distinct from me or c.lease_expires_at is null or c.lease_expires_at <= now() or c.epoch <> p_epoch then
    raise exception 'not the controller (or stale epoch)' using errcode = '42501';
  end if;
  if (p_cmd ->> 'type') is null or (p_cmd ->> 'type') not in
     ('estop','nudge','drive','joy','nav_goal','nav_cancel','vision','save_map','run_tool','stop_tool','blacklist','set_rate') then
    raise exception 'unknown command type';
  end if;
  select coalesce(max(seq), 0) into last from public.bot_commands where bot_id = p_bot and epoch = p_epoch;
  if p_seq is null or p_seq <= last then raise exception 'stale seq'; end if;
  insert into public.bot_commands (bot_id, sender, epoch, seq, cmd) values (p_bot, me, p_epoch, p_seq, p_cmd);
  perform private.notify('bot:' || p_bot || ':cmdq', 'command',
    jsonb_build_object('sender', me, 'epoch', p_epoch, 'seq', p_seq,
                       'ts', (extract(epoch from clock_timestamp()) * 1000)::bigint, 'cmd', p_cmd));
  return jsonb_build_object('ok', true);
end $$;

-- EXECUTE: signed-in only (revoke the default PUBLIC/anon grants)
revoke all on function public.join_bot(text), public.request_control(text), public.bot_heartbeat(text),
  public.respond_control_request(uuid, boolean), public.cancel_control_request(uuid),
  public.leave_bot(text), public.release_control(text), public.send_command(text, bigint, bigint, jsonb)
  from public, anon;
grant execute on function public.join_bot(text), public.request_control(text), public.bot_heartbeat(text),
  public.respond_control_request(uuid, boolean), public.cancel_control_request(uuid),
  public.leave_bot(text), public.release_control(text), public.send_command(text, bigint, bigint, jsonb)
  to authenticated;
revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;
