begin;
-- Retire listings older than 14 calendar days as of 18 Nov 2026 America/Chicago.
-- Existing applications and candidate review outcomes are preserved.
update public.published_jobs set is_open=false where id in (
'I2P-20261103-01',
'I2P-20261103-02',
'I2P-20261102-01',
'I2P-20261102-02',
'I2P-20261102-03',
'I2P-20261102-04',
'I2P-20261023-03',
'I2P-20261028-01',
'I2P-20261028-02',
'I2P-20261028-03',
'I2P-20261028-04',
'I2P-20261027-01',
'I2P-20261027-02',
'I2P-20261027-03',
'I2P-20261027-04'
);
commit;
