-- ============================================================
-- NEWFLIX ULTIMATE 2026 — SAFE DATABASE UPGRADE
-- Run once in Supabase > SQL Editor.
-- This migration is additive and does not remove existing data.
-- ============================================================

begin;

-- 1) Cross-device profile + playback preferences
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists preferred_source text default 'streamvault';
alter table public.profiles add column if not exists subtitle_lang text default 'en';
alter table public.profiles add column if not exists autoplay_preference boolean default true;
alter table public.profiles add column if not exists data_saver boolean default false;
alter table public.profiles add column if not exists accent_color text default 'rose';
alter table public.profiles add column if not exists performance_mode text default 'auto';
alter table public.profiles add column if not exists auto_source boolean default true;

-- Optional validation for the new preferences.
do $$
begin
  -- Recreate this constraint so older NewFlix installs receive the current verified source set safely.
  if exists (select 1 from pg_constraint where conname='profiles_preferred_source_check') then
    alter table public.profiles drop constraint profiles_preferred_source_check;
  end if;
  alter table public.profiles add constraint profiles_preferred_source_check
    check (preferred_source is null or preferred_source in ('streamvault','moviesapi','vidzen','vidscene','vidfast','vidlink'));
  if not exists (select 1 from pg_constraint where conname='profiles_accent_color_check') then
    alter table public.profiles add constraint profiles_accent_color_check
      check (accent_color is null or accent_color in ('rose','purple','cyan','green','amber'));
  end if;
  if not exists (select 1 from pg_constraint where conname='profiles_performance_mode_check') then
    alter table public.profiles add constraint profiles_performance_mode_check
      check (performance_mode is null or performance_mode in ('auto','full','balanced','lite'));
  end if;
end $$;

-- 2) Ensure users can read profiles and update their own profile.
-- These policy names are NewFlix-specific so they do not replace existing policies.
alter table public.profiles enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='newflix_profiles_read') then
    create policy newflix_profiles_read on public.profiles for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='newflix_profiles_update_own') then
    create policy newflix_profiles_update_own on public.profiles for update
      using (auth.uid() = id) with check (auth.uid() = id);
  end if;
end $$;

-- 3) Public avatar bucket (max 2 MB per upload is also enforced client-side).
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('avatars','avatars',true,2097152,array['image/png','image/jpeg','image/webp','image/gif'])
on conflict (id) do update set
  public=excluded.public,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

-- 4) Storage policies: anyone may view avatars; authenticated users may
-- create/update/delete only objects inside their own /<user-id>/ folder.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='newflix_avatar_public_read') then
    create policy newflix_avatar_public_read on storage.objects for select
      using (bucket_id='avatars');
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='newflix_avatar_insert_own') then
    create policy newflix_avatar_insert_own on storage.objects for insert to authenticated
      with check (bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='newflix_avatar_update_own') then
    create policy newflix_avatar_update_own on storage.objects for update to authenticated
      using (bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text)
      with check (bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='newflix_avatar_delete_own') then
    create policy newflix_avatar_delete_own on storage.objects for delete to authenticated
      using (bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
  end if;
end $$;

commit;

-- Nothing else in this update requires new tables.
-- Existing NewFlix tables used by the supplied project remain unchanged:
-- profiles, watchlist, watch_history, friendships, rooms, room_members,
-- room_messages, room_invites, and room_playback.

-- ============================================================
-- ROOM MANAGEMENT UPGRADE
-- Safe owner-only RPC functions for editing and deleting rooms.
-- Re-running this section is safe: CREATE OR REPLACE is idempotent.
-- ============================================================

create or replace function public.newflix_update_room(
  p_room_id uuid,
  p_name text,
  p_visibility text,
  p_tmdb_id bigint default null,
  p_media_type text default null,
  p_media_title text default null,
  p_poster_path text default null,
  p_backdrop_path text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.rooms where id=p_room_id and owner_id=auth.uid()) then
    raise exception 'Only the room owner can edit this room';
  end if;
  if length(trim(coalesce(p_name,''))) < 2 or length(trim(p_name)) > 60 then
    raise exception 'Room name must be 2–60 characters';
  end if;
  if p_visibility not in ('private','friends','public') then
    raise exception 'Invalid room visibility';
  end if;
  if (p_media_type is null) <> (p_tmdb_id is null) then
    raise exception 'Media type and TMDB ID must be supplied together';
  end if;
  if p_media_type is not null and p_media_type not in ('movie','tv') then
    raise exception 'Invalid media type';
  end if;

  -- Cast through the rooms row type so this works whether visibility/media_type
  -- are PostgreSQL enums (for example room_visibility) or plain text columns.
  update public.rooms
  set name = trim(p_name),
      visibility = (jsonb_populate_record(null::public.rooms, jsonb_build_object('visibility', p_visibility))).visibility,
      tmdb_id = p_tmdb_id,
      media_type = case
        when p_media_type is null then null
        else (jsonb_populate_record(null::public.rooms, jsonb_build_object('media_type', p_media_type))).media_type
      end,
      media_title = p_media_title,
      poster_path = p_poster_path,
      backdrop_path = p_backdrop_path
  where id = p_room_id and owner_id = auth.uid();
end;
$$;

revoke all on function public.newflix_update_room(uuid,text,text,bigint,text,text,text,text) from public;
grant execute on function public.newflix_update_room(uuid,text,text,bigint,text,text,text,text) to authenticated;

create or replace function public.newflix_delete_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.rooms where id=p_room_id and owner_id=auth.uid()) then
    raise exception 'Only the room owner can remove this room';
  end if;

  -- Explicit cleanup keeps this working even if your original foreign keys
  -- were created without ON DELETE CASCADE.
  delete from public.room_messages where room_id=p_room_id;
  delete from public.room_invites where room_id=p_room_id;
  delete from public.room_playback where room_id=p_room_id;
  delete from public.room_members where room_id=p_room_id;
  delete from public.rooms where id=p_room_id and owner_id=auth.uid();
