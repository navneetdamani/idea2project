begin;
alter table public.job_applications add column review_updated_at timestamptz;
-- Return only the caller's own application membership without a policy-to-policy cycle.
create function public.has_applied_job(p_job text) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.job_applications where job_id=p_job and candidate_id=(select auth.uid()));
$$;
revoke all on function public.has_applied_job(text) from public,anon;
grant execute on function public.has_applied_job(text) to authenticated;
create policy "Read applied or recruiter job titles" on public.published_jobs for select to authenticated
using ((select public.is_recruiter()) or public.has_applied_job(id));

create table public.application_review_events (
  id bigint generated always as identity primary key,
  application_id uuid not null references public.job_applications(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id),
  previous_status text not null,
  status text not null,
  changed_at timestamptz not null default now()
);
alter table public.application_review_events enable row level security;
revoke all on public.application_review_events from public,anon,authenticated;
grant select on public.application_review_events to authenticated;
create policy "Recruiters read review audit" on public.application_review_events for select to authenticated using((select public.is_recruiter()));

create function public.recruiter_job_summary() returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if not public.is_recruiter() then raise exception 'Recruiter access required' using errcode='42501'; end if;
  return (select coalesce(jsonb_agg(to_jsonb(s) order by s.is_open desc,s.id desc),'[]'::jsonb) from (
    select j.id,j.title,j.is_open,count(a.id)::integer as total,
      count(a.id) filter(where a.status='submitted')::integer as submitted,
      count(a.id) filter(where a.status='in_review')::integer as in_review,
      count(a.id) filter(where a.status='closed')::integer as closed
    from public.published_jobs j left join public.job_applications a on a.job_id=j.id group by j.id
  ) s);
end; $$;

create function public.recruiter_job_applicants(p_job text,p_status text default '',p_search text default '',p_limit integer default 50,p_offset integer default 0)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if not public.is_recruiter() then raise exception 'Recruiter access required' using errcode='42501'; end if;
  if p_job is null or p_status is null or p_status not in ('','submitted','in_review','closed') or p_search is null or length(p_search)>120 or p_limit is null or p_limit not between 1 and 100 or p_offset is null or p_offset<0 then
    raise exception 'Invalid applicant filters' using errcode='22023';
  end if;
  return (with filtered as (
    select a.id,a.candidate_id,a.job_id,a.status,a.submitted_at,a.review_updated_at,a.availability_days,a.statement,
      jsonb_build_object('full_name',p.full_name,'headline',p.headline,'location',p.location,'phone',p.phone,'experience_years',p.experience_years,'skills',p.skills,'summary',p.summary) as profile
    from public.job_applications a join public.candidate_profiles p on p.id=a.candidate_id
    where a.job_id=p_job and (p_status='' or a.status=p_status)
      and (trim(p_search)='' or position(lower(trim(p_search)) in lower(concat_ws(' ',p.full_name,p.headline,p.location,array_to_string(p.skills,' '))))>0)
  ), page as (select * from filtered order by submitted_at desc,id limit p_limit offset p_offset)
  select jsonb_build_object('total',(select count(*) from filtered),'items',(select coalesce(jsonb_agg(to_jsonb(page) order by submitted_at desc,id),'[]'::jsonb) from page)));
end; $$;

create function public.set_application_review_status(p_application uuid,p_status text,p_expected text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare changed public.job_applications;
begin
  if not public.is_recruiter() then raise exception 'Recruiter access required' using errcode='42501'; end if;
  if p_status is null or p_status not in ('submitted','in_review','closed') or p_expected is null or p_expected not in ('submitted','in_review','closed') then raise exception 'Invalid status' using errcode='22023'; end if;
  if p_status=p_expected then raise exception 'Choose a different status' using errcode='22023'; end if;
  update public.job_applications set status=p_status,review_updated_at=now() where id=p_application and status=p_expected returning * into changed;
  if not found then raise exception 'Application changed or no longer exists. Refresh before updating.' using errcode='40001'; end if;
  insert into public.application_review_events(application_id,reviewer_id,previous_status,status) values(changed.id,auth.uid(),p_expected,p_status);
  return jsonb_build_object('id',changed.id,'status',changed.status,'review_updated_at',changed.review_updated_at);
end; $$;

revoke all on function public.recruiter_job_summary() from public,anon;
revoke all on function public.recruiter_job_applicants(text,text,text,integer,integer) from public,anon;
revoke all on function public.set_application_review_status(uuid,text,text) from public,anon;
grant execute on function public.recruiter_job_summary() to authenticated;
grant execute on function public.recruiter_job_applicants(text,text,text,integer,integer) to authenticated;
grant execute on function public.set_application_review_status(uuid,text,text) to authenticated;
commit;
