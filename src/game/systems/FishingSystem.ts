import Phaser from 'phaser'
import { RenderLayers } from '../engine/RenderLayers'
import { SANCTUARY_EVENTS } from '../sanctuary/runtime'
import type { DayPhase } from '../sanctuary/types'

type FishingState = 'idle' | 'waiting' | 'bite' | 'result'
type FishingArtState = 'idle' | 'cast'
const FISHING_PHASES: readonly DayPhase[] = ['morning', 'afternoon', 'evening', 'night']
const fishingTextureKey = (phase: DayPhase, state: FishingArtState): string => `bridge-fishing-${phase}-${state}`

export interface FishingCatch {
  name: string
  sizeCm: number
  rarity: 'common' | 'uncommon' | 'rare'
}

export interface FishingSummary {
  totalCatches: number
  bestSizeCm: number
  bestCatchName: string | null
}

interface StoredFishingStats extends FishingSummary {
  version: 1
}

const FISHING_STORAGE_PREFIX = 'kono:sanctuary:fishing:v1:'

const pickCatch = (): FishingCatch => {
  const roll = Math.random()
  if (roll > 0.93) {
    return { name: 'Lantern Bream', sizeCm: Phaser.Math.Between(24, 38), rarity: 'rare' }
  }
  if (roll > 0.68) {
    return { name: 'Cloudtail', sizeCm: Phaser.Math.Between(16, 30), rarity: 'uncommon' }
  }
  if (roll > 0.34) {
    return { name: 'Moonfin', sizeCm: Phaser.Math.Between(11, 24), rarity: 'common' }
  }
  return { name: 'Silverleaf Minnow', sizeCm: Phaser.Math.Between(7, 18), rarity: 'common' }
}

export class FishingSystem {
  private readonly scene: Phaser.Scene
  private bounds = new Phaser.Geom.Rectangle()
  private state: FishingState = 'idle'
  private phase: DayPhase = 'afternoon'
  private reducedMotion = false
  private relaxedTiming=false
  private profileId = 'unassigned'
  private stats: StoredFishingStats = {
    version: 1,
    totalCatches: 0,
    bestSizeCm: 0,
    bestCatchName: null,
  }

  private kit: Phaser.GameObjects.Image | null = null
  private ripple: Phaser.GameObjects.Image | null = null
  private hudBg: Phaser.GameObjects.Rectangle | null = null
  private hudTitle: Phaser.GameObjects.Text | null = null
  private hudHint: Phaser.GameObjects.Text | null = null
  private biteTimer?: Phaser.Time.TimerEvent
  private escapeTimer?: Phaser.Time.TimerEvent
  private resultTimer?: Phaser.Time.TimerEvent

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  static preload(scene: Phaser.Scene, phases: readonly DayPhase[] = FISHING_PHASES): void {
    phases.forEach((phase) => {
      scene.load.image(fishingTextureKey(phase, 'idle'), `/garden/registered-22.8.6/evolution/bridge-fishing/phases/${phase}/bridge-fishing-idle.png`)
      scene.load.image(fishingTextureKey(phase, 'cast'), `/garden/registered-22.8.6/evolution/bridge-fishing/phases/${phase}/bridge-fishing-cast.png`)
    })
  }

  create(reducedMotion: boolean, profileId: string): void {
    this.reducedMotion = reducedMotion
    this.setProfile(profileId)
    this.kit = this.scene.add.image(0, 0, fishingTextureKey(this.phase, 'idle'))
      .setOrigin(0, 0)
      .setDepth(RenderLayers.interaction)
  }

  setReducedMotion(reducedMotion: boolean): void {
    this.reducedMotion = reducedMotion
  }

  setPhase(phase: DayPhase): void {
    if (phase === this.phase) return
    this.phase = phase
    const artState: FishingArtState = this.state === 'idle' ? 'idle' : 'cast'
    this.kit?.setTexture(fishingTextureKey(this.phase, artState))
  }

  setProfile(profileId: string): void {
    const nextProfileId = profileId || 'unassigned'
    if (nextProfileId !== this.profileId && this.state !== 'idle') {
      this.clearTimers()
      this.state = 'idle'
      this.kit?.setTexture(fishingTextureKey(this.phase, 'idle'))
      this.destroyVisuals()
    }
    this.profileId = nextProfileId
    this.stats = this.readStats()
  }

  getSummary(): FishingSummary {
    return {
      totalCatches: this.stats.totalCatches,
      bestSizeCm: this.stats.bestSizeCm,
      bestCatchName: this.stats.bestCatchName,
    }
  }

  isActive(): boolean {
    return this.state !== 'idle'
  }

