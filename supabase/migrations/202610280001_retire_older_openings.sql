begin;
-- Retire these listings without deleting jobs or the applications that reference them.
update public.published_jobs set is_open=false
where id in ('I2P-20261023-01','I2P-20261023-02','I2P-20261023-03','I2P-20261023-04','I2P-20261023-05');
commit;
