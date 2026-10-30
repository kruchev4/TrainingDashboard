-- Daily Teams digest schedule. Paste into Supabase > SQL Editor after deploying the teams-digest function.
-- Replace YOUR-PROJECT-REF and YOUR_CRON_SECRET (must match the CRON_SECRET secret you set on the function).
-- 12:00 UTC = 8:00 AM Eastern during daylight time (7:00 AM in winter). Weekdays only.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'mhe-teams-digest',
  '0 12 * * 1-5',
  $$
  select net.http_post(
    url     := 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/teams-digest',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'YOUR_CRON_SECRET'),
    body    := '{}'::jsonb
  );
  $$
);

-- To stop it later:   select cron.unschedule('mhe-teams-digest');
-- To check recent runs: select * from cron.job_run_details order by start_time desc limit 10;
