begin;
insert into public.published_jobs (id, title, is_open) values
('I2P-20261104-01', 'Data Modeling Engineer', true)
on conflict (id) do update set title = excluded.title;
-- Reruns preserve subsequent administrative closure.
commit;
