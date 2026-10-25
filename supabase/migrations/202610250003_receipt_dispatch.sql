-- Hosted Supabase only: pg_net dispatches after the application transaction commits.
begin;
create extension if not exists pg_net with schema extensions;
create function public.dispatch_application_receipt() returns trigger language plpgsql security definer set search_path='' as $$
declare token text;
begin
  token := coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb->>'authorization';
  if token is not null then
    perform net.http_post(
      url:='https://svvsfozdwosvchzlivne.supabase.co/functions/v1/application-receipt',
      body:=jsonb_build_object('application_id',new.id),
      headers:=jsonb_build_object('Content-Type','application/json','Authorization',token),
      timeout_milliseconds:=30000);
  end if;
  return new;
exception when others then
  -- Email dispatch must never roll back an otherwise valid application.
  return new;
end; $$;
revoke all on function public.dispatch_application_receipt() from public,anon,authenticated;
create trigger zz_dispatch_application_receipt after insert on public.job_applications for each row execute function public.dispatch_application_receipt();
commit;
