begin;
create table public.job_application_receipts (
  application_id uuid primary key references public.job_applications(id) on delete cascade,
  candidate_id uuid not null references auth.users(id) on delete cascade,
  state text not null default 'pending' check(state in ('pending','sending','sent','failed')),
  attempts integer not null default 0,
  last_attempt_at timestamptz,
  sent_at timestamptz,
  last_error text
);
alter table public.job_application_receipts enable row level security;
revoke all on public.job_application_receipts from anon,authenticated;
grant select(application_id,candidate_id,state,sent_at) on public.job_application_receipts to authenticated;
grant all on public.job_application_receipts to service_role;
create policy "Read own receipt delivery" on public.job_application_receipts for select to authenticated
using(candidate_id=(select auth.uid()) or (select public.is_recruiter()));

create function public.queue_application_receipt() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.job_application_receipts(application_id,candidate_id) values(new.id,new.candidate_id);
  return new;
end; $$;
revoke all on function public.queue_application_receipt() from public,anon,authenticated;
create trigger queue_application_receipt after insert on public.job_applications for each row execute function public.queue_application_receipt();
insert into public.job_application_receipts(application_id,candidate_id) select id,candidate_id from public.job_applications;

create function public.claim_application_receipt(receipt_id uuid) returns setof public.job_application_receipts language sql security definer set search_path='' as $$
  update public.job_application_receipts set state='sending',attempts=attempts+1,last_attempt_at=now(),last_error=null
  where application_id=receipt_id and attempts<5 and
    ((state in ('pending','failed') and (last_attempt_at is null or last_attempt_at<now()-interval '1 minute'))
      or (state='sending' and last_attempt_at<now()-interval '5 minutes'))
  returning *;
$$;
revoke all on function public.claim_application_receipt(uuid) from public,anon,authenticated;
grant execute on function public.claim_application_receipt(uuid) to service_role;
commit;
