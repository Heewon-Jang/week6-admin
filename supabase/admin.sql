-- Week 6: admin area.
-- Run this in Supabase Dashboard -> SQL Editor. Safe to run more than once.

-- 1. The superadmin flag ----------------------------------------------------
alter table public.profiles
  add column if not exists is_superadmin boolean not null default false;

-- Users may still edit their own name/avatar, but never their own flag:
-- replace the table-wide insert/update grants with column-level ones.
revoke insert, update on public.profiles from anon, authenticated;
grant insert (id, email, first_name, last_name, avatar_url, updated_at)
  on public.profiles to authenticated;
-- id is included because the main app saves names with upsert, which sets
-- every column it sends; RLS still limits each user to their own row.
grant update (id, email, first_name, last_name, avatar_url, updated_at)
  on public.profiles to authenticated;

-- 2. Helper used by the policies below ----------------------------------------
-- security definer so it can read profiles without tripping profiles' own RLS.
create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select is_superadmin from public.profiles where id = (select auth.uid())),
    false
  );
$$;

-- 3. Extra powers for superadmins ---------------------------------------------
-- READ every profile.
drop policy if exists "Superadmins read all profiles" on public.profiles;
create policy "Superadmins read all profiles"
  on public.profiles for select to authenticated
  using ((select public.is_superadmin()));

-- CREATE / UPDATE / DELETE AI-generated media.
drop policy if exists "Superadmins update images" on public.images;
create policy "Superadmins update images"
  on public.images for update to authenticated
  using ((select public.is_superadmin()))
  with check ((select public.is_superadmin()));

drop policy if exists "Superadmins delete images" on public.images;
create policy "Superadmins delete images"
  on public.images for delete to authenticated
  using ((select public.is_superadmin()));

drop policy if exists "Superadmins add captions" on public.captions;
create policy "Superadmins add captions"
  on public.captions for insert to authenticated
  with check ((select public.is_superadmin()));

drop policy if exists "Superadmins update captions" on public.captions;
create policy "Superadmins update captions"
  on public.captions for update to authenticated
  using ((select public.is_superadmin()))
  with check ((select public.is_superadmin()));

drop policy if exists "Superadmins delete captions" on public.captions;
create policy "Superadmins delete captions"
  on public.captions for delete to authenticated
  using ((select public.is_superadmin()));

drop policy if exists "Superadmins delete image files" on storage.objects;
create policy "Superadmins delete image files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'images' and (select public.is_superadmin()));

-- Votes and battles are already readable by every logged-in user.

notify pgrst, 'reload schema';

-- 4. Avoid locking yourself out --------------------------------------------
-- The admin area requires is_superadmin = true, and no user can set it from
-- the app. The SQL Editor runs as the database owner, so set it here.
-- Replace the email with yours, then run:
--
-- update public.profiles set is_superadmin = true where email = 'you@columbia.edu';

-- Check
select email, is_superadmin from public.profiles order by is_superadmin desc, email;
