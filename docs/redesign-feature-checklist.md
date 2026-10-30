# KONO redesign: feature-preservation checklist

Audit of the source on main (3cdb00f). Each phase marks what it touched and how it was checked.
Legend: ✅ kept and checked · 🔁 moved or restyled, still there · ⏳ not reached yet · ⚠️ can't be tested here.

## Shell (src/Workspace.tsx, components/Sidebar.tsx)
- Tabs (workspaceShared.ts `pages`): Sanctuary, Planner, Kids (family plans), Subjects, Notes, K-Quiz, Exams, Settings, plus Trash.
- Navigation: the cozy Sidebar (`experience==='cozy'`, the default) or the `wb-sidebar` (simplified / modern / sumi);
  the phone bottom nav (Home, Planner, ＋ Add, Kids/Notes, More); the More sheet (every other tab, Trash).
- Header: page title (h1); Set up KONO chip (GettingStarted, resumable, Hide); Search (CommandPalette);
  ＋ Add (QuickAddBox modal); the ⋯ menu: Undo, Redo, voice add, music, Trash, the "Saved on this device /
  Signed in as" line.
- Study plans: PlanSwitcher, "Who's using KONO?", plan lock. These are plans inside one account or one device,
  never separate accounts.
- Banners: AccountBanners ("Only saved on this device" with save to email, conflicts, KONO support session);
  login digest (due soon), school heads-up, crunch days, needs-review, unfinished draft; SaveStatusToast;
  undo toast.
- Themes and modes: themes (coral, sakura, professional and team themes); experiences (cozy, simplified,
  modern, sumi); dark mode (light / phone / dark); text size large; density compact; reduced motion
  (useReducedMotion); simple view (kid); island setting (full / kono / off); the daylight tint.

## Sanctuary (Home widgets, store/homeLayout.ts; ✏️ Customize Home keeps its order and hidden list)
- `week`: the week strip. `sanctuary`: the island card (GardenCard / Phaser scene, Decorate, Arcade, World map,
  Live time, photo, Expand), the welcome tour, the quick Today view (installed app).
- KONO bar: mood line, meters (full, rested, happy), care action (feed, tuck in, wake), coins → KONO Town,
  Next (NextUp), Ask (AskKono), KONO's corner (stickers, stamp card, wardrobe, bond, Town, house, visit
  family, world map, album), surprises, quests, season events.
- `family`: family schedule (parent plans). `schedule`: Today and Tomorrow (late work, reminders, rotation day,
  classes, ＋ Add for the day, progress). `weekAhead`: This week and recap. `notes`: Notes & reminders.
  `todos`: kid to-dos and family to-dos. `meals`: dinners and groceries. `comingUp`: birthdays and countdowns.
- `focus`: FocusSession. Assignment select, title, notes, Complete this assignment; timer (minutes and seconds,
  Start, Pause, Reset); progress; lock to the timer (fullscreen and Wake Lock, interruption count); a quick
  study note with Save, the last 2 notes; break games after a finished session; the iPhone lock-screen timer
  (nativeFocus); KONO sits with you while it runs; finds on a finished session; focusRequest hand-offs from
  notifications, NextUp and the Planner.
  - **Timer on leaving the page (verified in source):** the timer is component state, so switching tabs
    unmounts it. The session ends, the iPhone timer clears and KONO stops sitting with you. The page's own
    copy says so ("stops when you leave the Sanctuary"). Nothing runs in the background.
- The Sunday week recap, family setup card, Shared with you (classmates), Getting started.

## Planner (pages/PlannerPage.tsx, PlannerCalendar, WeekGrid, StudyPlanner)
- Views: Day, 3 days, Week, Month, Schedule; Kids view. Date navigation, swipe on phones, people chips,
  source chips. Drag to move, stretch, hold for a menu, tap an empty time to add.
- ✨ Plan my week (StudyPlanner): availability, preview, explicit confirmation before adding, a non-AI
  scheduler and an AI option. 📊 Your week so far.
- Add (QuickAddBox): multiline, Homework / Exam / Event / Lesson / Study note, paste an email or flyer, scan
  (UpdatePlanScanner, syllabus, photos), speech, recurrence, dated subtasks (BreakIntoSteps), duration,
  links, photos, attachments, reminders, clash warnings, repeat suggestions. EntryEditor with Save/Cancel,
  mobile sheets.

## Notes, K-Quiz, Subjects, Exams, Settings, Trash
- Notes: Board and List, pin, colors, subjects, Flashcards (non-AI spaced repetition, store/flashcards),
  "Quiz me".
- K-Quiz: Record a lecture, Paste, Scan or PDF; AI generation (provider, key or built-in for signed-in users,
  privacy and billing notes); KQuizPlay with coins; KQuizGuide.
- Subjects: your subjects, classes, assignments per subject, Unassigned. Exams: your exams, review
  (store/examReview).
- Settings: search, plans (add, switch, delete, reset, start over with typed confirmation), import & export,
  calendar subscribe, Canvas, AI helper, notifications and push, Siri, friends, helpers, island & KONO,
  sound & motion, weather, family, look (experience, palette, dark mode, text, density). Trash: restore and
  delete.

## Games and the world
- Arcade (BreakGames): KONO blast, Meowdoku, Gem blitz, Candy crush, KONO Flow, KONO Beat, Flappy, KONO.io.
  Land games, KONO Town shops, prize wheel, album, house, world map destinations, passport, reward rules
  (konoCoins, coin rounds).

## Demo vs signed in
- Signed out = "Saved on this device" (local storage); AccountBanners says so. Signed in = the cloud
  (Supabase).
- ⚠️ Real cloud sync and real AI generation can't be checked here: the e2e suite fakes the cloud
  (`fakeCloud`) and the AI. Those flows are tested against fakes only.
