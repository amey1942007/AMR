-- 09: send_command per-sender rate limit (30 non-estop commands / 10 s), 2 KB payload cap,
-- and bot_commands retention (rows older than N days from past epochs only).
create index if not exists bot_commands_sender_created on public.bot_commands (sender, created_at desc);
create index if not exists bot_commands_created on public.bot_commands (created_at);

create or replace function private.purge_bot_commands(p_days integer default 30)
returns bigint language plpgsql security definer set search_path = '' as $$
declare n bigint;
begin
  delete from public.bot_commands bc
   where bc.created_at < now() - make_interval(days => greatest(p_days, 1))
     and bc.epoch < coalesce((select c.epoch from public.bot_control c where c.bot_id = bc.bot_id), 0);
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function private.purge_bot_commands(integer) from public, anon, authenticated;

create or replace function public.send_command(p_bot text, p_epoch bigint, p_seq bigint, p_cmd jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); c public.bot_control%rowtype; last bigint; ctype text;
begin
  if me is null or not private.is_active_operator(me) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_cmd is null or jsonb_typeof(p_cmd) <> 'object' then raise exception 'bad command'; end if;
  if octet_length(p_cmd::text) > 2048 then raise exception 'command too large' using errcode = '54000'; end if;
  select * into c from public.bot_control where bot_id = p_bot for update;
  if not found then raise exception 'unknown bot'; end if;
  if c.controller is distinct from me or c.lease_expires_at is null or c.lease_expires_at <= now() or c.epoch <> p_epoch then
    raise exception 'not the controller (or stale epoch)' using errcode = '42501';
  end if;
  ctype := p_cmd ->> 'type';
  if ctype is null or ctype not in
     ('estop','nudge','drive','joy','nav_goal','nav_cancel','vision','save_map','run_tool','stop_tool','blacklist','set_rate') then
    raise exception 'unknown command type';
  end if;
  if ctype <> 'estop' and (select count(*) from public.bot_commands
        where sender = me and created_at > now() - interval '10 seconds') >= 30 then
    raise exception 'rate limited' using errcode = '54000';
  end if;
  select coalesce(max(seq), 0) into last from public.bot_commands where bot_id = p_bot and epoch = p_epoch;
  if p_seq is null or p_seq <= last then raise exception 'stale seq'; end if;
  insert into public.bot_commands (bot_id, sender, epoch, seq, cmd) values (p_bot, me, p_epoch, p_seq, p_cmd);
  if random() < 0.01 then perform private.purge_bot_commands(30); end if;
  perform private.notify('bot:' || p_bot || ':cmdq', 'command',
    jsonb_build_object('sender', me, 'epoch', p_epoch, 'seq', p_seq,
                       'ts', (extract(epoch from clock_timestamp()) * 1000)::bigint, 'cmd', p_cmd));
  return jsonb_build_object('ok', true);
end $$;
