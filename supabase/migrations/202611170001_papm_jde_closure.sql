begin;
-- Archive only the closed opening; preserve candidate applications and review statuses.
update public.published_jobs set is_open=false where id='I2P-20261112-03';
insert into public.published_jobs (id,title,is_open) values
('I2P-20261117-01','SAP PaPM Consultant',true)
on conflict(id) do update set title=excluded.title;
-- Re-runs preserve any later closure of the new opening.
commit;
