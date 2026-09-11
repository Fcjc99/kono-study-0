from pathlib import Path
root=Path(__file__).resolve().parents[1]
app=(root/'src/App.tsx').read_text()
weather=(root/'src/game/weather/liveWeather.ts').read_text()
hook=(root/'src/hooks/useLiveSanctuaryWeather.ts').read_text()
css=(root/'src/App.css').read_text()
checks={
 'calendarEvents data model': 'calendarEvents:CalendarEvent[]' in app and 'calendarEvents:raw.calendarEvents??[]' in app,
 'calendar date event editor': '＋ Add event to' in app and 'planner-event-editor' in app,
 'calendar category labels': all(x in app for x in ['Exam</option>','Test</option>','Quiz</option>','Study</option>']),
 'calendar subject labels': '<span>Subject</span><select value={eventSubjectId}' in app,
 'calendar edit delete undo': 'editEvent(event)' in app and 'removeEvent(event.id)' in app and 'undoDelete' in app,
 'subject customize': 'Customize subject' in app and 'saveSubjectEdit' in app,
 'subject delete undo': 'removeSubject(subject.id)' in app and 'undoSubjectDelete' in app,
 'subject work preserved': 'assignments and notes kept' in app,
 'Montreal preset': 'Montreal, Quebec, Canada' in app,
 'generic weather location': 'normalizeWeatherLocation' in weather and 'countryCode' in weather and 'location: string' in hook,
 'weather UI custom city': 'weather-location-entry' in app and 'Weather location for' in app,
 'responsive planner styles': '.planner-event-grid' in css and '.subject-edit-panel' in css and '.weather-location-presets' in css,
}
failed=[name for name,ok in checks.items() if not ok]
if failed:
 print('FAIL:', ', '.join(failed)); raise SystemExit(1)
for name in checks: print('PASS:',name)
print('Build 21.4 planner/customization/weather validation passed')
