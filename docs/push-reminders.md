# Turning on lock-screen reminders

KONO can send reminders to a phone's lock screen ("Bio quiz tomorrow", "Essay due today", "Class in 10 minutes"),
even when KONO isn't open. The code is all in place (`api/push.ts`, `api/push-send.ts`, `src/store/pushSender.ts`,
`supabase/migrations/0008_kono_push_reminders.sql`). Until the server has its keys, Settings › Notifications says
the server isn't set up yet, and no reminder is sent.

Secrets go only into the Vercel and Supabase dashboards, never into chat or the repository.

## 1. Supabase: the reminder tables and the 5-minute timer

In the Supabase dashboard, open **SQL Editor**:

1. If **Table Editor** has no `kono_push_queue` table, paste and run all of
   `supabase/migrations/0008_kono_push_reminders.sql`. It's safe to run again.
2. Run this, with your live KONO address:
   `update public.kono_push_settings set site_url = 'https://YOUR-KONO-SITE' where id = 1;`
3. Run `select secret from public.kono_push_settings;` and keep the value for step 2.4. It's a password: don't
   share it.

## 2. Vercel: the keys

1. Make a key pair once, on a computer with Node: `npx web-push generate-vapid-keys`. It prints a public key and a
   private key.
2. In Vercel, open **KONO › Settings › Environment Variables** and add, for Production:
   - `VAPID_PUBLIC_KEY`: the public key
   - `VAPID_PRIVATE_KEY`: the private key
   - `VAPID_SUBJECT`: `mailto:` followed by your email (push services use it as a contact)
   - `PUSH_CRON_SECRET`: the secret from step 1.3
3. Redeploy: **Deployments ›** the latest **› ⋯ › Redeploy**.

## 3. Check it

On a phone, sign in to KONO, open **Settings › Notifications** and turn reminders on. On an iPhone, add KONO to the
Home Screen first: iPhones only send web reminders to Home Screen apps. Add something due in a few minutes. The
reminder should arrive within about 5 minutes.

Once the Vercel and Supabase plugins are installed, a Claude session can do the checks and steps 1–2 for you,
without the keys passing through chat.