  start(relaxedTiming=false): boolean {
    if (this.state !== 'idle') return false

    this.clearTimers()
    this.relaxedTiming=relaxedTiming
    this.state = 'waiting'
    this.kit?.setTexture(fishingTextureKey(this.phase, 'cast'))
    this.ensureVisuals()
    this.showHud('Line cast', 'Wait for the bobber…')
    this.showCastRipple()

    const waitMs = this.reducedMotion ? Phaser.Math.Between(1500, 2600) : Phaser.Math.Between(1900, 4300)
    this.biteTimer = this.scene.time.delayedCall(waitMs, () => this.beginBite())
    this.scene.game.events.emit(SANCTUARY_EVENTS.fishing, { type: 'cast' })
    return true
  }

  /** Returns true when the bridge press belongs to an active fishing session. */
  handleBridgePress(): boolean {
    if (this.state === 'idle') return false

    if (this.state === 'waiting') {
      this.showHud('Line cast', 'Easy… wait for a bite.')
      return true
    }

    if (this.state === 'bite') {
      this.resolveCatch()
      return true
    }

    return true
  }

  resize(bounds: Phaser.Geom.Rectangle): void {
    this.bounds.setTo(bounds.x, bounds.y, bounds.width, bounds.height)
    this.positionVisuals()
  }

  destroy(): void {
    this.clearTimers()
    this.destroyVisuals()
    this.kit?.destroy()
    this.kit = null
    this.state = 'idle'
  }

  private beginBite(): void {
    if (this.state !== 'waiting') return
    this.state = 'bite'
    this.showHud('Bite!', 'Tap the bridge to reel in!')

    if (this.ripple) {
      this.scene.tweens.killTweensOf(this.ripple)
      if (this.reducedMotion) {
        this.ripple.setAlpha(0.9)
      } else {
        const baseScale = this.ripple.scaleX
        this.scene.tweens.add({
          targets: this.ripple,
          alpha: { from: 0.30, to: 0.64 },
          scaleX: { from: baseScale * 0.92, to: baseScale * 1.08 },
          scaleY: { from: baseScale * 0.92, to: baseScale * 1.08 },
          duration: 280,
          yoyo: true,
          repeat: 3,
          ease: 'Sine.InOut',
        })
      }
    }

    this.scene.game.events.emit(SANCTUARY_EVENTS.fishing, { type: 'bite' })
    if(!this.relaxedTiming)this.escapeTimer = this.scene.time.delayedCall(this.reducedMotion ? 1800 : 1550, () => this.missCatch())
  }

  private resolveCatch(): void {
    if (this.state !== 'bite') return
    this.escapeTimer?.remove(false)
    this.escapeTimer = undefined
    const caught = pickCatch()
    this.state = 'result'

    this.stats.totalCatches += 1
    if (caught.sizeCm > this.stats.bestSizeCm) {
      this.stats.bestSizeCm = caught.sizeCm
      this.stats.bestCatchName = caught.name
    }
    this.writeStats()

    const sparkle = caught.rarity === 'rare' ? ' ★' : caught.rarity === 'uncommon' ? ' ✦' : ''
    this.showHud(`Caught ${caught.name}${sparkle}`, `${caught.sizeCm} cm · nice catch!`)
    this.scene.game.events.emit(SANCTUARY_EVENTS.fishing, { type: 'catch', catch: caught, summary: this.getSummary() })
    this.finishSession(1900)
  }

  private missCatch(): void {
    if (this.state !== 'bite') return
    this.state = 'result'
    this.showHud('It slipped away', 'Cast again when you’re ready.')
    this.scene.game.events.emit(SANCTUARY_EVENTS.fishing, { type: 'miss' })
    this.finishSession(1500)
  }

  private finishSession(delay: number): void {
    if (this.ripple) {
      this.scene.tweens.killTweensOf(this.ripple)
      if (this.reducedMotion) {
        this.ripple.setAlpha(0.25)
      } else {
        this.scene.tweens.add({ targets: this.ripple, alpha: 0.18, duration: 420, ease: 'Sine.Out' })
      }
    }
    this.resultTimer = this.scene.time.delayedCall(delay, () => {
      this.state = 'idle'
      this.kit?.setTexture(fishingTextureKey(this.phase, 'idle'))
      this.destroyVisuals()
    })
  }

