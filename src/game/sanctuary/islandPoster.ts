import { minutesFromDate, phaseBlendForMinutes } from './timeEngine'
import { islandMapPath, islandSeason } from './season'

/** The island's small picture (shown while the island engine downloads) for a time of day: the same
 * file GardenCard shows as its background. */
const islandPosterSrc = (phase: string) => islandMapPath(phase, islandSeason(new Date())) + '-poster.webp'
/** The time of day the island opens at when it follows the clock. */
export const autoIslandPhase = () => phaseBlendForMinutes(minutesFromDate(new Date())).dominant

const loading = new Map<string, Promise<void>>()
/** Downloads the picture once; resolves when it has arrived (or failed). Home starts this as soon as
 * KONO opens for someone signed in, and the island waits for it before fetching its engine, so on a slow
 * connection the picture isn't held back by the much larger engine download. */
export function loadIslandPoster(src = islandPosterSrc(autoIslandPhase())) {
  let pending = loading.get(src)
  if (!pending) {
    pending = new Promise<void>(resolve => {
      const img = new Image(), done = () => resolve()
      img.onload = done; img.onerror = done
      // Low priority: the plan itself, arriving at the same time, comes first.
      img.fetchPriority = 'low'
      img.src = src
    })
    loading.set(src, pending)
  }
  return pending
}
