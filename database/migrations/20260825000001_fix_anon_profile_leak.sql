-- Fix RLS policy profile data leak to unauthenticated users
-- 1. Drop the overly permissive anon select policy on profiles
drop policy if exists "Unauthenticated users can verify emails for password reset" on public.profiles;

-- 2. Create security definer function for email existence check during password reset
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
