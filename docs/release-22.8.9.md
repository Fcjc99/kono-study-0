# KONO 22.8.9 — No-AI study tools

## Planner → Make a study plan

- Name the assignment, choose chapters/pages/problems or custom steps, and give a start date and deadline.
- Both dates count. The **2 weeks** shortcut makes a 14-day inclusive range.
- All days are selected initially; learners can choose particular weekdays.
- Whole units are allocated evenly; when there is a remainder, the first days get one extra. Sparse workloads leave buffer days at the end.
- Review the schedule before adding it to the calendar. Essay and exam-preparation templates provide editable steps, not AI-generated instructions.
- Each unit is one stable assignment. Missed units appear on the next study day with that day's scheduled work. No background job, new duplicate events, or automatic completions are involved.
- Example: 14 chapters / 14 days → one a day. Day one missed → chapters 1–2 on day two. Both missed → chapters 1–3 on day three. Finish chapter 1 and only 2–3 remain.
- Each completed unit is explicitly checked by the learner and uses existing one-time Sanctuary credit tracking. Partial daily completion means checking only the units actually finished; fractions within a chapter are not tracked.
- After the deadline all remaining work stays visible today as overdue, even on a non-study day. The deadline never silently moves.
- **Reschedule remaining work** redistributes only unfinished units from today through a new deadline. Completed task IDs, history and credits remain unchanged.
- Canceling a plan removes its pending units; completed assignments remain as ordinary history.
- The timezone captured when creating a plan is retained across devices. Calendar-day arithmetic handles daylight-saving changes.

## Notes → Your flashcards

- Create a deck from `question :: answer` pairs, one per line, or a tab-separated text/TSV file (100 KB / 200 cards maximum).
- Preview before saving. Ordinary PDFs and prose notes are not interpreted automatically.
- Quiz mode hides answers until requested. **Got it** / **Review again** saves the review status; repeat missed cards after a round.
- Cards remain literal text, never HTML. Quiz practice never completes calendar tasks or grants assignment credit.

## Data and release safeguards

- Study plans and flashcard decks use the existing account-owned snapshot, recovery cache, export/import, and three-way merge.
- The payload schema, backup envelope and newly written local cache use format 2. Old format-1 saves remain readable; unknown future formats are rejected.
- API requests require `X-Kono-Data-Version: 2`, preventing old clients from reading and stripping new metadata or overwriting/deleting a new-format cloud plan. New cache writes use version 2 so old tabs refuse them.
- No database table migration or new dependency is required. Existing saved plans remain untouched until the learner uses the new controls.
- No AI API, credentials, paid subscription feature, payment flow, analytics or paywall was added. Website hosting and storage costs are separate from this feature.
- Automated tests cover allocation, backlog, completion, ordering, weekday gaps, deadlines, timezones/DST, validation, templates, literal-text rendering, imports, merging and old-client protection.
- Browser interaction/visual QA and public deployment were not requested for this change. Existing launch checklist items still apply.

To check locally, reload the running KONO preview and look for **Build 22.8.9**, then open Planner. A local preview does not update the hosted URL.
