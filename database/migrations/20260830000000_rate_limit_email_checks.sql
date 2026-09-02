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
