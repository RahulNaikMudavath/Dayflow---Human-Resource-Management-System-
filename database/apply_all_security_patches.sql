-- =========================================================
-- DAYFLOW HRMS CONSOLIDATED SECURITY MIGRATION BUNDLE
-- Target Supabase Project: https://isepfflfkkremsbnacvs.supabase.co
-- Run this SQL in the Supabase SQL Editor (Dashboard -> SQL Editor)
-- =========================================================

-- --- FILE: 20260825000000_fix_signup_role_security.sql ---
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


-- --- FILE: 20260825000001_fix_anon_profile_leak.sql ---
-- Fix RLS policy profile data leak to unauthenticated users
-- 1. Drop the overly permissive anon select policy on profiles
drop policy if exists "Unauthenticated users can verify emails for password reset" on public.profiles;

-- 2. Create security definer function for email existence check during password reset
DROP FUNCTION IF EXISTS public.check_email_exists(text);
DROP FUNCTION IF EXISTS public.check_email_exists(text, text);

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


-- --- FILE: 20260825000002_fix_notification_spoofing.sql ---
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


-- --- FILE: 20260828000000_email_notification_triggers.sql ---
-- Migration: 20260828000000_email_notification_triggers.sql
-- Description: Automated Email Notification Triggers & Webhook Handlers for Supabase

-- 1. Create a helper function to send email dispatch events via pg_net HTTP extension
CREATE OR REPLACE FUNCTION public.handle_email_notification_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_recipient_email TEXT;
  v_recipient_name TEXT;
BEGIN
  -- Retrieve profile email & full name for the target user
  SELECT email, full_name INTO v_recipient_email, v_recipient_name
  FROM public.profiles
  WHERE id = NEW.user_id;

  IF v_recipient_email IS NOT NULL THEN
    -- Log email trigger event into Postgres notice for audit trail
    RAISE NOTICE 'Dispatching Email Trigger for Notification [%] to % (%)', NEW.id, v_recipient_name, v_recipient_email;

    -- NOTE: In production Supabase setup with pg_net extension enabled,
    -- uncomment the HTTP POST request below to trigger your Resend / SendGrid webhook endpoint:
    /*
    PERFORM net.http_post(
      url := 'https://api.resend.com/emails',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.resend_api_key', true)
      ),
      body := jsonb_build_object(
        'from', 'Dayflow HR <notifications@dayflow.io>',
        'to', jsonb_build_array(v_recipient_email),
        'subject', NEW.title,
        'html', '<div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;"><h2 style="color: #d95d28;">' || NEW.title || '</h2><p>' || NEW.message || '</p><hr/><p style="color: #64748b; font-size: 12px;">Dayflow HR Automated Notification</p></div>'
      )
    );
    */
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Attach trigger to notifications table
DROP TRIGGER IF EXISTS tr_dispatch_email_on_notification ON public.notifications;
CREATE TRIGGER tr_dispatch_email_on_notification
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_email_notification_trigger();

-- 3. Document Webhook Configuration
COMMENT ON FUNCTION public.handle_email_notification_trigger IS 'Automated Supabase Email Webhook Trigger for Leave Approval, Rejection, and User Registration alerts.';


-- --- FILE: 20260830000000_rate_limit_email_checks.sql ---
-- Migration: 20260830000000_rate_limit_email_checks.sql
-- Description: Rate-limit and security harden check_email_exists to prevent email enumeration attacks

