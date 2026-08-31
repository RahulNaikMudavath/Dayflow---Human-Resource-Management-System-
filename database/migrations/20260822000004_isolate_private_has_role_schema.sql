-- 1. Private schema for internal helpers, not exposed via the Data API
create schema if not exists private;

create or replace function private.has_role(_user_id uuid, _role public.app_role)
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

-- Lock down direct execution; authenticated keeps EXECUTE only so RLS policies can evaluate it
revoke all on function private.has_role(uuid, public.app_role) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.has_role(uuid, public.app_role) to authenticated;

-- 2. profiles: restrict reads to owner or admin; repoint admin update policy
drop policy "Signed-in users can view profiles" on public.profiles;
create policy "Users can view their own profile, admins view all"
on public.profiles for select to authenticated
using (auth.uid() = id or private.has_role(auth.uid(), 'admin'::public.app_role));

drop policy "Admins can update any profile" on public.profiles;
create policy "Admins can update any profile"
on public.profiles for update to authenticated
using (private.has_role(auth.uid(), 'admin'::public.app_role));

-- 3. user_roles
drop policy "Users can view their own roles" on public.user_roles;
create policy "Users can view their own roles"
on public.user_roles for select to authenticated
using (user_id = auth.uid() or private.has_role(auth.uid(), 'admin'::public.app_role));

-- 4. attendance
drop policy "Users can check themselves in, admins can add records" on public.attendance;
create policy "Users can check themselves in, admins can add records"
on public.attendance for insert to authenticated
with check (user_id = auth.uid() or private.has_role(auth.uid(), 'admin'::public.app_role));

drop policy "Users can update their own attendance, admins update all" on public.attendance;
create policy "Users can update their own attendance, admins update all"
on public.attendance for update to authenticated
using (user_id = auth.uid() or private.has_role(auth.uid(), 'admin'::public.app_role));

drop policy "Users can view their own attendance, admins view all" on public.attendance;
create policy "Users can view their own attendance, admins view all"
on public.attendance for select to authenticated
using (user_id = auth.uid() or private.has_role(auth.uid(), 'admin'::public.app_role));

-- 5. leave_requests
drop policy "Admins can review leave requests" on public.leave_requests;
create policy "Admins can review leave requests"
on public.leave_requests for update to authenticated
using (private.has_role(auth.uid(), 'admin'::public.app_role))
with check (private.has_role(auth.uid(), 'admin'::public.app_role));

drop policy "Users can view their own leave requests, admins view all" on public.leave_requests;
create policy "Users can view their own leave requests, admins view all"
on public.leave_requests for select to authenticated
using (user_id = auth.uid() or private.has_role(auth.uid(), 'admin'::public.app_role));

-- 6. salary_structures
drop policy "Admins can create salary structures" on public.salary_structures;
create policy "Admins can create salary structures"
on public.salary_structures for insert to authenticated
with check (private.has_role(auth.uid(), 'admin'::public.app_role));

drop policy "Admins can update salary structures" on public.salary_structures;
create policy "Admins can update salary structures"
on public.salary_structures for update to authenticated
using (private.has_role(auth.uid(), 'admin'::public.app_role));

drop policy "Users can view their own salary, admins view all" on public.salary_structures;
create policy "Users can view their own salary, admins view all"
on public.salary_structures for select to authenticated
using (user_id = auth.uid() or private.has_role(auth.uid(), 'admin'::public.app_role));

-- 7. Drop the old public function (no policy or client code references it anymore)
drop function public.has_role(uuid, public.app_role);