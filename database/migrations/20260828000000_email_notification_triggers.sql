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
        'from', 'Dayflow HR Management <notifications@dayflow.io>',
        'to', jsonb_build_array(v_recipient_email),
        'subject', NEW.title,
        'html', '<div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;"><h2 style="color: #d95d28;">' || NEW.title || '</h2><p>' || NEW.message || '</p><hr/><p style="color: #64748b; font-size: 12px;">Dayflow HR Management System Automated Notification</p></div>'
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
COMMENT ON FUNCTION public.handle_email_notification_trigger IS 'Automated Dayflow HR Management System Email Webhook Trigger for Leave Approval, Rejection, and User Registration alerts.';
