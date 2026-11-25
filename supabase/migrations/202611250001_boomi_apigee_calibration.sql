-- Apigee added to the existing public job description; preserve intake state and all applications.
begin;
update public.published_jobs set title='Boomi Integration Consultant' where id='I2P-20261112-01';
commit;
