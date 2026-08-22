
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text,
  kind text not null default 'general',
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_unread_idx on public.notifications (user_id, created_at desc) where read_at is null;

grant select, update on public.notifications to authenticated;
grant all on public.notifications to service_role;

alter table public.notifications enable row level security;

create policy "Users can view their own notifications"
  on public.notifications for select to authenticated
  using (user_id = auth.uid());

create policy "Users can mark their own notifications read"
  on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function private.notify_admins(_title text, _body text, _kind text, _link text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, title, body, kind, link)
  select ur.user_id, _title, _body, _kind, _link
  from public.user_roles ur
  where ur.role = 'admin';
end;
$$;

create or replace function private.notify_on_leave_requested()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _name text;
begin
  select full_name into _name from public.profiles where id = new.user_id;
  perform private.notify_admins(
    'New leave request',
    coalesce(_name, 'An employee') || ' requested ' || new.leave_type || ' leave (' ||
      to_char(new.start_date, 'DD Mon') || ' to ' || to_char(new.end_date, 'DD Mon') || ').',
    'leave',
    '/leave'
  );
  return new;
end;
$$;

create or replace function private.notify_on_leave_reviewed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'pending' and new.status in ('approved', 'rejected') then
    insert into public.notifications (user_id, title, body, kind, link)
    values (
      new.user_id,
      case when new.status = 'approved' then 'Leave approved' else 'Leave rejected' end,
      'Your ' || new.leave_type || ' leave (' || to_char(new.start_date, 'DD Mon') || ' to ' ||
        to_char(new.end_date, 'DD Mon') || ') was ' || new.status ||
        coalesce('. Reviewer note: ' || new.reviewer_comment, '.'),
      'leave',
      '/leave'
    );
  end if;
  return new;
end;
$$;

create or replace function private.notify_on_salary_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, title, body, kind, link)
  values (
    new.user_id,
    'Payroll updated',
    'Your salary structure was updated, effective ' || to_char(new.effective_from, 'DD Mon YYYY') || '.',
    'payroll',
    '/payroll'
  );
  return new;
end;
$$;

create or replace function private.notify_on_check_in()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _name text;
begin
  if new.check_in is not null and (tg_op = 'INSERT' or old.check_in is null) then
    select full_name into _name from public.profiles where id = new.user_id;
    perform private.notify_admins(
      'Employee checked in',
      coalesce(_name, 'An employee') || ' checked in at ' ||
        to_char(new.check_in at time zone 'Asia/Kolkata', 'HH24:MI') || '.',
      'attendance',
      '/attendance'
    );
  end if;
  return new;
end;
$$;

revoke execute on function private.notify_admins(text, text, text, text) from public, anon, authenticated;
revoke execute on function private.notify_on_leave_requested() from public, anon, authenticated;
revoke execute on function private.notify_on_leave_reviewed() from public, anon, authenticated;
revoke execute on function private.notify_on_salary_changed() from public, anon, authenticated;
revoke execute on function private.notify_on_check_in() from public, anon, authenticated;

create trigger on_leave_requested_notify
  after insert on public.leave_requests
  for each row execute function private.notify_on_leave_requested();

create trigger on_leave_reviewed_notify
  after update of status on public.leave_requests
  for each row execute function private.notify_on_leave_reviewed();

create trigger on_salary_changed_notify
  after insert or update on public.salary_structures
  for each row execute function private.notify_on_salary_changed();

create trigger on_check_in_notify
  after insert or update of check_in on public.attendance
  for each row execute function private.notify_on_check_in();

alter publication supabase_realtime add table public.notifications;
