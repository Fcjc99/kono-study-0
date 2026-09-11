# KONO 22.8.12 — three complete experiences

The original Vercel reference became accessible after user sign-in. Its actual Notes, Planner and Settings presentations were inspected. Cozy reuses the existing original Sidebar and StickyNoteView components rather than another unrelated redesign.

- Cozy: notebook navigation on desktop and mobile, original pinned-paper notes/exams, warm framed boards, coordinated calendar and paper editors, gentle hover feedback. Coral and Sakura remain its color palettes.
- Simplified: preserves the compact workspace, standard record cards, center dialog and mobile bottom navigation.
- Office: document-style note/subject rows, quieter straight-edged controls, structured calendar, side-sheet editor and restrained chrome.
- All themes share the same editing, Trash, Undo/Redo, search, record ownership and recurring-class functionality. Theme switches do not copy or replace records. Reduced-motion preferences remain respected.
- Bold, italic, selection highlight and six paper-color presets are available in the shared note editor.
- The recurring-class and dated reminder features from 22.8.11 remain included. Reminders appear in-app, not as background phone notifications.

Checked desktop and phone-width rendering and the recurring-class/note/reminder flow using isolated local test data. Production build, type/lint checks and regression tests are run before installation. Physical iPhone and signed-in cross-device acceptance testing remain separate launch checks. No hosting audience or paid service was changed.
