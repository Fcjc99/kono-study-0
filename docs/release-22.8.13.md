# 22.8.13 — Subject workspaces and original cork boards

- Cozy and Office now group each subject into Assignments, Notes, Exams and Schedule. Simplified retains its existing list.
- Cozy restores compact pastel assignment rows and the original memory-board structure and cork styling. Sanctuary retains first position; previews show at most four pinned notes/exams with links to all records.
- Completion/reopening, editing, duplication and Trash retain the current repository safeguards. Notes can open a dated reminder editor that creates a calendar event only when saved.
- Subject tabs scroll independently on phones; sections and boards stack; form text is at least 16px on mobile, controls at least 44px. Browser viewport checks: Subjects at 390px, Planner at 375px, Notes at 430px. Physical iPhone Safari still needs final release testing.
- Clarified that study profiles are organizational plans within one account, not private logins for different people. Local-only mode is shared by the same browser profile.
- Reviewed existing server ownership checks and ran regression tests covering account binding, unauthorized reads, owner histories, session changes and data preservation. This does not certify an older Vercel deployment.
- Sites access inspected on 2026-09-09: owner-only. No deployment, access expansion or user-data replacement performed. Real two-account/two-device hosted acceptance testing remains a release gate.
