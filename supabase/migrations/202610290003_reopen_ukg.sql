begin;
-- A fresh 29 October recruiter request explicitly reopens these existing UKG roles.
update public.published_jobs set is_open=true where id in ('I2P-20261023-03','I2P-20261023-04');
commit;
