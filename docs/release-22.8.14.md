# 22.8.14 — Scanned schedule import

Planner → Import PDF reads English printed PDFs using local PDF.js and Tesseract.js. All worker and English recognition assets are served by KONO, not a third-party OCR service. Scanned-image recognition is enabled by default, including pages that mix selectable headings and scanned content. PDFs and extracted source text are held only in memory, not uploaded or persisted. Only approved structured records enter the existing plan repository.

Limits: 20 MB per PDF, one to five selected pages per read, 100 suggestions, three-minute read timeout, bounded render resolution. Recognition is not guaranteed for handwriting, blur, rotated text within a page, or complex columns. Review all names, dates, times and weekdays. Missing details can be entered manually; pasted text is also supported. Choose month/day or day/month format and the class date range. Ambiguous years or AM/PM remain blank rather than silently guessed.

Creates subjects, recurring classes, exams, assignments and calendar events in the active profile. Suggestions are unchecked by default; final review acknowledgement is required. Exact normalized duplicates are skipped. One transaction applies each import. Whole-import undo is available in the open importer only while no subsequent plan changes have occurred; otherwise individual Trash actions preserve newer work. Holidays require occurrence skips.

Validation: full build/lint/regression suite; image-only PDF generated and rendered entirely in memory followed by real English OCR; parser/date/duplicate/atomicity/profile tests; browser review/add/whole-import undo; 390px phone-width layout check. Real user scans and physical iPhone Safari OCR remain acceptance checks, not claimed verified. No hosted deployment or access-policy change.

Library references: https://mozilla.github.io/pdf.js/ and https://github.com/naptha/tesseract.js . Recognition resources are loaded on demand, so normal Planner use does not load the OCR engine. There is no paid AI API; ordinary hosting/download usage still exists.
