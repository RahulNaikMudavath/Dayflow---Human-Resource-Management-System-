-- Fix notification spoofing vulnerability
-- 1. Ensure type column exists on notifications table
alter table public.notifications add column if not exists type text default 'system';

-- 2. Drop the overly permissive insert policy on notifications
drop policy if exists "Users and system create notifications" on public.notifications;

-- 2. Restrict notification creation so users can only notify themselves unless they are an admin
create policy "Users and system create notifications" on public.notifications
  for insert to authenticated
  with check (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- 3. Security definer function allowing authenticated users to send notifications to HR Admins
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
