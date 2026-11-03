begin;
insert into public.published_jobs(id,title,is_open) values
('I2P-20261103-01','Workfront Lead - MRM & Fusion',true),
('I2P-20261103-02','FIS Systematics Subject Matter Expert',true)
on conflict(id) do update set title=excluded.title;
-- Reruns preserve subsequent administrative closure.
commit;
