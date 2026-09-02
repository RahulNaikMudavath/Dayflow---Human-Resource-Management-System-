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
