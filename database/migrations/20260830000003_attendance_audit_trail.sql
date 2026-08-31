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
