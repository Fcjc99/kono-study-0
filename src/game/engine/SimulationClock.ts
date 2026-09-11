export class SimulationClock {
  private elapsedSeconds = 0
  private paused = false

  update(deltaSeconds: number): number {
    if (!this.paused) this.elapsedSeconds += Math.max(0, deltaSeconds)
    return this.elapsedSeconds
  }

  setPaused(paused: boolean): void {
    this.paused = paused
  }

  reset(): void {
    this.elapsedSeconds = 0
  }

  get elapsed(): number {
    return this.elapsedSeconds
  }
}
