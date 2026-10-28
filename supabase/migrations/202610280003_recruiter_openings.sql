begin;
insert into public.published_jobs(id,title,is_open) values
('I2P-20261028-01','SAP HR Time Management (CATS) Consultant',true),
('I2P-20261028-02','SAP BIB & HR ABAP Senior Consultant',true),
('I2P-20261028-03','Oracle US Payroll Functional Consultant',true),
('I2P-20261028-04','SAP SuccessFactors EC Time & Attendance Senior Consultant',true)
on conflict(id) do update set title=excluded.title;
-- Reruns preserve subsequent administrative closure.
commit;
