begin;
insert into public.published_jobs(id,title,is_open) values
('I2P-20261030-01','Collibra Solution Architect',true)
on conflict(id) do update set title=excluded.title;
-- Reruns preserve subsequent administrative closure.
commit;
