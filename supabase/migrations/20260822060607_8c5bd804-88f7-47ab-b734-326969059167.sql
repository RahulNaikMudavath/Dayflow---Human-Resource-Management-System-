-- Enable pgcrypto extension for password hashing
create extension if not exists pgcrypto;

-- Safely create custom ENUM types
do $$ begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('admin', 'employee');
  end if;
  if not exists (select 1 from pg_type where typname = 'attendance_status') then
    create type public.attendance_status as enum ('present', 'absent', 'half_day', 'leave');
  end if;
  if not exists (select 1 from pg_type where typname = 'leave_type') then
    create type public.leave_type as enum ('paid', 'sick', 'unpaid');
  end if;
  if not exists (select 1 from pg_type where typname = 'leave_status') then
    create type public.leave_status as enum ('pending', 'approved', 'rejected');
  end if;
end $$;

-- Create core tables
create table if not exists public.profiles (
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

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  check_in timestamptz,
  check_out timestamptz,
  status public.attendance_status not null default 'present',
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create table if not exists public.leave_requests (
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

create table if not exists public.salary_structures (
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

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.attendance enable row level security;
alter table public.leave_requests enable row level security;
alter table public.salary_structures enable row level security;

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

drop policy if exists "Signed-in users can view profiles" on public.profiles;
create policy "Signed-in users can view profiles"
  on public.profiles for select to authenticated using (true);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update to authenticated using (auth.uid() = id);

drop policy if exists "Admins can update any profile" on public.profiles;
create policy "Admins can update any profile"
  on public.profiles for update to authenticated using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Users can view their own roles" on public.user_roles;
create policy "Users can view their own roles"
  on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

drop policy if exists "Users can view their own attendance, admins view all" on public.attendance;
create policy "Users can view their own attendance, admins view all"
  on public.attendance for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

drop policy if exists "Users can check themselves in, admins can add records" on public.attendance;
create policy "Users can check themselves in, admins can add records"
  on public.attendance for insert to authenticated
  with check (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

drop policy if exists "Users can update their own attendance, admins update all" on public.attendance;
create policy "Users can update their own attendance, admins update all"
  on public.attendance for update to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

drop policy if exists "Users can view their own leave requests, admins view all" on public.leave_requests;
create policy "Users can view their own leave requests, admins view all"
  on public.leave_requests for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

drop policy if exists "Employees can apply for leave" on public.leave_requests;
create policy "Employees can apply for leave"
  on public.leave_requests for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Admins can review leave requests" on public.leave_requests;
create policy "Admins can review leave requests"
  on public.leave_requests for update to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Users can view their own salary, admins view all" on public.salary_structures;
create policy "Users can view their own salary, admins view all"
  on public.salary_structures for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

drop policy if exists "Admins can create salary structures" on public.salary_structures;
create policy "Admins can create salary structures"
  on public.salary_structures for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Admins can update salary structures" on public.salary_structures;
create policy "Admins can update salary structures"
  on public.salary_structures for update to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- Trigger function with 100% fail-proof guards so GoTrue Auth never returns 500
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (to_regclass('public.profiles') is not null) then
    insert into public.profiles (id, employee_id, full_name, email, department, designation)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'employee_id', 'DF-' || upper(substr(new.id::text, 1, 6))),
      coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
      new.email,
      new.raw_user_meta_data->>'department',
      new.raw_user_meta_data->>'designation'
    )
    on conflict (id) do update set
      email = excluded.email,
      full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name);
  end if;

  if (to_regclass('public.user_roles') is not null and to_regtype('public.app_role') is not null) then
    insert into public.user_roles (user_id, role)
    values (
      new.id,
      case when new.raw_user_meta_data->>'role' = 'admin'
        then 'admin'::public.app_role
        else 'employee'::public.app_role
      end
    )
    on conflict (user_id, role) do nothing;
  end if;

  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();