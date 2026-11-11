begin;
update public.published_jobs set is_open = false where id in ('I2P-20261030-01', 'I2P-20261023-04');
insert into public.published_jobs (id, title, is_open) values ('I2P-20261111-01', 'MuleSoft Developer', true)
on conflict (id) do update set title = excluded.title;
-- Reruns preserve subsequent administrative closure. Existing applications remain intact.
commit;
