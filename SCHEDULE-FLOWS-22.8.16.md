# Three schedule flows — 22.8.16

Planner → Set up my schedule:

- My weekly class: select an existing subject or name a class; choose weekdays, times, a date range and optional location. Preview session count, review any overlaps, and save. Sessions appear in Calendar and Today. No institutional holidays are assumed.
- College semester: select McGill Fall 2026 / Winter 2027, or create a custom college term. Confirm faculty/program and term dates, review exceptions, then enter or import weekly classes. Confirmed makeup dates replace only that date's weekday schedule.
- Rotating school: existing Marshfield / NDA / custom A/E and Day 1–6 setup is retained.

The starter academic catalog is a shared, read-only dataset shipped with the app. Student copies are saved through the existing private account repository. It is not a live university feed or an administrator-editable database. Catalog revisions require reviewed maintenance; McGill copies can review a new bundled revision without changing private class records automatically.

McGill source: https://www.mcgill.ca/importantdates/key-dates
Checked: 2026-09-09. General calendar only; Medicine, Dentistry and other noted exceptions must be reviewed against the program's own calendar.

December 3, 2026 follows Monday instead of Thursday. April 13, 2027 follows Friday; April 14 follows Monday. Exam windows do not invent subject exams. College-specific exam and assignment uploads remain review-first in the general importer.

Manual weekly additions reuse matching subjects, reject duplicates and require explicit overlap acknowledgement. Their schedules can be edited, paused, duplicated or removed using the existing weekly manager and Trash. Pausing one weekly schedule does not deactivate other classes. Next-class reminders now consider all matching weekdays in the same schedule.

Data format 6 migrates older saves and prevents old clients from misreading weekly institutional rules as rotating school rules. No new paid services or dependencies; no Sanctuary image changes.

Verification: 10 new flow regression groups plus all existing tests, lint and build. Isolated browser checks at iPhone width covered manual session creation, calendar placement, Undo, college replacement weekdays and all three selectors. Not a physical-device certification. Source applied locally; no production deployment.
