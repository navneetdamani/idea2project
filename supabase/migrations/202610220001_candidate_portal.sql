-- Apply once in a NEW Supabase project, as the project database administrator.
-- This migration never stores CVs in a public bucket or public repository.
begin;

create table public.candidate_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (length(trim(full_name)) between 1 and 120),
  headline text not null default '' check (length(headline) <= 200),
  location text not null default '' check (length(location) <= 120),
  phone text not null default '' check (length(phone) <= 40),
  experience_years numeric(3,1) not null check (experience_years between 0 and 80),
  skills text[] not null check (cardinality(skills) between 1 and 30 and array_position(skills,null) is null and length(array_to_string(skills,',')) <= 1829),
  summary text not null default '' check (length(summary) <= 4000),
  consent_version text not null check (consent_version = '2026-10-v1'),
  consented_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Administrators explicitly add recruiter UUIDs here; candidates cannot add themselves.
create table public.recruiters (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.candidate_profiles enable row level security;
alter table public.recruiters enable row level security;
revoke all on public.candidate_profiles from anon, authenticated;
revoke all on public.recruiters from anon, authenticated;
grant select, insert, update, delete on public.candidate_profiles to authenticated;

create function public.is_recruiter()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.recruiters where user_id = (select auth.uid())); $$;
revoke all on function public.is_recruiter() from public, anon;
grant execute on function public.is_recruiter() to authenticated;

create function public.candidate_profile_timestamps()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  if TG_OP = 'INSERT' then
    new.created_at := now();
    new.consented_at := now();
  else
    new.created_at := old.created_at;
    new.consented_at := old.consented_at;
  end if;
  return new;
end; $$;
create trigger candidate_profile_timestamps before insert or update on public.candidate_profiles
for each row execute function public.candidate_profile_timestamps();

create policy "Candidates and authorized recruiters read profiles"
on public.candidate_profiles for select to authenticated
using (id = (select auth.uid()) or (select public.is_recruiter()));
create policy "Candidates create their own profile"
on public.candidate_profiles for insert to authenticated
with check (id = (select auth.uid()));
create policy "Candidates update only their own profile"
on public.candidate_profiles for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "Candidates delete only their own profile"
on public.candidate_profiles for delete to authenticated using (id = (select auth.uid()));

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('candidate-cvs','candidate-cvs',false,5242880,array['application/pdf']);

-- Each account has exactly one accepted object key. Upsert replaces its latest CV.
-- Both size and MIME type are enforced by Storage, not just by browser validation.
create policy "Candidates and authorized recruiters read private CVs"
on storage.objects for select to authenticated
using (bucket_id = 'candidate-cvs' and
  (name = (select auth.uid())::text || '/latest.pdf' or (select public.is_recruiter())));
create policy "Candidates upload only their own latest CV"
on storage.objects for insert to authenticated
with check (bucket_id = 'candidate-cvs' and name = (select auth.uid())::text || '/latest.pdf'
  and exists (select 1 from public.candidate_profiles where id = (select auth.uid()) and consent_version = '2026-10-v1'));
create policy "Candidates replace only their own latest CV"
on storage.objects for update to authenticated
using (bucket_id = 'candidate-cvs' and name = (select auth.uid())::text || '/latest.pdf')
with check (bucket_id = 'candidate-cvs' and name = (select auth.uid())::text || '/latest.pdf'
  and exists (select 1 from public.candidate_profiles where id = (select auth.uid()) and consent_version = '2026-10-v1'));
create policy "Candidates remove only their own latest CV"
on storage.objects for delete to authenticated
using (bucket_id = 'candidate-cvs' and name = (select auth.uid())::text || '/latest.pdf');

commit;
