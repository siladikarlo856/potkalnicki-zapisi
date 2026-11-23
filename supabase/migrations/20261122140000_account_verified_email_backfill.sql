update public.account_profiles as profile
set email = lower(btrim(account.email))
from auth.users as account
where profile.id = account.id
  and profile.email is null
  and char_length(btrim(account.email)) between 3 and 320
  and exists (
    select 1
    from auth.identities as identity
    where identity.user_id = account.id
      and identity.provider = 'google'
      and identity.identity_data -> 'email_verified' = 'true'::jsonb
      and jsonb_typeof(identity.identity_data -> 'email') = 'string'
      and lower(btrim(identity.identity_data ->> 'email')) = lower(btrim(account.email))
  );
