-- 04_bot_realtime_private_policies: RLS on realtime.messages for the NEW private topics only.
-- Old public channel 'amr-bot-<id>' is not touched (these policies match only bot:<id>:* and user:<uid>:notify).
-- Topics: bot:<id>:status (bridge sends, operators receive), bot:<id>:ctl (DB sends, operators receive),
--         bot:<id>:cmd (current controller sends, bridge receives), bot:<id>:cmdq (DB sends, bridge receives),
--         user:<uid>:notify (DB sends, that user receives).
create policy amr_receive_state on realtime.messages for select to authenticated using (
  realtime.messages.extension = 'broadcast'
  and realtime.topic() ~ '^bot:(amr4|hardware-bot):(status|ctl)$'
  and private.is_active_operator(auth.uid()));
create policy amr_receive_notify on realtime.messages for select to authenticated using (
  realtime.messages.extension = 'broadcast'
  and realtime.topic() = 'user:' || auth.uid()::text || ':notify');
create policy amr_send_cmd on realtime.messages for insert to authenticated with check (
  realtime.messages.extension = 'broadcast'
  and realtime.topic() ~ '^bot:(amr4|hardware-bot):cmd$'
  and private.is_controller(private.topic_bot()));
create policy amr_bridge_receive on realtime.messages for select to authenticated using (
  realtime.messages.extension = 'broadcast'
  and realtime.topic() ~ '^bot:(amr4|hardware-bot):(cmd|cmdq)$'
  and private.is_bridge_for(private.topic_bot()));
create policy amr_bridge_send on realtime.messages for insert to authenticated with check (
  realtime.messages.extension = 'broadcast'
  and realtime.topic() ~ '^bot:(amr4|hardware-bot):status$'
  and private.is_bridge_for(private.topic_bot()));