-- 1. Create rate limiting table for public API calls
CREATE TABLE IF NOT EXISTS public.email_check_rate_limits (
  client_key TEXT PRIMARY KEY,
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS and restrict access to service role / security definer functions only
ALTER TABLE public.email_check_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_check_rate_limits FROM PUBLIC, ANON, AUTHENTICATED;
GRANT ALL ON public.email_check_rate_limits TO SERVICE_ROLE;

-- 2. Update check_email_exists with a strict rate limiter (max 5 checks per minute window per client)
DROP FUNCTION IF EXISTS public.check_email_exists(text);
DROP FUNCTION IF EXISTS public.check_email_exists(text, text);

CREATE OR REPLACE FUNCTION public.check_email_exists(_email TEXT, _client_key TEXT DEFAULT 'anonymous')
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_start TIMESTAMPTZ;
BEGIN
  -- Cleanup old rate limit windows (older than 10 minutes)
  DELETE FROM public.email_check_rate_limits
  WHERE window_start < NOW() - INTERVAL '10 minutes';

  -- Check existing rate limit record for caller
  SELECT request_count, window_start INTO v_count, v_start
  FROM public.email_check_rate_limits
  WHERE client_key = _client_key;

  IF v_start IS NULL OR v_start < NOW() - INTERVAL '1 minute' THEN
    -- First request or window expired: reset counter
    INSERT INTO public.email_check_rate_limits (client_key, request_count, window_start)
    VALUES (_client_key, 1, NOW())
    ON CONFLICT (client_key) DO UPDATE
    SET request_count = 1, window_start = NOW();
  ELSE
    -- Within active 1-minute window
    IF v_count >= 5 THEN
      RAISE EXCEPTION 'Rate limit exceeded: Too many password reset email verification attempts. Please wait 60 seconds before trying again.'
        USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.email_check_rate_limits
    SET request_count = request_count + 1
    WHERE client_key = _client_key;
  END IF;

  -- Return email existence check
  RETURN EXISTS (
    SELECT 1 FROM public.profiles WHERE LOWER(email) = LOWER(_email)
  );
END;
$$;

-- Grant execution to anon and authenticated
GRANT EXECUTE ON FUNCTION public.check_email_exists(TEXT, TEXT) TO ANON, AUTHENTICATED;

COMMENT ON FUNCTION public.check_email_exists IS 'Security definer function to check email existence for password reset, throttled to 5 requests/minute per client key.';


-- --- FILE: 20260830000001_lockdown_profile_fields.sql ---
-- Migration: 20260830000001_lockdown_profile_fields.sql
-- Description: Database-level column enforcement preventing non-admin users from tampering with HR fields

CREATE OR REPLACE FUNCTION public.enforce_profile_update_security()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow system / trigger contexts (e.g., handle_new_user() system execution)
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- If the user performing the update is NOT an HR admin
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    -- Block non-admin updates to HR-controlled fields
    IF NEW.employee_id IS DISTINCT FROM OLD.employee_id THEN
      RAISE EXCEPTION 'Unauthorized: Only HR Admins can modify employee_id.' USING ERRCODE = '42501';
    END IF;

    IF NEW.department IS DISTINCT FROM OLD.department THEN
      RAISE EXCEPTION 'Unauthorized: Only HR Admins can modify department.' USING ERRCODE = '42501';
    END IF;

    IF NEW.designation IS DISTINCT FROM OLD.designation THEN
      RAISE EXCEPTION 'Unauthorized: Only HR Admins can modify designation.' USING ERRCODE = '42501';
    END IF;

    IF NEW.date_of_joining IS DISTINCT FROM OLD.date_of_joining THEN
      RAISE EXCEPTION 'Unauthorized: Only HR Admins can modify date_of_joining.' USING ERRCODE = '42501';
    END IF;

    IF NEW.email IS DISTINCT FROM OLD.email THEN
      RAISE EXCEPTION 'Unauthorized: Only HR Admins can modify email.' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger to public.profiles table
DROP TRIGGER IF EXISTS tr_enforce_profile_update_security ON public.profiles;
CREATE TRIGGER tr_enforce_profile_update_security
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_profile_update_security();

COMMENT ON FUNCTION public.enforce_profile_update_security IS 'BEFORE UPDATE trigger enforcing DB-level column restrictions so non-admins can only modify safe personal fields (phone, address, avatar_url, full_name).';


-- --- FILE: 20260830000002_salary_structure_constraints.sql ---
-- Migration: 20260830000002_salary_structure_constraints.sql
-- Description: Add database-level check constraints to salary_structures table ensuring non-negative amounts

ALTER TABLE public.salary_structures
  DROP CONSTRAINT IF EXISTS check_salary_basic_non_negative,
  DROP CONSTRAINT IF EXISTS check_salary_hra_non_negative,
  DROP CONSTRAINT IF EXISTS check_salary_allowances_non_negative,
  DROP CONSTRAINT IF EXISTS check_salary_deductions_non_negative;

ALTER TABLE public.salary_structures
  ADD CONSTRAINT check_salary_basic_non_negative CHECK (basic >= 0),
  ADD CONSTRAINT check_salary_hra_non_negative CHECK (hra >= 0),
  ADD CONSTRAINT check_salary_allowances_non_negative CHECK (allowances >= 0),
  ADD CONSTRAINT check_salary_deductions_non_negative CHECK (deductions >= 0);

COMMENT ON CONSTRAINT check_salary_basic_non_negative ON public.salary_structures IS 'Ensures basic salary is non-negative.';
COMMENT ON CONSTRAINT check_salary_hra_non_negative ON public.salary_structures IS 'Ensures HRA is non-negative.';
COMMENT ON CONSTRAINT check_salary_allowances_non_negative ON public.salary_structures IS 'Ensures allowances are non-negative.';
COMMENT ON CONSTRAINT check_salary_deductions_non_negative ON public.salary_structures IS 'Ensures deductions are non-negative.';


-- --- FILE: 20260830000003_attendance_audit_trail.sql ---
-- Migration: 20260830000003_attendance_audit_trail.sql
-- Description: Add audit trail columns (updated_by, updated_at) to attendance table and auto-update trigger

-- 1. Add audit columns to attendance table
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- 2. Automatic trigger to manage updated_at timestamp on record updates
CREATE OR REPLACE FUNCTION public.handle_attendance_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_attendance_updated_at ON public.attendance;
CREATE TRIGGER tr_attendance_updated_at
  BEFORE UPDATE ON public.attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_attendance_updated_at();

COMMENT ON COLUMN public.attendance.updated_by IS 'Profile ID of the user or HR Admin who last updated or corrected this attendance record.';
COMMENT ON COLUMN public.attendance.updated_at IS 'Timestamp when this attendance record was last updated.';


