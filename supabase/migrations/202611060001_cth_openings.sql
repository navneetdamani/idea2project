begin;
insert into public.published_jobs (id, title, is_open) values
('I2P-20261106-01', 'SAP HANA / BTP / IBP Data Modeler', true),
('I2P-20261106-02', 'Oracle Cloud Order Management Consultant', true),
('I2P-20261106-03', 'SAP Vistex Technical Consultant', true),
('I2P-20261106-04', 'Oracle ADF / APEX Consultant', true),
('I2P-20261106-05', 'SAP WM Consultant', true),
('I2P-20261106-06', 'SAP Finance ACR / DRC Tax Consultant', true)
on conflict (id) do update set title = excluded.title;
-- Reruns preserve subsequent administrative closure.
commit;
