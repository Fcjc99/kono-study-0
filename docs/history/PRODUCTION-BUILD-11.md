# KONO Production Build 11 — Live Local Weather

## Added

- Live Sanctuary weather based on a user-entered five-digit U.S. ZIP code.
- A separate saved ZIP code for each KONO study profile.
- Three weather modes: Live local weather, Manual weather, and Clear only.
- Current city/state, condition, temperature, cloud cover, wind speed, update time, and live/cache status in Settings.
- A compact live-weather status chip over the Sanctuary.
- Current conditions refresh approximately every 20 minutes and when the app becomes visible again.
- Cached last-known conditions remain available for up to six hours if the network or provider is unavailable.
- Manual weather remains the fallback and the debug panel can still temporarily override the resolved weather.

## Sanctuary mapping

- Snowfall and snow weather codes -> Snow
- Rain, drizzle, showers, or thunderstorms -> Rain
- Strong wind or gusts without precipitation -> Breezy
- Overcast, fog, or at least 50% cloud cover -> Cloudy
- Otherwise -> Clear

Precipitation takes priority over wind so rain and snow remain visually correct while the shared Weather Manager still controls cloud, vegetation, water, lighting, and particle responses.

## Weather provider

The build uses Open-Meteo's browser-accessible geocoding and current forecast APIs. No weather API key is embedded in KONO.

## Validation

- 34 TypeScript/TSX files passed isolated TypeScript syntax validation.
- The live-weather ZIP lookup and all five Sanctuary weather mappings passed a mocked runtime test.
- 192 phase-specific fluid frames and all four source scenes passed environment validation.
- Full dependency-backed Vite compilation requires `npm install` on a network-connected machine because this sandbox could not resolve the npm registry.
