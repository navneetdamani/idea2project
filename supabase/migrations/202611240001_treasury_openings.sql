-- New recruiter-sourced roles; owner confirmed publication and conversion/NOC terms on 24 November 2026.
begin;
insert into public.published_jobs(id,title,is_open) values
('I2P-20261124-01','SAP TRM Consultant - Commodities',true),
('I2P-20261124-02','SAP APM / In-House Banking Consultant',true),
('I2P-20261124-03','SAP MBC, Payments & Electronic Bank Statement Consultant',true),
('I2P-20261124-04','SAP APM Functional Consultant - S/4HANA Upgrade',true),
('I2P-20261124-05','SAP Treasury & Risk Management Functional Consultant - Upgrade',true)
on conflict(id) do update set title=excluded.title;
-- Re-runs preserve later closures and all existing applications.
commit;
