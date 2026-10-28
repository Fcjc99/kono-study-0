import type { CapacitorConfig } from '@capacitor/cli'

/** KONO's iPhone and Android apps (docs/app-store.md): the native shell opens KONO's live website,
 * so sign-in, sync and the server functions work exactly as on the web, and adds what a website
 * can't do: home-screen widgets, a Live Activity for focus sessions, and reminders scheduled on the
 * phone itself. Set KONO_APP_URL to the live site (https://…) before `npx cap sync`. */
const url = process.env.KONO_APP_URL?.trim()
if (url && !/^https:\/\/[^/]+\/?$/.test(url)) throw Error('KONO_APP_URL must be the site’s https:// address, like https://kono.example.com')

const config: CapacitorConfig = {
  appId: process.env.KONO_APP_ID?.trim() || 'app.kono.study',
  appName: 'KONO',
  // Only shown if the live site can't be reached (the app opens KONO's website, it doesn't carry a copy).
  webDir: 'native/shell',
  server: url ? { url, cleartext: false, errorPath: 'index.html' } : undefined,
  // Service workers (offline KONO) in the iPhone app need the site listed as an app-bound domain.
  ios: { limitsNavigationsToAppBoundDomains: true, contentInset: 'never', backgroundColor: '#fbf3ea' },
  android: { backgroundColor: '#fbf3ea' },
  plugins: {
    LocalNotifications: { smallIcon: 'ic_stat_kono', iconColor: '#e0607a' },
  },
}

export default config
