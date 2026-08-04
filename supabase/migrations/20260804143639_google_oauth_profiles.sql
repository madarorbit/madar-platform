alter table public.profiles
  add column if not exists auth_provider text not null default 'email',
  add column if not exists google_user_id text,
  add column if not exists oauth_avatar_url text,
  add column if not exists auth_provider_updated_at timestamptz;

comment on column public.profiles.auth_provider is 'Primary sign-in provider last used by the account, such as email or google.';
comment on column public.profiles.google_user_id is 'Google identity subject stored without Google access or refresh tokens.';
comment on column public.profiles.oauth_avatar_url is 'Optional profile image URL supplied by the social identity provider.';

create unique index if not exists profiles_google_user_id_unique
  on public.profiles (google_user_id)
  where google_user_id is not null;

update public.profiles as profile
set
  auth_provider = 'google',
  google_user_id = coalesce(identity.identity_data->>'sub', identity.provider_id, profile.google_user_id),
  oauth_avatar_url = coalesce(identity.identity_data->>'avatar_url', identity.identity_data->>'picture', profile.oauth_avatar_url),
  auth_provider_updated_at = coalesce(profile.auth_provider_updated_at, now())
from auth.identities as identity
where identity.user_id = profile.id
  and identity.provider = 'google';

create or replace function private.handle_new_user_v2()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  selected_provider text := lower(coalesce(new.raw_app_meta_data->>'provider', 'email'));
  selected_account text := case
    when upper(coalesce(new.raw_user_meta_data->>'account_type', 'PERSONAL')) = 'BUSINESS' then 'BUSINESS'
    else 'PERSONAL'
  end;
  google_requires_onboarding boolean := selected_provider = 'google'
    and nullif(new.raw_user_meta_data->>'account_type', '') is null;
  provider_subject text := case
    when selected_provider = 'google' then nullif(coalesce(new.raw_user_meta_data->>'sub', new.raw_user_meta_data->>'provider_id'), '')
    else null
  end;
begin
  insert into public.profiles(
    id,
    email,
    full_name,
    phone,
    email_verified,
    account_type,
    account_type_selected_at,
    account_migration_source,
    reonboarding_required,
    auth_provider,
    google_user_id,
    oauth_avatar_url,
    auth_provider_updated_at
  )
  values(
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    new.phone,
    new.email_confirmed_at is not null,
    selected_account,
    case when google_requires_onboarding then null else now() end,
    case when google_requires_onboarding then 'GOOGLE_OAUTH' else 'V2_REGISTRATION' end,
    google_requires_onboarding,
    case when selected_provider = 'google' then 'google' else 'email' end,
    provider_subject,
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'),
    now()
  )
  on conflict(id) do update set
    email = excluded.email,
    phone = coalesce(excluded.phone, public.profiles.phone),
    email_verified = excluded.email_verified,
    full_name = case
      when nullif(public.profiles.full_name, '') is null then excluded.full_name
      else public.profiles.full_name
    end,
    auth_provider = case
      when excluded.auth_provider = 'google' then 'google'
      else public.profiles.auth_provider
    end,
    google_user_id = coalesce(excluded.google_user_id, public.profiles.google_user_id),
    oauth_avatar_url = coalesce(public.profiles.oauth_avatar_url, excluded.oauth_avatar_url),
    auth_provider_updated_at = now(),
    reonboarding_required = case
      when tg_op = 'INSERT' then excluded.reonboarding_required
      else public.profiles.reonboarding_required
    end;

  if tg_op = 'INSERT' and not google_requires_onboarding then
    perform private.bootstrap_v2_account(new.id, coalesce(new.raw_user_meta_data, '{}'::jsonb));
  end if;

  return new;
end
$function$;
