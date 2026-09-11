# KONO 22.8.8 — release candidate

This release candidate preserves the 22.8.7 native-colour terrace maps and larger shaded mascot. It is not a public-launch certificate.

## Implemented

- Server-backed personal accounts using Sites' ChatGPT identity and D1. Every plan/history request checks both trusted identity and the account the tab expects.
- Revision-checked saves, three-way conflict handling, deletion tombstones, reset epochs, and account-bound queued work. A stale tab cannot silently recreate deleted cloud data or upload into a newly signed-in account.
- Validated local recovery cache, cross-tab transactions, explicit legacy-plan migration, backup export/import preview, five local recovery snapshots and twenty cloud revisions.
- Safe React rendering for note/exam formatting; arbitrary pasted markup is escaped.
- Profile-keyed editors and guarded note/exam saves. Failed writes keep the editor's draft.
- Real completion timestamps, local calendar dates, deterministic progression merges, and an explicit per-plan reset.
- Personal onboarding, daily priorities, quick tasks, progress explanations, an optional focused task/notes/timer view, grouped settings navigation and visible build/save status.
- Native keyboard search dialog, accessible Sanctuary actions, relaxed fishing timing, system reduced-motion preference, one shared ambient player and truthful single-track controls.
- Current-phase asset loading with all evolution stages, atomic phase switches, retry/error UI, observer fallbacks, and complete offscreen-game teardown.
- Worker security headers, same-origin write checks, owned backup history, schema migrations and a single release-check command.

## Verification

Run Node 24 and npm from the project folder:

```
npm install
npm run check
npm audit
npm run dev
```

`check` runs lint, TypeScript/client/Worker builds, twenty data-safety regression groups, safe-note rendering and calendar-countdown tests, progression/lighting tests and eight actual-scene loader/lifecycle cases. Scene tests use a mocked renderer; they are not a substitute for browser checks.

Browser smoke checks on the actual KONO folder verified build 22.8.8, fresh onboarding, subject/task creation and completion, note/exam saves, refresh persistence, escaped pasted markup, keyboard page search, local test sign-in and explicit migration, and revision-history listing. The separate localhost test plan does not alter the user's existing 127.0.0.1 device plan. Stage 0 and 5 and all phase transitions were exercised, with stage 5 evening/night screenshots inspected. A 390-pixel layout check showed no page-width overflow. These checks produced no browser warnings/errors; they do not certify every animation or real mobile hardware.

The public asset allowlist packages 417 source assets, including all four phases. The complete built client is about 171 MB. First-phase texture downloads are about 39–44 MB versus the previous 163 MB. Visiting all phases eventually loads their textures; this is not a claim of a smaller peak GPU footprint.

Development sign-in uses the Sites plugin's local test account. It is not a real ChatGPT login and does not prove production authentication. Local SQLite is kept in ignored `.dev/kono.sqlite`; hosted persistence uses D1.

## Remaining launch gates

- Confirm ChatGPT sign-in is the desired public product experience, or approve a supported alternative identity service.
- Choose the exact launch audience. The existing hosted site remains owner-only; no public access, credentials, domains or deployment are changed by this source update.
- Deploy and verify platform identity-header stripping, two real accounts on two real devices, cookies/sign-out, and hosted database restoration.
- Test real mobile Safari/Android, slow/offline networks, memory pressure and long animation sessions. The initial art payload is still substantial.
- Fishing/interaction mini-game statistics retain their existing device-local storage. Study plans and earned Sanctuary evolution are the cloud-backed records in this candidate.
- The full planner still uses some native browser prompts/confirmations; validate all remaining forms with assistive technology before claiming comprehensive accessibility conformance.
- Confirm support contact, retention/privacy wording, backups, incident procedure, and artwork/music licensing for the intended audience.

Do not label the product production-ready solely because the release command is green.

## Plugin use and boundaries

Sites supplies the hosting/auth/database workflow; browser tools verify the existing preview. Figma and Trello have not been connected or given project data. Local design standards and a launch checklist are included until the user approves those connections. No new external account, board, design file or public audience is created automatically.
