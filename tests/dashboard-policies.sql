begin;
insert into auth.users(id) values('30000000-0000-0000-0000-000000000001'),('30000000-0000-0000-0000-000000000002'),('30000000-0000-0000-0000-000000000003');
insert into public.recruiters values('30000000-0000-0000-0000-000000000003');
insert into public.candidate_profiles(id,full_name,experience_years,skills,consent_version) values
('30000000-0000-0000-0000-000000000001','Alice Test',4,array['Mendix'],'2026-10-v1'),
('30000000-0000-0000-0000-000000000002','Bob Test',7,array['Banking'],'2026-10-v1');
insert into storage.objects(bucket_id,name) values('candidate-cvs','30000000-0000-0000-0000-000000000001/latest.pdf'),('candidate-cvs','30000000-0000-0000-0000-000000000002/latest.pdf');
insert into public.job_applications(id,candidate_id,job_id,availability_days,statement,consent_version) values
('31000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','I2P-20261027-01',10,'Fictional test application experience.','2026-10-app-v1'),
('31000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000002','I2P-20261027-01',30,'Fictional test application experience.','2026-10-app-v1');
update public.published_jobs set is_open=false where id='I2P-20261027-01';
set role authenticated;
select set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000001',true);
do $$ begin
  if not exists(select 1 from public.published_jobs where id='I2P-20261027-01') then raise exception 'Own applied closed role title hidden'; end if;
  if exists(select 1 from public.published_jobs where id='I2P-20261023-01') then raise exception 'Unrelated closed role exposed'; end if;
  begin perform public.recruiter_job_summary();raise exception 'Candidate can read all job counts';exception when insufficient_privilege then null;end;
  begin perform public.recruiter_job_applicants('I2P-20261027-01');raise exception 'Candidate can list other applicants';exception when insufficient_privilege then null;end;
  begin perform public.set_application_review_status('31000000-0000-0000-0000-000000000001','closed','submitted');raise exception 'Candidate can set review status';exception when insufficient_privilege then null;end;
end; $$;
select set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000003',true);
do $$ declare result jsonb;begin
  result:=public.recruiter_job_applicants('I2P-20261027-01');
  if (result->>'total')::integer<>2 or jsonb_array_length(result->'items')<>2 then raise exception 'Recruiter applicant list incomplete';end if;
  result:=public.recruiter_job_applicants('I2P-20261027-01','','Mendix');
  if (result->>'total')::integer<>1 or result->'items'->0->'profile'->>'full_name'<>'Alice Test' then raise exception 'Recruiter search failed';end if;
  result:=public.recruiter_job_applicants('I2P-20261027-01','','',1,1);
  if jsonb_array_length(result->'items')<>1 or (result->>'total')::integer<>2 then raise exception 'Pagination lost applicants';end if;
  result:=public.set_application_review_status('31000000-0000-0000-0000-000000000001','in_review','submitted');
  if result->>'status'<>'in_review' or result->>'review_updated_at' is null then raise exception 'Review status not saved';end if;
  begin perform public.set_application_review_status('31000000-0000-0000-0000-000000000001','closed','submitted');raise exception 'Stale status overwrote newer review';exception when serialization_failure then null;end;
  result:=public.recruiter_job_applicants('I2P-20261027-01','in_review');
  if (result->>'total')::integer<>1 then raise exception 'Status filter failed';end if;
  if (select count(*) from public.application_review_events)<>1 then raise exception 'Review audit missing';end if;
  if not exists(select 1 from jsonb_array_elements(public.recruiter_job_summary()) j where j->>'id'='I2P-20261027-01' and j->>'total'='2' and j->>'in_review'='1') then raise exception 'Job summary counts failed';end if;
end; $$;
select set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000001',true);
do $$ begin
  if (select status from public.job_applications where id='31000000-0000-0000-0000-000000000001')<>'in_review' then raise exception 'Candidate cannot see review update';end if;
  if (select count(*) from public.application_review_events)<>0 then raise exception 'Candidate can see private audit';end if;
end; $$;
set role anon;
do $$ begin
  begin perform public.recruiter_job_summary();raise exception 'Anonymous job summary allowed';exception when insufficient_privilege then null;end;
end; $$;
reset role;
rollback;
select 'PASS: recruiter-only lists, search, pagination, review updates, audit, concurrency and candidate status visibility' as result;
