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
