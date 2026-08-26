-- Fix self-signup role selection security vulnerability
-- 1. Update handle_new_user() trigger function to always default new users to 'employee'
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

-- 2. Add security definer function for admin-only user promotion
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
