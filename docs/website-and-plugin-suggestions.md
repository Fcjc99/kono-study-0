# KONO website and plugin suggestions

## Product direction

Keep the sanctuary as KONO's identity, with studying as the primary action. The first release is intended for multiple users across devices, so reliable accounts, ownership and sync are required, not optional polish. See [production-readiness-plan.md](./production-readiness-plan.md) for release gates and evidence.

After the data/security foundation, I recommend:

1. **Personal onboarding:** create an account, choose a term and subjects, then add the first assignment. Offer sample data explicitly instead of starting everyone with Sophia's Summer 2026 plan.
2. **A clear daily dashboard:** surface overdue work, today's top three priorities, the next exam, and a single quick-add action. Keep the sanctuary visible without making the user scroll past it to study.
3. **Visible saving and recovery:** show Saved / Syncing / Offline / Needs attention, with a clear recovery action. This belongs beside real synchronization, not as a cosmetic badge.
4. **Understandable sanctuary progress:** explain which study actions evolve each landmark, show the next milestone, and make a completed action visibly connect to the reward. Keep QA stage controls development-only.
5. **Simpler settings:** separate Account & Data, Appearance, Sanctuary, and Schedules. The current long settings page mixes these responsibilities; onboarding should not require finding controls far below the fold.
6. **A focused study view:** a compact assignment-and-notes layout with optional timer and accessible mascot actions. Treat a timer as a later feature, after reliable task completion and sync; it should not block the first stable release.

## Plugin shortlist

The available Sites and browser tools were used for the existing-project workflow and a read-only UI walkthrough. No new plugin was installed, no external board/design was created, and no repository/data was uploaded to an additional service. Plugin search/suggestion tools were not callable in this session; Figma and Trello are present in the user's available-but-not-installed list, not connected here.

- **Figma:** use an approved design file for KONO's palettes, spacing, form components, desktop/mobile layouts, and screenshot comparisons. Its MCP integration can provide components, variables and layout context to implementation. This would help consistency; it does not automatically fix pixel-art transparency or terrain alignment. [Official Figma MCP documentation](https://developers.figma.com/docs/figma-mcp-server/).
- **Trello:** track the launch gates as cards with reproduction steps, owner, acceptance checklist, and verification evidence. Suggested lists: Launch blockers, Ready to build, In progress, Ready for QA, Verified. Connect it only if the user wants their release work managed there. [Official Trello checklist documentation](https://support.atlassian.com/trello/docs/adding-checklists-to-cards/).

My recommendation is Trello first for release discipline, Figma second for a design consistency pass. Neither replaces a real backend/authentication system, automated tests, or security review. Avoid adding a second hosting platform simply to publish the same static app; decide on the multi-user architecture first.

## UI review performed

Read-only navigation covered Sanctuary, Planner, Subjects, Notes, Exams and Settings in the local app. Forms, seeded tasks, empty notes/exams, profile controls, themes, schedule editor, weather and reminder controls were inspected without submitting edits, completing assignments, switching profiles or invoking restore. The Settings layout was visually inspected. No browser console errors were returned during this walkthrough.

This is a navigation/layout review, not a claim that every mutation, mobile browser, account flow, network failure or animation is certified. Dangerous data cases were exercised separately using in-memory fixtures, not the user's browser data.

## Release-check cleanup

The current default `npm run validate` still points at an earlier sanctuary-registration validator and omits the newer animation/native-palette checks. Consolidate these into a single CI release command with pinned tooling and explicit image budgets. A green legacy validator alone must not be used as evidence that this newer build is ready to launch.

The baseline `npm run lint` was run during this review and failed with **27 errors and 1 warning**, before applying the 22.8.7 visual changes. Findings include unsafe broad types, ref access during render, effect-state warnings, mixed component exports, and unused parameters. These remain unresolved; passing a TypeScript/Vite build does not mean the lint/release gate is green.
