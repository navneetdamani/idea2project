begin;
insert into public.recruiter_invitations(email) values('approved@example.invalid');
insert into auth.users(id,email) values('20000000-0000-0000-0000-000000000001','approved@example.invalid');
do $$ begin
  if exists(select 1 from public.recruiters where user_id='20000000-0000-0000-0000-000000000001') then raise exception 'Unverified reviewer authorized'; end if;
end; $$;
update auth.users set email_confirmed_at=now() where id='20000000-0000-0000-0000-000000000001';
do $$ begin
  if not exists(select 1 from public.recruiters where user_id='20000000-0000-0000-0000-000000000001') then raise exception 'Verified approved reviewer not authorized'; end if;
end; $$;
update auth.users set email='other@example.invalid' where id='20000000-0000-0000-0000-000000000001';
do $$ begin
  if exists(select 1 from public.recruiters where user_id='20000000-0000-0000-0000-000000000001') then raise exception 'Changed mailbox retained approval'; end if;
end; $$;
insert into auth.users(id,email,email_confirmed_at) values('20000000-0000-0000-0000-000000000002','late@example.invalid',now());
insert into public.recruiter_invitations(email) values('late@example.invalid');
do $$ begin
  if not exists(select 1 from public.recruiters where user_id='20000000-0000-0000-0000-000000000002') then raise exception 'Existing verified reviewer not activated'; end if;
end; $$;
set role authenticated;
do $$ begin
  begin
    insert into public.recruiter_invitations(email) values('attacker@example.invalid');
    raise exception 'Candidate can approve recruiter';
  exception when insufficient_privilege then null; end;
  begin
    perform * from public.recruiter_invitations;
    raise exception 'Candidate can read recruiter invitations';
  exception when insufficient_privilege then null; end;
end; $$;
reset role;
rollback;
select 'PASS: verified mailbox approval, future/existing accounts, email change revocation and denied self-authorization' as result;
