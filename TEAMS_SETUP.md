# Teams alerts - setup (about 15 minutes)

Requires the shared-data setup in SETUP.md first (Supabase + login).

How it works: every weekday morning, Supabase runs a small function that reads the dashboard data and posts
a summary card to a Teams channel - overdue recerts, recerts coming due, sessions in the next week, and any
equipment with no authorized trainer. If there is nothing to report, it stays quiet.

## 1. Create the Teams webhook
1. In Teams, open the channel you want the alerts in (a private channel is best if names are included).
2. Click "..." next to the channel > Workflows.
3. Choose the template "Send webhook alerts to a channel", pick the team and channel, and save.
4. Copy the webhook URL it gives you. Treat it like a password: anyone with it can post to the channel.
Notes:
- Microsoft's template names shift occasionally. You need the Workflows (Power Automate) template that
  receives a webhook request and posts to a channel.
- The workflow belongs to whoever creates it. Add a co-owner so it survives someone leaving.
- If Workflows or webhook triggers are blocked in the Jabil tenant, ask IT to allow this one flow.

## 2. Deploy the function
Supabase dashboard > Edge Functions > Deploy a new function > Via Editor.
1. Name it exactly: teams-digest
2. Paste the full contents of edge/teams-digest/index.ts and deploy.
3. Open the function's settings and turn OFF "Verify JWT" (the function checks access itself:
   only the cron secret or a signed-in dashboard user is accepted).

(CLI alternative: supabase functions deploy teams-digest --no-verify-jwt)

## 3. Add the two secrets
Edge Functions > Secrets (or "Manage secrets"):
- TEAMS_WEBHOOK_URL = the URL from step 1
- CRON_SECRET = a long random string you make up (e.g. 40 random characters). Keep a copy for step 5.

## 4. Test it
Dashboard > Teams Alerts > tick "Send the daily Teams digest" > "Save & send test message".
A card marked TEST should appear in the channel within a few seconds. The "Last run" box shows the result.
If it fails, the message says why (function not deployed, secret missing, or Teams rejected the post).

## 5. Schedule it
Supabase > SQL Editor > paste alerts_cron.sql, fill in your project ref (the part before .supabase.co in
your Project URL) and the same CRON_SECRET, and Run.
It runs weekdays at 12:00 UTC (8 AM Eastern in summer, 7 AM in winter).

## Settings in the dashboard
- Include recerts due within N days (overdue is always included)
- Include sessions in the next N days
- Every weekday, or Mondays only
- Include operator names, or counts only

## Things to know
- If "Send the daily Teams digest" is unticked, scheduled runs do nothing (test sends still work).
- The digest uses each item's own recert cycle from the Training Catalog.
- Teams limits each message to 28 KB; long lists are cut to the first 10 per section with a "+N more" line.
- Times use Eastern time for deciding what "today" is.