end;
$$;

revoke all on function public.newflix_delete_room(uuid) from public;
grant execute on function public.newflix_delete_room(uuid) to authenticated;

-- ============================================================
-- USERNAME + EMAIL SIGN-IN SUPPORT
-- Stores the auth email beside the public username so the static
-- client can resolve username logins before calling Supabase Auth.
-- ============================================================
alter table public.profiles add column if not exists email text;
create unique index if not exists newflix_profiles_username_unique
  on public.profiles (lower(username)) where username is not null and username <> '';

create or replace function public.newflix_sync_auth_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, username, display_name)
  values (
    new.id,
    new.email,
    nullif(lower(new.raw_user_meta_data->>'username'), ''),
    coalesce(nullif(new.raw_user_meta_data->>'full_name',''), nullif(new.raw_user_meta_data->>'name',''))
  )
  on conflict (id) do update set
    email = excluded.email,
    username = coalesce(public.profiles.username, excluded.username),
    display_name = coalesce(public.profiles.display_name, excluded.display_name);
  return new;
end;
$$;

drop trigger if exists newflix_sync_auth_profile on auth.users;
create trigger newflix_sync_auth_profile
  after insert or update of email, raw_user_meta_data on auth.users
  for each row execute function public.newflix_sync_auth_profile();

-- NOTE: The existing NewFlix profile-read policy is public. This migration
-- follows that existing model; review profile RLS before using this project
-- for sensitive/private user data.


-- ============================================================
-- SECURE USERNAME SIGN-IN INDEX
-- Username -> user ID mapping is private. Only the Edge Function
-- service-role client can read it; browser clients cannot.
-- ============================================================
create table if not exists public.newflix_username_index (
  username text primary key,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.newflix_username_index enable row level security;
revoke all on table public.newflix_username_index from anon, authenticated;

create or replace function public.newflix_sync_username_index()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_username text;
begin
  v_username := lower(trim(coalesce(new.raw_user_meta_data->>'username','')));
  if v_username = '' then
    delete from public.newflix_username_index where user_id = new.id;
  else
    if v_username !~ '^[a-z0-9_]{3,24}$' then raise exception 'Username must be 3–24 characters (letters, numbers or underscores)'; end if;
    insert into public.newflix_username_index(username,user_id) values(v_username,new.id)
    on conflict(user_id) do update set username=excluded.username;
  end if;
  return new;
end;
$$;
drop trigger if exists newflix_sync_username_index on auth.users;
create trigger newflix_sync_username_index after insert or update of raw_user_meta_data on auth.users
for each row execute function public.newflix_sync_username_index();

-- Backfill usernames on accounts created before this migration.
insert into public.newflix_username_index(username,user_id)
select lower(trim(p.username)), p.id from public.profiles p join auth.users u on u.id=p.id
where p.username is not null and lower(trim(p.username)) ~ '^[a-z0-9_]{3,24}$'
on conflict do nothing;


-- ============================================================
-- DISPLAY NAME SIGN-IN SUPPORT
-- Existing profiles get a display name from Auth metadata where missing.
-- Display names are intentionally NOT unique; the login function reports
-- ambiguity and asks users to use their unique username or email instead.
-- ============================================================
alter table public.profiles add column if not exists display_name text;

update public.profiles p
set display_name = coalesce(
  nullif(trim(p.display_name), ''),
  nullif(trim(u.raw_user_meta_data->>'display_name'), ''),
  nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
  nullif(trim(u.raw_user_meta_data->>'name'), '')
)
from auth.users u
where u.id = p.id
  and (p.display_name is null or trim(p.display_name) = '');

create index if not exists newflix_profiles_display_name_lookup
  on public.profiles (lower(trim(display_name)))
  where display_name is not null and trim(display_name) <> '';
