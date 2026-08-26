-- 0. Clean Reset of existing tables/types if partially created
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
drop function if exists public.has_role(_user_id uuid, _role public.app_role);

drop table if exists public.notifications cascade;
drop table if exists public.salary_structures cascade;
drop table if exists public.leave_requests cascade;
drop table if exists public.attendance cascade;
drop table if exists public.user_roles cascade;
drop table if exists public.profiles cascade;

drop type if exists public.app_role cascade;
drop type if exists public.attendance_status cascade;
drop type if exists public.leave_type cascade;
drop type if exists public.leave_status cascade;

-- 1. Create Enums
create type public.app_role as enum ('admin', 'employee');
create type public.attendance_status as enum ('present', 'absent', 'half_day', 'leave');
create type public.leave_type as enum ('paid', 'sick', 'unpaid');
create type public.leave_status as enum ('pending', 'approved', 'rejected');

-- 2. Create Core Tables
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  employee_id text not null unique,
  full_name text not null,
  email text,
  phone text,
  address text,
  department text,
  designation text,
  date_of_joining date,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  check_in timestamptz,
  check_out timestamptz,
  status public.attendance_status not null default 'present',
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  leave_type public.leave_type not null,
  start_date date not null,
  end_date date not null,
  remarks text,
  status public.leave_status not null default 'pending',
  reviewer_comment text,
  reviewed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.salary_structures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  basic numeric(12,2) not null default 0,
  hra numeric(12,2) not null default 0,
  allowances numeric(12,2) not null default 0,
  deductions numeric(12,2) not null default 0,
  effective_from date not null default current_date,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- 3. Grants & Row Level Security (RLS)
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
grant select, insert, update, delete on public.attendance to authenticated;
grant all on public.attendance to service_role;
grant select, insert, update, delete on public.leave_requests to authenticated;
grant all on public.leave_requests to service_role;
grant select, insert, update, delete on public.salary_structures to authenticated;
grant all on public.salary_structures to service_role;
grant select, insert, update, delete on public.notifications to authenticated;
grant all on public.notifications to service_role;

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.attendance enable row level security;
alter table public.leave_requests enable row level security;
alter table public.salary_structures enable row level security;
alter table public.notifications enable row level security;

-- Helper function
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

-- Password reset helper function (Security Definer to prevent leaking full profile table to anon)
create or replace function public.check_email_exists(_email text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return exists (
    select 1 from public.profiles where lower(email) = lower(_email)
  );
end;
$$;

grant execute on function public.check_email_exists(text) to anon, authenticated;

-- RLS Policies
create policy "Signed-in users can view profiles"
  on public.profiles for select to authenticated using (true);
create policy "Users can update their own profile"
  on public.profiles for update to authenticated using (auth.uid() = id);
create policy "Admins can update any profile"
  on public.profiles for update to authenticated using (public.has_role(auth.uid(), 'admin'));

create policy "Users can view their own roles"
  on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create policy "Users can view their own attendance, admins view all"
  on public.attendance for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "Users can check themselves in, admins can add records"
  on public.attendance for insert to authenticated
  with check (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "Users can update their own attendance, admins update all"
  on public.attendance for update to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create policy "Users can view their own leave requests, admins view all"
  on public.leave_requests for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "Employees can apply for leave"
  on public.leave_requests for insert to authenticated
  with check (user_id = auth.uid());
create policy "Admins can review leave requests"
  on public.leave_requests for update to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "Users can view their own salary, admins view all"
  on public.salary_structures for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "Admins can create salary structures"
  on public.salary_structures for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins can update salary structures"
  on public.salary_structures for update to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "Users view their notifications" on public.notifications
  for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "Users and system create notifications" on public.notifications
  for insert to authenticated with check (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "Users update their notifications" on public.notifications
  for update to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- Notify all HR Admins securely (bypasses RLS check for non-admin senders)
create or replace function public.notify_admins(_title text, _message text, _type text default 'system')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, title, message, type, read, created_at)
  select user_id, _title, _message, _type, false, now()
  from public.user_roles
  where role = 'admin';
end;
$$;

grant execute on function public.notify_admins(text, text, text) to authenticated;

-- 4. User Trigger Function
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, employee_id, full_name, email, department, designation)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'employee_id', ''), 'DF-' || upper(substr(new.id::text, 1, 6))),
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'department',
    new.raw_user_meta_data->>'designation'
  )
  on conflict (id) do update set
    employee_id = excluded.employee_id,
    full_name = excluded.full_name,
    email = excluded.email,
    department = excluded.department,
    designation = excluded.designation;

  insert into public.user_roles (user_id, role)
  values (
    new.id,
    'employee'::public.app_role
  )
  on conflict (user_id, role) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4b. Admin Promote User Function
