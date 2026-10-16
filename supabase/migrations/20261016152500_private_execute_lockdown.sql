-- 07: private schema functions: only the 4 policy helpers stay executable by `authenticated`.
-- Everything else in private is called only by SECURITY DEFINER public RPCs (run as owner) or triggers.
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_active_operator(uuid), private.is_bridge_for(text),
  private.is_controller(text), private.topic_bot() to authenticated;
alter default privileges in schema private revoke execute on functions from public, anon, authenticated;
