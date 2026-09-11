# KONO 22.8.11 — recurring classes and dated reminders

## Available

- Planner > Weekly schedules & seasons > select weekday > Add recurring class / activity.
- A class has AM/PM start and end times, a first and last date within its season, subject and room.
- The same date-based occurrences appear on Sanctuary's daily schedule, the Planner agenda and monthly calendar counts. Inactive seasons do not appear.
- Each class date has its own editable note. Different dates can merge independently across devices; conflicting edits to one note are not silently overwritten.
- A class note can create an ordinary editable calendar reminder for the next non-skipped class or a chosen date. Due/overdue reminders appear on Sanctuary until completed. These are in-app reminders, not background phone notifications.
- Individual dates can be completed/reopened or skipped/restored; the series can still be edited, duplicated and moved to Trash.
- Data format 4 preserves all earlier formats. Old clients are prevented from writing to the new version, rather than silently dropping dated notes.

## Checks

Automated recurrence checks cover inclusive boundaries, weekdays, dated-note isolation, concurrent notes, stale-note protection, skipped next classes, ownership and legacy migration. Browser testing used isolated data: saved Tuesday 10 AM–12 PM classes from September 15 through October 6, added a note on September 15, and verified the book reminder on September 22 without copying the note to that class.

## Theme request still pending

The supplied original Cozy deployment redirects to Vercel authentication. The current appearance is preserved; the exact Cozy recreation and three complete theme experiences are not claimed as completed in this release. User access or screenshots are needed to match that reference accurately.
