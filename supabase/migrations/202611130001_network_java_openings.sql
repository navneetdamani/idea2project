begin;
insert into public.published_jobs (id,title,is_open) values
('I2P-20261113-01','Network Technical Project Lead',true),
('I2P-20261113-02','Java Developer - Spring Boot & REST APIs',true)
on conflict(id) do update set title=excluded.title;
-- Re-runs preserve later closures and all applications.
commit;
