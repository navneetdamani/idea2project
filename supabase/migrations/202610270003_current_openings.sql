begin;
insert into public.published_jobs(id,title,is_open) values
('I2P-20261027-01','FIS Profile 7 Techno-Functional Consultant',true),
('I2P-20261027-02','JD Edwards Manufacturing Functional Consultant',true),
('I2P-20261027-03','JD Edwards Sales & Distribution Functional Consultant',true),
('I2P-20261027-04','Senior Mendix Developer',true)
on conflict(id) do update set title=excluded.title;
-- A rerun does not reopen a role an administrator has subsequently closed.
commit;
