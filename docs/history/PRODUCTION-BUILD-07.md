# KONO Production Build 07 — Integrated Weather Simulation

## Goal
Weather now arrives, develops, and clears through one shared simulation rather than appearing as an instant overlay.

## Engine work
- Added a dedicated `WeatherManager` with staged cloud, wind, precipitation, atmosphere, and water-response transitions.
- Added a pooled `WeatherSystem` for rain, snow, breezy leaves, and weather shading.
- Connected weather state to the existing cloud, lighting, fluid, mist, vegetation, and pond-ripple systems.
- Removed weather-particle creation and teardown from `Stage0Scene`.

## Natural transitions
- Rain: wind and cloud cover lead; first drops arrive later; water energy and mist build after precipitation.
- Rain clearing: drops taper first; pond response and clouds linger before sunlight returns.
- Snow: lighting and cloud cover cool before flakes build; water motion calms.
- Breezy: gusts arrive in waves and affect clouds, vegetation, leaves, mist, and water together.
- Cloudy: cloud cover and moving shadows build without precipitation.

## Debug controls
Use `?sanctuaryDebug=1` on mobile or press F8 on desktop.

The Production 07 console adds:
- Natural or instant weather changes
- Weather transition speed
- Cloud-cover override
- Wind override
- Rain or snow intensity override
- Water-response multiplier
- Live transition, cloud, wind, precipitation, and water readouts

## Scope protection
Planner, Notes, Exams, schedules, profiles, and stored productivity data were not changed.