  private ensureVisuals(): void {
    if (!this.ripple) {
      this.ripple = this.scene.add.image(0, 0, 'ripple-01')
        .setOrigin(0.5)
        .setAlpha(0.34)
        .setDepth(RenderLayers.interaction)
    }

    if (!this.hudBg) {
      this.hudBg = this.scene.add.rectangle(0, 0, 220, 58, 0x20302f, 0.91)
        .setStrokeStyle(2, 0xe8d5ad, 0.88)
        .setDepth(RenderLayers.interactionHud)
      this.hudTitle = this.scene.add.text(0, 0, '', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#fff5d9',
        align: 'center',
      }).setOrigin(0.5).setDepth(RenderLayers.interactionHud + 1)
      this.hudHint = this.scene.add.text(0, 0, '', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '11px',
        color: '#d7e3db',
        align: 'center',
      }).setOrigin(0.5).setDepth(RenderLayers.interactionHud + 1)
    }

    this.positionVisuals()
  }

  private showHud(title: string, hint: string): void {
    this.ensureVisuals()
    this.hudTitle?.setText(title)
    this.hudHint?.setText(hint)
    if (this.hudBg && !this.reducedMotion) {
      this.scene.tweens.killTweensOf(this.hudBg)
      this.hudBg.setScale(0.98)
      this.scene.tweens.add({ targets: this.hudBg, scaleX: 1, scaleY: 1, duration: 130, ease: 'Sine.Out' })
    }
  }

  private showCastRipple(): void {
    if (!this.ripple) return
    this.scene.tweens.killTweensOf(this.ripple)
    this.ripple.setAlpha(0.38)
    if (!this.reducedMotion) {
      const baseScale = this.ripple.scaleX
      this.ripple.setScale(baseScale * 0.72)
      this.scene.tweens.add({
        targets: this.ripple,
        scaleX: baseScale,
        scaleY: baseScale,
        alpha: { from: 0.48, to: 0.20 },
        duration: 620,
        ease: 'Sine.Out',
      })
    }
  }

  private positionVisuals(): void {
    if (this.bounds.width <= 0 || this.bounds.height <= 0) return
    const sceneScale = this.bounds.width / 1448
    this.kit?.setPosition(this.bounds.left, this.bounds.top).setScale(sceneScale)
    const rippleScale = Math.max(0.10, sceneScale * 0.22)
    const rippleX = this.bounds.left + this.bounds.width * 0.496
    const rippleY = this.bounds.top + this.bounds.height * 0.848
    this.ripple?.setPosition(rippleX, rippleY).setScale(rippleScale)

    const hudX = this.bounds.left + this.bounds.width * 0.50
    const hudY = this.bounds.top + this.bounds.height * 0.690
    const hudWidth = Phaser.Math.Clamp(this.scene.scale.width * 0.22, 176, 220)
    const hudHeight = 58
    this.hudBg?.setPosition(hudX, hudY).setSize(hudWidth, hudHeight)
    this.hudTitle?.setPosition(hudX, hudY - 10)
    this.hudHint?.setPosition(hudX, hudY + 11)
  }

  private destroyVisuals(): void {
    if (this.ripple) this.scene.tweens.killTweensOf(this.ripple)
    if (this.hudBg) this.scene.tweens.killTweensOf(this.hudBg)
    this.ripple?.destroy()
    this.hudBg?.destroy()
    this.hudTitle?.destroy()
    this.hudHint?.destroy()
    this.ripple = null
    this.hudBg = null
    this.hudTitle = null
    this.hudHint = null
  }

  private clearTimers(): void {
    this.biteTimer?.remove(false)
    this.escapeTimer?.remove(false)
    this.resultTimer?.remove(false)
    this.biteTimer = undefined
    this.escapeTimer = undefined
    this.resultTimer = undefined
  }

  private storageKey(): string {
    return `${FISHING_STORAGE_PREFIX}${this.profileId}`
  }

  private readStats(): StoredFishingStats {
    if (typeof window === 'undefined') {
      return { version: 1, totalCatches: 0, bestSizeCm: 0, bestCatchName: null }
    }
    try {
      const raw = window.localStorage.getItem(this.storageKey())
      if (!raw) return { version: 1, totalCatches: 0, bestSizeCm: 0, bestCatchName: null }
      const parsed = JSON.parse(raw) as Partial<StoredFishingStats>
      return {
        version: 1,
        totalCatches: typeof parsed.totalCatches === 'number' ? Math.max(0, Math.floor(parsed.totalCatches)) : 0,
        bestSizeCm: typeof parsed.bestSizeCm === 'number' ? Math.max(0, Math.floor(parsed.bestSizeCm)) : 0,
        bestCatchName: typeof parsed.bestCatchName === 'string' ? parsed.bestCatchName : null,
      }
    } catch {
      return { version: 1, totalCatches: 0, bestSizeCm: 0, bestCatchName: null }
    }
  }

  private writeStats(): void {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(this.storageKey(), JSON.stringify(this.stats))
    } catch {
      // Fishing remains playable even when persistent storage is unavailable.
    }
  }
}
