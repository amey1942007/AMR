-- 08: link allowlist row to an auth user only once the email is confirmed.
-- Invited users are inserted unconfirmed and confirm later (UPDATE), so the trigger also fires on UPDATE.
create or replace function private.link_allowlist_on_user_created()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.email_confirmed_at is not null and new.email is not null then
    update public.permitted_operators set user_id = new.id, updated_at = now()
     where email = lower(new.email) and user_id is null;
  end if;
  return new;
end $$;
revoke execute on function private.link_allowlist_on_user_created() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_link_allowlist on auth.users;
create trigger on_auth_user_created_link_allowlist
  after insert or update of email_confirmed_at, email on auth.users
  for each row execute function private.link_allowlist_on_user_created();
