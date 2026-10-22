-- Run after bootstrap + migration in a disposable PostgreSQL database only.
begin;
insert into auth.users(id) values ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002'),('00000000-0000-0000-0000-000000000003');
insert into public.recruiters(user_id) values ('00000000-0000-0000-0000-000000000003');
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
insert into public.candidate_profiles(id,full_name,experience_years,skills,consent_version) values (auth.uid(),'Fictional A',7,array['SAP PS'],'2026-10-v1');
insert into storage.objects(bucket_id,name) values ('candidate-cvs',auth.uid()::text || '/latest.pdf');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
do $$ begin
  if (select count(*) from public.candidate_profiles) <> 0 then raise exception 'Candidate B can read candidate A profile'; end if;
  if (select count(*) from storage.objects) <> 0 then raise exception 'Candidate B can read candidate A CV'; end if;
  begin
    insert into storage.objects(bucket_id,name) values ('candidate-cvs',auth.uid()::text || '/latest.pdf');
    raise exception 'Upload without saved profile was allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.candidate_profiles(id,full_name,experience_years,skills,consent_version) values ('00000000-0000-0000-0000-000000000003','Impersonation',7,array['SAP'],'2026-10-v1');
    raise exception 'Cross-account profile creation was allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.recruiters(user_id) values (auth.uid());
    raise exception 'Candidate could grant recruiter access';
  exception when insufficient_privilege then null; end;
end; $$;
insert into public.candidate_profiles(id,full_name,experience_years,skills,consent_version) values (auth.uid(),'Fictional B',5,array['SAP BTP'],'2026-10-v1');
do $$ declare affected integer; begin
  update public.candidate_profiles set full_name='Modified by B' where id='00000000-0000-0000-0000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Cross-account profile update was allowed'; end if;
  delete from storage.objects where name='00000000-0000-0000-0000-000000000001/latest.pdf';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Cross-account CV deletion was allowed'; end if;
  begin
    insert into storage.objects(bucket_id,name) values ('candidate-cvs','00000000-0000-0000-0000-000000000003/latest.pdf');
    raise exception 'Cross-account upload was allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into storage.objects(bucket_id,name) values ('candidate-cvs',auth.uid()::text || '/extra.pdf');
    raise exception 'Alternate CV key was allowed';
  exception when insufficient_privilege then null; end;
end; $$;
insert into storage.objects(bucket_id,name) values ('candidate-cvs',auth.uid()::text || '/latest.pdf');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
do $$ declare affected integer; begin
  if not public.is_recruiter() then raise exception 'Recruiter grant not recognized'; end if;
  if (select count(*) from public.candidate_profiles) <> 2 then raise exception 'Recruiter cannot read profiles'; end if;
  if (select count(*) from storage.objects) <> 2 then raise exception 'Recruiter cannot read CVs'; end if;
  update public.candidate_profiles set full_name='Recruiter changed data';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Recruiter can modify candidates self-reported profiles'; end if;
end; $$;
set role anon;
do $$ begin
  begin perform * from public.candidate_profiles; raise exception 'Anonymous profile access allowed'; exception when insufficient_privilege then null; end;
  begin perform * from storage.objects; raise exception 'Anonymous CV access allowed'; exception when insufficient_privilege then null; end;
end; $$;
reset role;
do $$ begin
  if exists(select 1 from storage.buckets where id='candidate-cvs' and (public or file_size_limit<>5242880 or allowed_mime_types<>array['application/pdf'])) then raise exception 'Unsafe bucket configuration'; end if;
end; $$;
rollback;
select 'PASS: candidate isolation, recruiter read access, role escalation denial, private CV paths and anonymous denial' as result;
