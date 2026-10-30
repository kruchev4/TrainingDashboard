# MHE Certification Dashboard - setup

## Files (all in the same folder, index.html at the repo root)
index.html, app.js, styles.css, config.js, .nojekyll  (SETUP.md and setup.sql are reference only)

## 1. Publish on GitHub Pages
Upload the files so index.html is at the top of the repo.
Settings > Pages > Deploy from a branch > main > / (root).

Out of the box it runs in "Saved in this browser only" mode. Steps 2-3 turn on shared data.

## 2. Create the shared database (Supabase, free tier)
1. supabase.com > New project. Pick a strong database password and a US region.
2. SQL Editor > New query > paste everything from setup.sql > Run.
3. Authentication > Sign In / Providers > Email: turn OFF "Allow new users to sign up".
   (Only people you add yourself can ever log in.)
4. Authentication > Users > Add user > Create new user. Enter email + password and tick Auto Confirm.
   Repeat for each person who needs access (EHS, trainers, supervisors).

## 3. Connect the dashboard
1. Project Settings > API Keys (or the Connect button). Copy the Project URL and the anon / publishable key.
   NEVER use the service_role / secret key.
2. Edit config.js in GitHub (pencil icon) and paste both values between the quotes. Commit.
3. Wait a minute, hard-refresh (Ctrl+Shift+R). You should see a sign-in page.
4. First sign-in loads sample data. Use "Clear all data" (bottom left) before entering real people.

## Things to know
- The anon key in config.js is meant to be public. Your data is protected by the login + the row-level-security policies in setup.sql.
- Everyone who can sign in can view and edit everything (no separate roles yet).
- Each list (operators, trainers, sessions, catalog) is saved as a whole. If two people save the same list within a few seconds, the later save wins. Other devices refresh live and whenever the tab regains focus.
- Free Supabase projects pause after about 7 days of no activity. Resume from the Supabase dashboard if that happens; data is kept.
- The database holds employee names and IDs. Confirm with IT / HR that a hosted service is acceptable for that data.
- Back up occasionally: Supabase > Table Editor > kv > export CSV.
