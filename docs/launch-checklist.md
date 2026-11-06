# KONO launch checklist

Ready to verify (checked November 2026, each with the tests that show it):

- [x] Complete a task, reopen it, reload, and inspect progress for every plan.
  Evidence: e2e `launch check: in every plan, finishing a task…` (a parent plan and a kid's plan: counted once, still once after a reload, the other plan untouched); unit `repeated reopen complete delete restore never awards the same task twice`, `reopening all work preserves ledger and merges new third-device credits`.
- [x] Create/edit a note and exam; switch plans while editing. No record should move to another plan.
  Evidence: e2e `launch check: switching plans with a note half-edited…` (the note stays in its plan; the exam editor is modal, so a switch can't happen under it); unit `profile guard blocks other-profile records, progress, navigation, and settings`. The editor also refuses to save into a changed plan ("Your profile changed. Reopen the editor.").
- [x] Simultaneously edit different records on two devices; then edit the same field and confirm an explicit conflict.
  Evidence: e2e `Two devices: each adds something while one is offline…` (the conflict banner and "Keep this device's version"); unit `two devices: different records edited on each both keep their change; the same field changed to two different values is a conflict that asks` (new) and `two devices: lists of dates and people merge item by item…`.
- [x] Lose a save response, reconnect, and confirm no duplicate credits or false reset conflicts.
  Evidence: unit `identical reset snapshots reconcile after a lost PUT acknowledgement`, `identical reset merges converge on the same epoch`, `server checks account binding on plans and histories, plus CSRF and idempotency`, `late cloud response after dispose never writes or publishes`.
- [x] Sign into B in another tab while A is open; A's requests must be rejected.
  Evidence: unit `session switch between accounts is rejected before GET or PUT touches B`, `sign-out invalidates queued edits and cloud selection`, `SQL CAS rejects stale writes/deletes and keeps owner histories separate`.
- [x] Delete cloud study data, reopen an old offline tab, and confirm no resurrection.
  Evidence: unit `account deletion invalidates queued old snapshots`, `ordinary remote deletion clears clean cache and never reuploads`, `remote deletion conflicts with pending work instead of resurrecting it`.
- [x] Export, inspect import counts, restore, and download an older revision.
  Evidence: e2e `launch check: backups: Export, then Import shows what's in it…` (the counts match the file, Use this backup restores it, and an older cloud revision downloads and restores); e2e `the backup export contains the plan`.
- [x] Simulate unavailable browser storage; keep the unsaved draft visible and exportable.
  Evidence: e2e `launch check: if this browser can't store anything mid-edit…` (the editor stays open with the draft, and the new "⬇ Download a backup with this draft" button gives an importable backup with it); unit `repeated cache failure preserves unsaved draft until durable retry succeeds`. With storage blocked from the start, KONO shows "We couldn't open your saved plan" with Download a copy, and saves over nothing.
- [x] Test all phases/stages, including rapid phase changes, one failed PNG, retry and leaving the map while it is offscreen.
  Evidence: unit `test_scene_loading.cjs`: `Every manual boot requests exactly one phase…`, `A -> B -> A never commits stale B`, `A -> B -> C serializes batches and commits only C`, `Missing runtime image blocks switch, suppresses retry loop, retry fetches one image`, `DESTROY invalidates pending phase completion`; e2e `Sanctuary: the island draws, zooms, expands and changes time…`.
- [x] Test keyboard search, Sanctuary actions, relaxed fishing, motion preferences, one music stream and mobile layouts.
  Evidence: e2e `Today in time order, Settings search and search filters`, `keyboard: K-Quiz practice questions and flashcards keep focus inside…`, `Sanctuary: the island draws, zooms…`, `launch check: one song at a time…` (KONO's music now pauses while a game plays its own; found and fixed here), the same test for Reduce Motion, and `phone-sized screens…`, `iPhone SE…`, `Phone check-up: on a 375px phone…`. Relaxed fishing isn't a feature in this build, so there's nothing to test.

Release decisions:

- [x] Sign-in method confirmed: email (link or code), Google and Apple. Google and Apple are built and hidden until set up; see [sign-in-providers.md](sign-in-providers.md). Apple needs the Apple Developer Program ($99 a year).
- [x] Launch audience and public/private access approved: a public website. Anyone can sign up, and shared links show a KONO preview card.
- [ ] Real-device and production identity/database checks recorded.
- [x] Support contact and privacy/retention wording approved: the owner is the support contact, and Settings › Privacy & storage stays as written. Asset licensing: still to confirm (the art, music and fonts KONO ships).
- [x] Figma/Trello connections: Figma wanted (connect it at claude.ai › Customize › Connectors and use it from a new session). Trello skipped; this checklist is the launch tracker.

Each external tracker card should include reproduction steps, expected result, owner, test evidence and date. Suggested lists: Launch blockers, Ready to build, In progress, Ready for QA, Verified. Do not mark a card Verified based only on implementation.
