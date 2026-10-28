# KONO on the App Store and Google Play

KONO's phone apps are a native shell (Capacitor) around the live KONO website: sign-in, sync, Canvas and everything else work exactly as on the web, and every website update reaches the apps right away, with no app update needed. The shell adds what a website can't do:

| | iPhone | Android |
|---|---|---|
| Home-screen widgets: **Next up** (what to work on, today's count) and **KONO** (mood and needs) | ✅ | ✅ (one widget with both) |
| Focus session on the lock screen and Dynamic Island (Live Activity) | ✅ | — |
| Reminders scheduled on the phone itself (lock-screen reminders from the website don't reach an app) | ✅ | ✅ |

What's in the repo:
- `capacitor.config.ts`: the app's settings. The app opens `KONO_APP_URL`.
- `ios/` and `android/`: the native projects.
- `src/native.ts`, `src/store/nativeBridge.ts`, `src/hooks/useNativeApp.ts`: the web side, which does nothing on the web.
- `ios/App/App/KonoWidgetPlugin.swift`, `ios/App/KONOWidget/`, `android/app/src/main/java/app/kono/study/`: the widgets and the bridge to them.

> These native projects were written without a Mac or the Android SDK, so they have **not been built yet**. Expect a small fix or two on the first build in Xcode and Android Studio.

## You'll need

- A Mac with Xcode 16 or newer (iPhone), and/or Android Studio (Android).
- An Apple Developer account ($99/year) and/or a Google Play Console account ($25 once).
- KONO's live web address, e.g. `https://kono.example.com`.
- Optionally, your own app ID instead of `app.kono.study`, set in `KONO_APP_ID`. Pick it once; it can't change after the first release.

## 1. Sync

```sh
npm install
KONO_APP_URL=https://your-kono-site npm run app:sync
```

This writes the address into both apps, lists it as the iPhone app's app-bound domain (needed for offline KONO in the app), and copies the plugins in. Run it again whenever `capacitor.config.ts` or a Capacitor plugin changes.

## 2. iPhone (Xcode)

1. `npx cap open ios`.
2. **App target › Signing & Capabilities**: pick your team. Add **App Groups** → `group.app.kono.study` (if you changed the app ID, use `group.<your id>` and change `KonoShared.appGroup` in `ios/App/App/FocusAttributes.swift` to match). Add **Push Notifications** only if you add server push later; local reminders don't need it.
3. **Add the widget extension**: File › New › Target › **Widget Extension**. Name it `KONOWidget` and tick **Include Live Activity**. Don't tick configuration intent. Activate the scheme if asked.
   - Delete the Swift files Xcode generated in the new KONOWidget folder, then drag in `ios/App/KONOWidget/KONOWidget.swift` (target: KONOWidget only).
   - Select `ios/App/App/FocusAttributes.swift` and, in the File inspector, tick **both** App and KONOWidget under Target Membership.
   - KONOWidget target › General: set **Minimum Deployments** to iOS 17.0.
   - KONOWidget target › Signing & Capabilities: the same team, and **App Groups** → the same group.
   - Optional: add a KONO picture to the KONOWidget's Assets named `kono` (e.g. `public/garden/kono/happy.png`). Without it the widget shows KONO's mood as an emoji.
4. App icon: replace `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png` with a 1024 × 1024 KONO icon.
5. Run on your iPhone, then add the widgets from the home screen (long-press › Edit › Add Widget › KONO). Start a focus session and lock the phone to see the Live Activity.
6. Product › Archive › Distribute App to send it to App Store Connect and TestFlight.

## 3. Android (Android Studio)

1. `npx cap open android`, let Gradle sync, and run on a phone.
2. App icon: right-click `app/src/main/res` › New › Image Asset.
3. Long-press the home screen › Widgets › KONO to add the widget.
4. Build › Generate Signed App Bundle, then upload the `.aab` to the Play Console.

## Store review notes

- Apple turns away apps that are "just a website". KONO's widgets, Live Activity and on-phone reminders are the native features to mention in App Review notes.
- KONO is used by students under 13 with a parent. In App Store Connect, answer the age rating and **Kids** questions honestly, and fill in App Privacy (what's collected: account email, plan data; no tracking). Google Play's Families policy asks the same.
- Privacy policy and support URLs are required: use KONO's existing pages.