create or replace function public.promote_user_to_admin(_target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Unauthorized: Only admins can promote users to HR Admin.';
  end if;

  insert into public.user_roles (user_id, role)
  values (_target_user_id, 'admin'::public.app_role)
  on conflict (user_id, role) do update set role = 'admin'::public.app_role;
end;
$$;

grant execute on function public.promote_user_to_admin(uuid) to authenticated;
revoke execute on function public.promote_user_to_admin(uuid) from public, anon;

-- 5. Seed Demo Users (Password: Dayflow@123)
delete from auth.identities where user_id between 'a0000000-0000-4000-8000-000000000001' and 'a0000000-0000-4000-8000-000000000008';
delete from auth.users where id between 'a0000000-0000-4000-8000-000000000001' and 'a0000000-0000-4000-8000-000000000008';

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('a0000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@dayflow.io', crypt('Dayflow@123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Aarav Mehta","employee_id":"DF-001","role":"admin","department":"People Ops","designation":"Head of People"}', now(), now()),
  ('a0000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'priya@dayflow.io', crypt('Dayflow@123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Priya Sharma","employee_id":"DF-002","role":"employee","department":"Engineering","designation":"Senior Frontend Engineer"}', now(), now()),
  ('a0000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rahul@dayflow.io', crypt('Dayflow@123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Rahul Verma","employee_id":"DF-003","role":"employee","department":"Design","designation":"Product Designer"}', now(), now()),
  ('a0000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sneha@dayflow.io', crypt('Dayflow@123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Sneha Iyer","employee_id":"DF-004","role":"employee","department":"Engineering","designation":"Backend Engineer"}', now(), now()),
  ('a0000000-0000-4000-8000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'arjun@dayflow.io', crypt('Dayflow@123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Arjun Nair","employee_id":"DF-005","role":"employee","department":"Sales","designation":"Sales Lead"}', now(), now()),
  ('a0000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'kavya@dayflow.io', crypt('Dayflow@123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Kavya Reddy","employee_id":"DF-006","role":"employee","department":"Marketing","designation":"Marketing Manager"}', now(), now()),
  ('a0000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'vikram@dayflow.io', crypt('Dayflow@123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Vikram Singh","employee_id":"DF-007","role":"employee","department":"Finance","designation":"Finance Analyst"}', now(), now()),
  ('a0000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 'ananya@dayflow.io', crypt('Dayflow@123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Ananya Das","employee_id":"DF-008","role":"employee","department":"People Ops","designation":"HR Associate"}', now(), now());

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', '{"sub":"a0000000-0000-4000-8000-000000000001","email":"admin@dayflow.io"}', 'email', now(), now(), now()),
  ('a0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', '{"sub":"a0000000-0000-4000-8000-000000000002","email":"priya@dayflow.io"}', 'email', now(), now(), now()),
  ('a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000003', '{"sub":"a0000000-0000-4000-8000-000000000003","email":"rahul@dayflow.io"}', 'email', now(), now(), now()),
  ('a0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000004', '{"sub":"a0000000-0000-4000-8000-000000000004","email":"sneha@dayflow.io"}', 'email', now(), now(), now()),
  ('a0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000005', '{"sub":"a0000000-0000-4000-8000-000000000005","email":"arjun@dayflow.io"}', 'email', now(), now(), now()),
  ('a0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000006', '{"sub":"a0000000-0000-4000-8000-000000000006","email":"kavya@dayflow.io"}', 'email', now(), now(), now()),
  ('a0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000007', '{"sub":"a0000000-0000-4000-8000-000000000007","email":"vikram@dayflow.io"}', 'email', now(), now(), now()),
  ('a0000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000008', '{"sub":"a0000000-0000-4000-8000-000000000008","email":"ananya@dayflow.io"}', 'email', now(), now(), now());

update auth.users
set confirmation_token = coalesce(confirmation_token, ''),
    recovery_token = coalesce(recovery_token, ''),
    email_change = coalesce(email_change, ''),
    email_change_token_new = coalesce(email_change_token_new, ''),
    email_change_token_current = coalesce(email_change_token_current, ''),
    reauthentication_token = coalesce(reauthentication_token, '')
where id between 'a0000000-0000-4000-8000-000000000001' and 'a0000000-0000-4000-8000-000000000008';

-- Ensure seed admin user gets admin role
update public.user_roles set role = 'admin' where user_id = 'a0000000-0000-4000-8000-000000000001';

update public.profiles set phone = '+91 98220 41102', address = 'HSR Layout, Bengaluru', date_of_joining = '2021-04-12' where employee_id = 'DF-001';
update public.profiles set phone = '+91 98450 12231', address = 'Indiranagar, Bengaluru', date_of_joining = '2022-01-10' where employee_id = 'DF-002';
update public.profiles set phone = '+91 99301 88762', address = 'Koramangala, Bengaluru', date_of_joining = '2022-06-20' where employee_id = 'DF-003';
update public.profiles set phone = '+91 90040 55618', address = 'Whitefield, Bengaluru', date_of_joining = '2023-02-01' where employee_id = 'DF-004';
update public.profiles set phone = '+91 98200 77144', address = 'JP Nagar, Bengaluru', date_of_joining = '2021-11-15' where employee_id = 'DF-005';
update public.profiles set phone = '+91 97002 31455', address = 'Hitech City, Hyderabad', date_of_joining = '2023-07-03' where employee_id = 'DF-006';
update public.profiles set phone = '+91 98110 20987', address = 'Saket, New Delhi', date_of_joining = '2024-01-22' where employee_id = 'DF-007';
update public.profiles set phone = '+91 98301 66420', address = 'Salt Lake, Kolkata', date_of_joining = '2024-09-09' where employee_id = 'DF-008';

-- 6. Seed Attendance, Leave Requests & Salary
insert into public.attendance (user_id, date, check_in, check_out, status)
select s.id, s.d,
  case when s.st in ('present', 'half_day')
    then s.d + interval '9 hours' + ((abs(hashtext(s.id::text || s.d::text)) % 40) * interval '1 minute') end,
  case when s.st = 'present'
    then s.d + interval '18 hours' + ((abs(hashtext(s.d::text || s.id::text)) % 30) * interval '1 minute')
    when s.st = 'half_day' then s.d + interval '13 hours 30 minutes' end,
  s.st
from (
  select p.id, g.d::date as d,
    case abs(hashtext(p.id::text || g.d::date::text)) % 20
      when 0 then 'absent'::public.attendance_status
      when 1 then 'leave'::public.attendance_status
      when 2 then 'leave'::public.attendance_status
      when 3 then 'half_day'::public.attendance_status
      else 'present'::public.attendance_status
    end as st
  from public.profiles p
  cross join generate_series(current_date - 21, current_date - 1, interval '1 day') as g(d)
  where extract(isodow from g.d) < 6
) s;

insert into public.leave_requests (user_id, leave_type, start_date, end_date, remarks, status, reviewer_comment, reviewed_by, created_at)
values
  ('a0000000-0000-4000-8000-000000000002', 'paid', current_date + 10, current_date + 12, 'Family trip to Coorg', 'pending', null, null, now() - interval '1 day'),
  ('a0000000-0000-4000-8000-000000000004', 'paid', current_date + 20, current_date + 24, 'Cousin''s wedding in Kochi', 'pending', null, null, now() - interval '2 days'),
  ('a0000000-0000-4000-8000-000000000003', 'paid', current_date + 30, current_date + 32, 'Goa trip with friends', 'pending', null, null, now() - interval '3 hours'),
  ('a0000000-0000-4000-8000-000000000003', 'sick', current_date - 3, current_date - 2, 'Down with fever, need rest', 'approved', 'Get well soon!', 'a0000000-0000-4000-8000-000000000001', now() - interval '5 days'),
  ('a0000000-0000-4000-8000-000000000005', 'unpaid', current_date - 15, current_date - 14, 'Personal work', 'approved', 'Approved. Payroll will adjust.', 'a0000000-0000-4000-8000-000000000001', now() - interval '17 days'),
  ('a0000000-0000-4000-8000-000000000006', 'sick', current_date - 7, current_date - 7, 'Migraine', 'approved', null, 'a0000000-0000-4000-8000-000000000001', now() - interval '8 days'),
  ('a0000000-0000-4000-8000-000000000007', 'paid', current_date + 5, current_date + 6, 'House shifting', 'rejected', 'Quarter-end closing week, please reschedule.', 'a0000000-0000-4000-8000-000000000001', now() - interval '2 days'),
  ('a0000000-0000-4000-8000-000000000008', 'paid', current_date - 20, current_date - 18, 'Family function', 'approved', null, 'a0000000-0000-4000-8000-000000000001', now() - interval '22 days');

insert into public.salary_structures (user_id, basic, hra, allowances, deductions, effective_from)
values
  ('a0000000-0000-4000-8000-000000000001', 120000, 48000, 32000, 22000, '2025-04-01'),
  ('a0000000-0000-4000-8000-000000000002', 85000, 34000, 21000, 14000, '2025-04-01'),
  ('a0000000-0000-4000-8000-000000000003', 70000, 28000, 18000, 12000, '2025-04-01'),
  ('a0000000-0000-4000-8000-000000000004', 80000, 32000, 20000, 13500, '2025-04-01'),
  ('a0000000-0000-4000-8000-000000000005', 65000, 26000, 22000, 11000, '2025-04-01'),
  ('a0000000-0000-4000-8000-000000000006', 68000, 27200, 19000, 11500, '2025-04-01'),
  ('a0000000-0000-4000-8000-000000000007', 60000, 24000, 15000, 10000, '2025-04-01'),
  ('a0000000-0000-4000-8000-000000000008', 45000, 18000, 12000, 8000, '2025-04-01');