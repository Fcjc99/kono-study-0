# School calendars and rotations — 22.8.15

Planner → School calendar & rotation.

1. Choose Marshfield, NDA, or another school/year. The two supplied 2026–27 calendars are reviewable private templates, not live school feeds.
2. Set student grade, school dates, and a known A/E or Day 1–6 rotation date. The app does not invent an anchor.
3. Review holidays, half-days and exam periods. Holidays pause the cycle. The default snow rule consumes a canceled cycle day; it can be changed for a different school.
4. Add or import classes for each rotation day. Mark full-year classes to follow announced makeup dates; use exact date ranges for semester-only classes.
5. Review and save. The current profile’s calendar, Today, and subject class lists use the same occurrence engine.

## Safe import

PDF and JPG/PNG/WebP OCR run locally using the existing bundled OCR engine. No paid AI or external document service. Files and extracted source text are not stored in the account; only reviewed calendar/class records are saved through the existing repository.

Calendar grid shading and column placement are not reliably preserved by OCR. All suggestions start unchecked. Dates, class days, times, terms and senior-only rules must be reviewed. Add missing rows manually. Uncertain AM/PM is blank, not guessed. School-calendar PDF import reads the first two pages; the existing general importer supports chosen ranges.

Half-days without confirmed bells show an explicit times-unconfirmed label. Exam periods do not create individual subject exams, and normal classes are hidden unless a block has a confirmed exam-day bell assignment. Add announced subject exams separately.

## Changes and recovery

Calendar edits are drafts until saved. Exceptions may be edited or removed, and whole schedules can go to Trash. Existing Undo/Redo and per-account save/conflict protections remain in use. Calendar corrections never delete assignments or existing dated notes.

The year does not automatically extend for an assumed snow allowance. Extend the final activity date and add school-announced makeup dates. A single-date rotation correction can reset the cycle.

Data version 5 migrates versions 2–4 and protects new records from older clients. Existing themes and Sanctuary art are unchanged. Local testing is not a production deployment.

## Verification

19 rotation/calendar test groups, existing data-safety and scheduler suites, TypeScript/build/lint. Browser checks on an isolated local plan covered A/E creation, planner occurrence, snow closure, Undo and phone-width layout. Not a physical-device certification or a guarantee of OCR accuracy.
