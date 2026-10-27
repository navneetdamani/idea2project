begin;
alter table public.job_application_receipts
  add column recruiter_state text not null default 'pending' check(recruiter_state in ('pending','sending','sent','failed')),
  add column recruiter_attempts integer not null default 0,
  add column recruiter_last_attempt_at timestamptz,
  add column recruiter_sent_at timestamptz,
  add column recruiter_last_error text;
grant select(recruiter_state,recruiter_sent_at) on public.job_application_receipts to authenticated;

create function public.claim_application_recruiter_notice(receipt_id uuid)
returns setof public.job_application_receipts language sql security definer set search_path='' as $$
  update public.job_application_receipts
  set recruiter_state='sending',recruiter_attempts=recruiter_attempts+1,recruiter_last_attempt_at=now(),recruiter_last_error=null
  where application_id=receipt_id and recruiter_attempts<5 and
    ((recruiter_state in ('pending','failed') and (recruiter_last_attempt_at is null or recruiter_last_attempt_at<now()-interval '1 minute'))
      or (recruiter_state='sending' and recruiter_last_attempt_at<now()-interval '5 minutes'))
  returning *;
$$;
revoke all on function public.claim_application_recruiter_notice(uuid) from public,anon,authenticated;
grant execute on function public.claim_application_recruiter_notice(uuid) to service_role;
commit;
