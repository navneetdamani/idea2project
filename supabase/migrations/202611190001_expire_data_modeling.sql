begin;
-- Nov4 listing is older than14 calendar days as of Nov19 America/Chicago.
-- Preserve all applications, CVs and review outcomes.
update public.published_jobs set is_open=false where id='I2P-20261104-01';
commit;
