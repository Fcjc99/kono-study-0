# KONO production readiness plan

The first release must support multiple authenticated users across devices. The current app is a local browser planner and does not meet that release requirement. The gates below must pass before general release.

This plan consolidates [data-readiness-review.md](./data-readiness-review.md) and [review.md](./review.md). It records proposed work only: **none of these production-readiness fixes was implemented in this turn, no backend provider has been selected, and no accounts or services have been provisioned.** The separate terrace/mascot visual fixes were completed locally as build 22.8.7; see [verification-22.8.7.md](./verification-22.8.7.md). No hosted deployment was made.

## Evidence and limits

- **Confirmed in isolated reproductions:** actual transpiled Notes/Exams components move an edited record from profile A to B after a profile switch; corrupt-save fallback followed by the mount-save operation replaces the failed payload with seed data; Restore Summer can show zero credits then resurrect 45 credits after one completion. The note/exam HTML sink retains event attributes unchanged. These probes use fake hooks and memory storage; no untrusted HTML was executed in a browser and no user data was changed.
- **Confirmed local measurements:** the actual preload method registers 429 textures from 414 unique image URLs totaling 162,689,184 encoded bytes. Their calculated RGBA pixel footprint is 505,083,388 bytes; this is not measured browser heap or GPU usage. All referenced files existed in the audited snapshot. Existing dist contained approximately 599 MB, including obsolete public assets.
- **Source-based risks requiring browser/integration tests:** uncaught storage failures, stale-tab overwrites, sleeping Phaser games whose queued destruction may never run, startup failure recovery, inaccessible canvas controls, duplicate responsive audio players, ignored OS motion preference, and incomplete command-palette keys. The absence of authentication/server user-data persistence/sync is established by source inspection.
- **Existing checks:** pure progression tests pass. They do not establish application data safety, cross-device correctness, accessibility, mobile performance, or hosted security. Hosted headers, vulnerability status, network startup time, and renderer memory were not verified.

## Gate 1 — Protect existing data and close executable-content paths

Fix the HTML sink (`src/App.tsx:127,263,272`) with plain-text rendering or an explicit rich-text allowlist. Centralize schema validation and guarded persistence; preserve failed payloads and a recoverable last-good copy instead of reseeding over them (`App.tsx:80,145`). Scope editors and writes to the record's owning profile (`App.tsx:224,263,272`), including subject references. Commit task and progression resets together (`App.tsx:330`); make bulk completion timestamps consistent with the intended active-day rule (`App.tsx:161`).

Acceptance criteria:

- Harmless security fixtures containing event attributes, script URLs, SVG, and malformed markup cannot execute; approved formatting still works.
- Corrupt/empty/malformed saves, blocked storage, and quota errors preserve recoverable data and show an actionable save/recovery state. No failed load silently overwrites the saved payload.
- Switching profiles during every editor or undo flow cannot move, modify, or attach data to another profile. Restore→complete-one behaves identically before and after reload; duplicate completion earns no extra credit.
- Validated export/import round trips preserve the promised data, including schedules, progression, and per-profile side statistics. Destructive restore has a recovery path.

## Gate 2 — Authenticated per-user server data, synchronization, and migration

Select the backend/authentication provider before provisioning. Define an account owner above organizational profiles, versioned records, server-enforced ownership, session handling, and backup/restore responsibilities. Implement server persistence for the planner's user data, authenticated synchronization, and explicit concurrency/offline behavior. A profile selector alone is not an authorization boundary.

Migrate existing browser saves through a preview and confirmed association with the signed-in account. Keep a local recovery copy; make migration versioned, resumable, and idempotent. Define conflict handling for concurrent edits, completion events, deletes, restores, and offline queues; do not replace another device's current dataset with a stale snapshot.

Acceptance criteria:

- Sign-in, sign-out, recovery, expired-session, and revoked-session flows work. User A cannot read or write user B's records through direct requests or guessed identifiers. All persistent user tables enforce ownership server-side.
- Two devices and two tabs under one account converge after disjoint edits, conflicting edits, offline edits, reconnects, deletes, and task completion. Retries produce neither duplicates nor extra progression credit, and unresolved conflicts are visible.
- Sign-out/account switching does not expose the previous account's cached data. Local data migration can be retried without duplicating records or losing the original; migration failure leaves both recovery data and account data consistent.
- Device loss can be recovered from authenticated server data, and backup restoration is exercised with fixtures.

## Gate 3 — Bounded asset loading and complete game cleanup

Load the current phase/stage first and defer other artwork; select a mobile water/texture budget before allocating textures (`Stage0Scene.ts:117`, `FluidSystem.ts:30`). Remove duplicate texture registrations and keep archival inputs outside the deployable asset set. Ensure an offscreen game's queued destruction actually runs (`GardenCard.tsx:229,270`; installed Phaser `Game.js:712,729`). Add boot/load error states, retry, a static fallback, and capability checks.

Acceptance criteria:

- An agreed startup/texture budget is enforced in build checks and passes cold-load tests on representative mobile devices and constrained networks. Opening the planner does not require loading every phase and evolution stage.
- Repeated visible/offscreen navigation produces exactly one Phaser destruction event per unmount; listeners, canvases, and renderer allocations do not accumulate.
- Failed chunks/images, unavailable observers/rendering, background/resume, resize, and context loss produce recoverable UI. Asset-reference validation and archive-exclusion checks pass.

## Gate 4 — Complete keyboard, mobile, and core-flow verification

Expose Sanctuary landmark/actions through accessible DOM controls, complete command-palette keyboard behavior, and respect OS reduced-motion preferences. Own one audio player across responsive layouts. Exercise the whole product with realistic account/profile fixtures, including advertised create/edit/delete/undo flows, schedules, notes, exams, assignment completion, restore, and migration. Implement reminders if retained as a release feature; otherwise correct the current promise.

Acceptance criteria:

- Keyboard-only and screen-reader users can reach and operate every advertised action, including Sanctuary dialogs; focus returns correctly and never becomes trapped unintentionally.
- Core flows pass on supported desktop and mobile browsers, at zoom and narrow widths, with touch, virtual keyboards, empty profiles, long content, invalid dates, reduced motion, and responsive changes during audio playback.
- End-to-end tests cover two accounts and two devices, save failures, refresh/resume, account/profile switching mid-edit, deletion/undo, and resets. No critical console errors or unexplained blank states remain.

## Gate 5 — Release operations and privacy

Define supported clients, production/staging separation, deployment rollback, database migration rollback, monitoring, recovery ownership, and support procedures. Review dependencies and actual hosted headers/configuration. Replace personal seeded identity/routine data with approved onboarding defaults. Document weather/location requests, external fonts, retention, account/data deletion, exports, and the intended user age audience; obtain the appropriate privacy review for that audience.

Acceptance criteria:

- Release checks, security/dependency review, backup restoration, schema migration, and application rollback are demonstrated in staging; operational owners and escalation procedures are documented.
- Monitoring detects failed saves/sync/auth/boot operations without logging private notes or credentials. Secrets stay outside client bundles and access is restricted appropriately.
- Privacy notices match actual collection and third parties. Export and deletion work across server data, local caches, and the documented backup-retention policy. Production contains no unintended personal seed data.

Release approval requires recorded evidence for every gate. Visual QA remains part of the final product checks, alongside these unresolved data, service, accessibility, and operational requirements.
