begin;
insert into auth.users(id) values ('10000000-0000-0000-0000-000000000001'),('10000000-0000-0000-0000-000000000002'),('10000000-0000-0000-0000-000000000003');
insert into public.recruiters values ('10000000-0000-0000-0000-000000000003');
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
insert into public.candidate_profiles(id,full_name,experience_years,skills,consent_version) values(auth.uid(),'Test candidate',8,array['UKG'],'2026-10-v1');
do $$ begin
  begin
    insert into public.job_applications(candidate_id,job_id,availability_days,statement,consent_version) values(auth.uid(),'I2P-20261023-03',30,'Fictional relevant experience for this role.','2026-10-app-v1');
    raise exception 'Application without CV allowed';
  exception when insufficient_privilege then null; end;
end; $$;
insert into storage.objects(bucket_id,name) values('candidate-cvs',auth.uid()::text||'/latest.pdf');
insert into public.job_applications(candidate_id,job_id,availability_days,statement,consent_version) values(auth.uid(),'I2P-20261023-03',30,'Fictional relevant experience for this role.','2026-10-app-v1');
do $$ begin
  if (select count(*) from public.job_application_receipts)<>1 then raise exception 'Receipt not queued atomically'; end if;
  if (select recruiter_state from public.job_application_receipts limit 1)<>'pending' then raise exception 'Recruiter email not queued'; end if;
  begin
    update public.job_application_receipts set recruiter_state='sent';
    raise exception 'Candidate can forge recruiter email';
  exception when insufficient_privilege then null; end;
  begin
    perform public.claim_application_recruiter_notice((select id from public.job_applications limit 1));
    raise exception 'Candidate can claim recruiter email queue';
  exception when insufficient_privilege then null; end;
  begin
    update public.job_application_receipts set state='sent';
    raise exception 'Candidate can forge email delivery';
  exception when insufficient_privilege then null; end;
  begin
    perform public.claim_application_receipt((select id from public.job_applications limit 1));
    raise exception 'Candidate can directly claim email queue';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.job_applications(candidate_id,job_id,availability_days,statement,consent_version) values(auth.uid(),'I2P-20261023-03',30,'Fictional relevant experience for this role.','2026-10-app-v1');
    raise exception 'Duplicate application allowed';
  exception when unique_violation then null; end;
  begin
    update public.job_applications set status='closed';
    raise exception 'Candidate status modification allowed';
  exception when insufficient_privilege then null; end;
end; $$;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
do $$ begin
  if (select count(*) from public.job_applications)<>0 then raise exception 'Cross-account application read allowed'; end if;
  if (select count(*) from public.job_application_receipts)<>0 then raise exception 'Cross-account receipt read allowed'; end if;
  begin
    insert into public.job_applications(candidate_id,job_id,availability_days,statement,consent_version) values('10000000-0000-0000-0000-000000000001','I2P-20261023-01',30,'Fictional relevant experience for this role.','2026-10-app-v1');
    raise exception 'Cross-account application creation allowed';
  exception when insufficient_privilege then null; end;
end; $$;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',true);
do $$ begin
  if (select count(*) from public.job_applications)<>1 then raise exception 'Recruiter application read failed'; end if;
end; $$;
reset role;
update public.published_jobs set is_open=false where id='I2P-20261023-01';
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
do $$ begin
  begin
    insert into public.job_applications(candidate_id,job_id,availability_days,statement,consent_version) values(auth.uid(),'I2P-20261023-01',30,'Fictional relevant experience for this role.','2026-10-app-v1');
    raise exception 'Closed job application allowed';
  exception when insufficient_privilege then null; end;
end; $$;
set role anon;
do $$ begin
  begin perform * from public.job_applications; raise exception 'Anonymous application read allowed'; exception when insufficient_privilege then null; end;
end; $$;
reset role;
rollback;
select 'PASS: application ownership, duplicate denial, CV requirement, closed jobs and recruiter visibility' as result;
