# Google and Apple sign-in

KONO always offers email sign-in (a link or a 6-digit code). **Continue with Google** and **Continue with Apple**
appear under the email form once they're switched on in two places: Supabase, and one setting in Vercel. Until
then they stay hidden, so nobody can tap a button that doesn't work yet. Like email sign-in, they're disabled
until the age and Terms box is ticked. The phone apps keep email sign-in only.

Keys and secrets go into the Google, Apple and Supabase dashboards, never into chat or the repository.

KONO's Supabase callback address (you'll need it below):
`https://ooavktekwoguhttauvte.supabase.co/auth/v1/callback`

## Google (free)

1. In Google Cloud Console, open **APIs & Services › OAuth consent screen**. Set the app name to KONO, your support
   email, and the live site as the home page. Publish it ("In production") so anyone can sign in, not only test users.
2. Open **Credentials › Create credentials › OAuth client ID**. Choose **Web application** and add the callback
   address above under **Authorized redirect URIs**.
3. In Supabase, open **Authentication › Sign In / Providers › Google**. Turn it on and paste the client ID and
   client secret there.

## Apple (needs the Apple Developer Program, $99 a year)

1. In Apple Developer, open **Certificates, Identifiers & Profiles**:
   - **Identifiers › Services IDs**: make one for KONO's website (e.g. `app.kono.study.web`). Turn on **Sign in with
     Apple**, add the live site's domain, and add the callback address above as the return URL.
   - **Keys**: make a key with **Sign in with Apple** and download its `.p8` file. Keep it private.
2. In Supabase, open **Authentication › Sign In / Providers › Apple**. Turn it on and fill in the Services ID, your
   Team ID, the Key ID, and the secret made from the `.p8` key (Supabase's page explains how).

## Both

1. In Supabase, open **Authentication › URL Configuration**. Set **Site URL** to the live site and add it under
   **Redirect URLs**.
2. In Vercel, open **Settings › Environment Variables** and add `VITE_KONO_SIGN_IN_PROVIDERS` with the value
   `google,apple` (or just one of them). Redeploy. The buttons appear on the sign-in page.

Someone who signs in with Google or Apple using the same email as their KONO email account lands in the same
account (Supabase links them by verified email). With Apple's "Hide My Email", it's a separate account.
