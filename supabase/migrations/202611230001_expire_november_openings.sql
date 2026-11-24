-- Retire listings older than 14 calendar days as of 23 November 2026 (America/Chicago).
-- Preserve all existing applications and their review statuses.
begin;
update public.published_jobs
set is_open = false
where id in (
  'I2P-20261106-01',
  'I2P-20261106-02',
  'I2P-20261106-03',
  'I2P-20261106-04',
  'I2P-20261106-05',
  'I2P-20261106-06',
  'I2P-20261104-01'
);
commit;
