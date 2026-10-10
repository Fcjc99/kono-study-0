import type { AppData } from '../store/model'
import { buildAssetSrc, buildItemStyle, resolvePlacements, signTextStyle } from '../game/data/buildAssets'
import { useResolvedDayPhase } from '../hooks/useResolvedDayPhase'
import type { PhaseMode } from '../game/sanctuary/types'
import { Suspense, lazy } from 'react'
import './sanctuary-build.css'

// The ?debug=1 readout loads only when asked for.
const DecorateDebugHUD = lazy(() => import('./DecorateDebugHUD'))
const debugOn = (() => { try { return new URLSearchParams(location.search).get('debug') === '1' } catch { return false } })()
const DebugHUD = () => debugOn ? <Suspense fallback={null}><DecorateDebugHUD mode="view" /></Suspense> : null

/**
 * Read-only twin of the placement layer SanctuaryBuild draws while editing — everything placed in
 * Decorate mode (roads, lights, signs, …) needs to keep showing on the island once
 * you leave Decorate, and this is the only place that renders `sanctuaryDecor` outside that editor.
 */
export default function SanctuaryDecorLayer({ data, phase }: { data: AppData; phase: PhaseMode }) {
  const profileId = data.activeProfileId
  const resolvedPhase = useResolvedDayPhase(phase)
  const placements = data.sanctuaryDecor[profileId]?.placements ?? []
  if (!placements.length) return <DebugHUD />
  return <>
    <div className="build-hotspot-layer is-view" aria-hidden="true">
      {resolvePlacements(placements).map(({ placement: p, asset }) => {
        const signStyle = asset.signArea && p.text ? signTextStyle(asset, p) : null
        return <div key={p.id} className="build-item is-static" style={buildItemStyle(asset, p)}>
          <img src={buildAssetSrc(asset, resolvedPhase)} alt="" />
          {signStyle && <span className="build-sign-text" style={signStyle}>{p.text}</span>}
        </div>
      })}
    </div>
    <DebugHUD />
  </>
}
