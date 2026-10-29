begin;
insert into auth.users(id) values('40000000-0000-0000-0000-000000000001'),('40000000-0000-0000-0000-000000000002'),('40000000-0000-0000-0000-000000000003');
insert into public.recruiters values('40000000-0000-0000-0000-000000000003');
insert into public.candidate_profiles(id,full_name,experience_years,skills,consent_version) values
('40000000-0000-0000-0000-000000000001','Overview Alice',4,array['Mendix'],'2026-10-v1'),
('40000000-0000-0000-0000-000000000002','Overview Bob',7,array['Banking'],'2026-10-v1');
insert into storage.objects(bucket_id,name) values('candidate-cvs','40000000-0000-0000-0000-000000000001/latest.pdf'),('candidate-cvs','40000000-0000-0000-0000-000000000002/latest.pdf');
insert into public.job_applications(id,candidate_id,job_id,availability_days,statement,consent_version) values
('41000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','I2P-20261027-01',10,'Fictional overview application experience.','2026-10-app-v1'),
('41000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000002','I2P-20261027-04',30,'Fictional overview application experience.','2026-10-app-v1');
set role authenticated;
select set_config('request.jwt.claim.sub','40000000-0000-0000-0000-000000000001',true);
do $$ begin
  begin perform public.recruiter_job_applicants();raise exception 'Candidate can read global inbox';exception when insufficient_privilege then null;end;
  begin perform public.set_application_review_status('41000000-0000-0000-0000-000000000002','customer_rejected','submitted');raise exception 'Candidate can reject';exception when insufficient_privilege then null;end;
end; $$;
select set_config('request.jwt.claim.sub','40000000-0000-0000-0000-000000000003',true);
do $$ declare result jsonb;begin
  result:=public.recruiter_job_applicants('','submitted');
  if (result->>'total')::integer<>2 then raise exception 'Global new inbox misses jobs';end if;
  if exists(select 1 from jsonb_array_elements(result->'items') a where a->>'job_title' is null) then raise exception 'Inbox job titles missing';end if;
  result:=public.recruiter_job_applicants('','','',1,1);
  if jsonb_array_length(result->'items')<>1 or result->>'total'<>'2' then raise exception 'Global pagination failed';end if;
  perform public.set_application_review_status('41000000-0000-0000-0000-000000000001','submitted_to_customer','submitted');
  result:=public.recruiter_job_applicants('','submitted_to_customer');
  if result->>'total'<>'1' then raise exception 'Customer submission inbox missing';end if;
  if not exists(select 1 from jsonb_array_elements(public.recruiter_job_summary()) j where j->>'id'='I2P-20261027-01' and j->>'submitted_to_customer'='1') then raise exception 'Customer submission count missing';end if;
  perform public.set_application_review_status('41000000-0000-0000-0000-000000000001','customer_rejected','submitted_to_customer');
  perform public.set_application_review_status('41000000-0000-0000-0000-000000000002','closed','submitted');
  result:=public.recruiter_job_applicants('','customer_rejected');
  if result->>'total'<>'1' or result->'items'->0->>'job_id'<>'I2P-20261027-01' then raise exception 'Rejected global filter failed';end if;
  result:=public.recruiter_job_applicants('I2P-20261027-04','customer_rejected');
  if result->>'total'<>'0' then raise exception 'Rejected filter ignores chosen job';end if;
  if not exists(select 1 from jsonb_array_elements(public.recruiter_job_summary()) j where j->>'id'='I2P-20261027-01' and j->>'customer_rejected'='1' and j->>'closed'='0') then raise exception 'Rejected merged with Closed counts';end if;
  if not exists(select 1 from jsonb_array_elements(public.recruiter_job_summary()) j where j->>'id'='I2P-20261027-04' and j->>'closed'='1' and j->>'customer_rejected'='0') then raise exception 'Closed counts failed';end if;
  begin perform public.set_application_review_status('41000000-0000-0000-0000-000000000001','closed','submitted');raise exception 'Stale rejection overwritten';exception when serialization_failure then null;end;
  if (select count(*) from public.application_review_events)<>3 then raise exception 'Decision audit missing';end if;
end; $$;
select set_config('request.jwt.claim.sub','40000000-0000-0000-0000-000000000001',true);
do $$ begin
  if (select status from public.job_applications where id='41000000-0000-0000-0000-000000000001')<>'customer_rejected' then raise exception 'Candidate rejected status hidden';end if;
end; $$;
reset role;
rollback;
select 'PASS: customer submission/rejection stages, filters, distinct counts, human audit and candidate visibility' as result;
