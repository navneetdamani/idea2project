begin;
insert into public.published_jobs(id,title,is_open) values
('I2P-20261125-01','SAP TRM Senior Consultant - FX & Hedge Management',true),
('I2P-20261125-02','SAP Treasury Senior Consultant - TRM & In-House Cash',true)
on conflict(id) do update set title=excluded.title;
commit;
