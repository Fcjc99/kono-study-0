# KONO Production Build 21.4
## Planner Calendar + Subject Customization + Montréal Weather

### Planner calendar
- Select any calendar date and add a custom event directly to that date.
- Event labels: Exam, Test, Quiz, Assignment, Study, Activity, Personal, Other.
- Optional subject label uses each subject's custom color.
- Calendar events can be edited and deleted.
- Deleted calendar events have a 10-second Undo action.
- Assignments and Exam Hub entries continue to display on the same calendar alongside custom events.

### Subjects
- Subjects can be renamed and recolored after creation.
- Optional teacher and room fields can be edited.
- Subjects can be deleted without deleting connected assignments or notes.
- Deleted subjects can be restored with Undo for 12 seconds.
- Existing subject color swatches and reusable-subject workflow remain available.

### Live weather
- Weather locations now support cities/regions/countries as well as 5-digit U.S. ZIP codes.
- Added one-tap `Montreal, Quebec, Canada` weather preset.
- The School Year 2026–27 profile is preconfigured for Montréal; Summer 2026 retains ZIP 02050.
- New profiles start with Montréal as their default weather location and remain editable.
- Live weather continues to drive Sanctuary weather states through Open-Meteo.

### Data migration
- Existing ZIP settings automatically migrate to the new weather-location field.
- Existing saved planner data gains an empty `calendarEvents` collection without resetting user work.

### Validation
- Build 21.4 feature validator: PASS.
- TypeScript/TSX syntax validator: PASS (44 files).
- Production environment/foundation/tree/pond/garden/home validators: PASS.
- Build 21.3 vegetable-garden/home checks: PASS.
- Full `npm run build` remains unavailable in this supplied project copy because its `node_modules` does not include `vite/client` and `@types/node`.
