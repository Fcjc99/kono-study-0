import { useEffect, useState } from 'react'
import { minutesFromDate, phaseBlendForMinutes } from '../game/sanctuary/timeEngine'
import type { DayPhase, PhaseMode } from '../game/sanctuary/types'

export function useResolvedDayPhase(phase: PhaseMode): DayPhase {
  const [liveDayPhase, setLiveDayPhase] = useState<DayPhase>(() => phaseBlendForMinutes(minutesFromDate(new Date())).dominant)
  useEffect(() => {
    if (phase !== 'auto') return
    const tick = () => setLiveDayPhase(phaseBlendForMinutes(minutesFromDate(new Date())).dominant)
    tick()
    const interval = setInterval(tick, 60000)
    return () => clearInterval(interval)
  }, [phase])
  return phase === 'auto' ? liveDayPhase : phase
}
