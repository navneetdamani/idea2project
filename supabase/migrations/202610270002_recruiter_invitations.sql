begin;
-- Administrators record explicitly approved mailbox identities here. Never expose this list to clients.
create table public.recruiter_invitations (
  email text primary key check(email=lower(email) and length(email) between 3 and 254)
);
alter table public.recruiter_invitations enable row level security;
revoke all on public.recruiter_invitations from public,anon,authenticated;

create function public.activate_approved_recruiter() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if TG_OP='UPDATE' then
    if exists(select 1 from public.recruiter_invitations where email=lower(old.email))
       and (new.email is distinct from old.email or new.email_confirmed_at is null) then
      delete from public.recruiters where user_id=new.id;
    end if;
  end if;
  if new.email_confirmed_at is not null
     and exists(select 1 from public.recruiter_invitations where email=lower(new.email)) then
    insert into public.recruiters(user_id) values(new.id) on conflict do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.activate_approved_recruiter() from public,anon,authenticated;
create trigger activate_approved_recruiter after insert or update of email,email_confirmed_at on auth.users
for each row execute function public.activate_approved_recruiter();

create function public.apply_recruiter_invitation() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into public.recruiters(user_id)
  select id from auth.users where lower(email)=new.email and email_confirmed_at is not null
  on conflict do nothing;
  return new;
end;
$$;
revoke all on function public.apply_recruiter_invitation() from public,anon,authenticated;
create trigger apply_recruiter_invitation after insert on public.recruiter_invitations
for each row execute function public.apply_recruiter_invitation();
commit;
