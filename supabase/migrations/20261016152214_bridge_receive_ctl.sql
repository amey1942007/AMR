-- Migration 06 (live version 20261016152214): bridge may also receive bot:<id>:ctl.
-- Only the topic regex changes (cmd|cmdq -> cmd|cmdq|ctl). Bridge identity check unchanged.
alter policy amr_bridge_receive on realtime.messages
  using ((extension = 'broadcast'::text) AND (realtime.topic() ~ '^bot:(amr4|hardware-bot):(cmd|cmdq|ctl)$'::text) AND private.is_bridge_for(private.topic_bot()));
