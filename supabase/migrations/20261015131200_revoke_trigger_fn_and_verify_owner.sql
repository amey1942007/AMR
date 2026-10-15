-- Trigger functions should not be callable via PostgREST.
revoke all on function public.handle_new_operator_profile() from public, anon, authenticated;

insert into public.operator_profiles (user_id, email, authority_rank)
select u.id, u.email, 3
from auth.users u
where lower(u.email) = 'amey@amrslam.tech'
on conflict (user_id) do update
set authority_rank = 3,
    email = excluded.email,
    updated_at = now();
