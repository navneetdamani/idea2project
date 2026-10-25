begin;
create table public.published_jobs (
  id text primary key,
  title text not null,
  is_open boolean not null default true
);
insert into public.published_jobs (id,title) values
('I2P-20261023-01','ServiceNow HRSD Consultant / Developer'),
('I2P-20261023-02','ServiceNow HRSD Senior Consultant'),
('I2P-20261023-03','UKG WFM Senior Consultant — Technical'),
('I2P-20261023-04','UKG WFM Senior Consultant — Functional'),
('I2P-20261023-05','SAP FSCM Consultant — Collections, Disputes & Credit Management');
alter table public.published_jobs enable row level security;
revoke all on public.published_jobs from anon,authenticated;
grant select on public.published_jobs to anon,authenticated;
create policy "Read open jobs" on public.published_jobs for select to anon,authenticated using (is_open);

create table public.job_applications (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidate_profiles(id) on delete cascade,
  job_id text not null references public.published_jobs(id),
  availability_days integer not null check (availability_days between 0 and 365),
  statement text not null check (length(trim(statement)) between 20 and 4000),
  consent_version text not null check (consent_version = '2026-10-app-v1'),
  submitted_at timestamptz not null default now(),
  status text not null default 'submitted' check (status in ('submitted','in_review','closed')),
  unique(candidate_id,job_id)
);
alter table public.job_applications enable row level security;
revoke all on public.job_applications from anon,authenticated;
grant select on public.job_applications to authenticated;
grant insert(candidate_id,job_id,availability_days,statement,consent_version) on public.job_applications to authenticated;
create policy "Read own or recruiter applications" on public.job_applications for select to authenticated
using (candidate_id = (select auth.uid()) or (select public.is_recruiter()));
create policy "Submit own application with profile and CV" on public.job_applications for insert to authenticated
with check (
  candidate_id = (select auth.uid())
  and exists(select 1 from public.published_jobs j where j.id=job_id and j.is_open)
  and exists(select 1 from public.candidate_profiles p where p.id=(select auth.uid()))
  and exists(select 1 from storage.objects o where o.bucket_id='candidate-cvs' and o.name=(select auth.uid())::text || '/latest.pdf')
);
commit;
