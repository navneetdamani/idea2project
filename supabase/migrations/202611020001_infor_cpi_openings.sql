begin;
insert into public.published_jobs(id,title,is_open) values
('I2P-20261102-01','SAP CPI / SuccessFactors Integration Senior Consultant',true),
('I2P-20261102-02','Infor WFM Technical Consultant',true),
('I2P-20261102-03','Infor GHR Technical Consultant',true),
('I2P-20261102-04','Infor WFM Functional Consultant',true)
on conflict(id) do update set title=excluded.title;
-- Reruns preserve subsequent administrative closure.
commit;
