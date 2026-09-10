-- CUBIQ METERS - SUPABASE SETUP
-- Jalankan keseluruhan script ini dalam Supabase > SQL Editor > New query > Run.

create extension if not exists pgcrypto;

create table if not exists public.meters (
  id uuid primary key default gen_random_uuid(),
  meter_no text not null unique,
  address text not null,
  latitude double precision not null,
  longitude double precision not null,
  status text not null default 'Active' check (status in ('Active','No Data','Closed')),
  remark text not null default '',
  photos text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists trg_meters_updated_at on public.meters;
create trigger trg_meters_updated_at before update on public.meters
for each row execute function public.set_updated_at();

alter table public.meters enable row level security;
alter table public.admins enable row level security;

drop policy if exists "Public can read meters" on public.meters;
create policy "Public can read meters" on public.meters
for select to anon, authenticated using (true);

drop policy if exists "Admins can insert meters" on public.meters;
create policy "Admins can insert meters" on public.meters
for insert to authenticated with check (
  exists (select 1 from public.admins a where a.user_id = (select auth.uid()))
);

drop policy if exists "Admins can update meters" on public.meters;
create policy "Admins can update meters" on public.meters
for update to authenticated using (
  exists (select 1 from public.admins a where a.user_id = (select auth.uid()))
) with check (
  exists (select 1 from public.admins a where a.user_id = (select auth.uid()))
);

drop policy if exists "Admins can delete meters" on public.meters;
create policy "Admins can delete meters" on public.meters
for delete to authenticated using (
  exists (select 1 from public.admins a where a.user_id = (select auth.uid()))
);

drop policy if exists "User can read own admin row" on public.admins;
create policy "User can read own admin row" on public.admins
for select to authenticated using (user_id = (select auth.uid()));

grant select on public.meters to anon, authenticated;
grant insert, update, delete on public.meters to authenticated;
grant select on public.admins to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('meter-photos','meter-photos',true,10485760,array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do update set public=true;

drop policy if exists "Admins can view storage metadata" on storage.objects;
create policy "Admins can view storage metadata" on storage.objects
for select to authenticated using (
  bucket_id='meter-photos' and exists (select 1 from public.admins a where a.user_id=(select auth.uid()))
);

drop policy if exists "Admins can upload meter photos" on storage.objects;
create policy "Admins can upload meter photos" on storage.objects
for insert to authenticated with check (
  bucket_id='meter-photos' and exists (select 1 from public.admins a where a.user_id=(select auth.uid()))
);

drop policy if exists "Admins can update meter photos" on storage.objects;
create policy "Admins can update meter photos" on storage.objects
for update to authenticated using (
  bucket_id='meter-photos' and exists (select 1 from public.admins a where a.user_id=(select auth.uid()))
) with check (
  bucket_id='meter-photos' and exists (select 1 from public.admins a where a.user_id=(select auth.uid()))
);

drop policy if exists "Admins can delete meter photos" on storage.objects;
create policy "Admins can delete meter photos" on storage.objects
for delete to authenticated using (
  bucket_id='meter-photos' and exists (select 1 from public.admins a where a.user_id=(select auth.uid()))
);

-- SELEPAS buat user admin di Authentication > Users, copy User UID dan jalankan baris ini secara berasingan:
-- insert into public.admins(user_id) values ('PASTE-USER-UID-DI-SINI');
