begin;
insert into public.published_jobs (id, title, is_open) values
('I2P-20261112-01', 'Boomi Integration Consultant - EDI', true),
('I2P-20261112-02', 'BizTalk EDI Developer', true),
('I2P-20261112-03', 'JD Edwards P2P / Inventory Functional Consultant', true),
('I2P-20261112-04', 'Oracle Sales Performance Management Functional SME', true),
('I2P-20261112-05', 'Oracle Cloud Receivables & Credit Management Functional Consultant', true)
on conflict (id) do update set title = excluded.title;
-- Reruns preserve subsequent administrative closure. Existing applications remain intact.
commit;
