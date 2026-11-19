begin;
insert into public.published_jobs(id,title,is_open) values
('I2P-20261118-01','SAP GTS Consultant - Risk, Preference & Intrastat',true),
('I2P-20261118-02','SAP ECC Benefits Senior Consultant',true)
on conflict(id) do update set title=excluded.title;
-- Re-runs preserve later closures and all existing applications.
commit;
