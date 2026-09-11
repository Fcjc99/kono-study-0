import Phaser from 'phaser'
import { RenderLayers } from '../engine/RenderLayers'
import { SANCTUARY_EVENTS } from '../sanctuary/runtime'
import {getKonoActions, type ActionContext, type KonoLandmarkId, type KonoContextAction, type KonoInteractionSummary} from '../sanctuary/konoActions'
import type { DayPhase } from '../sanctuary/types'
export type {KonoContextAction,KonoInteractionSummary,KonoLandmarkId} from '../sanctuary/konoActions'

interface StoredInteractionStats extends KonoInteractionSummary {
  version: 1
}

const STORAGE_PREFIX = 'kono:sanctuary:interactions:v1:'
const REPEAT_GUARD_MS = 520

const SPOTS: Record<KonoLandmarkId, { x: number; y: number }> = {
  house: { x: 0.275, y: 0.515 },
  garden: { x: 0.252, y: 0.632 },
  cherry: { x: 0.486, y: 0.255 },
  pond: { x: 0.565, y: 0.627 },
  bridge: { x: 0.505, y: 0.744 },
  mailbox: { x: 0.333, y: 0.485 },
  lanterns: { x: 0.748, y: 0.455 },
}

const PHASE_LABEL: Readonly<Record<DayPhase, string>> = Object.freeze({
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
  night: 'Night',
})

export class KonoInteractionSystem {
  private readonly scene: Phaser.Scene
  private bounds = new Phaser.Geom.Rectangle()
  private reducedMotion = false
  private profileId = 'unassigned'
  private stats: StoredInteractionStats = {
    version: 1,
    totalInteractions: 0,
    lastActionId: null,
    lastLandmarkId: null,
    landmarkVisits: {},
  }

  private activeAction: KonoContextAction | null = null
  private hudBg: Phaser.GameObjects.Rectangle | null = null
  private hudMeta: Phaser.GameObjects.Text | null = null
  private hudTitle: Phaser.GameObjects.Text | null = null
  private hudHint: Phaser.GameObjects.Text | null = null
  private cueSprites = new Set<Phaser.GameObjects.Image>()
  private finishTimer?: Phaser.Time.TimerEvent
  private lastStartedActionId: string | null = null
  private lastStartedAt = -10_000

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  create(reducedMotion: boolean, profileId: string): void {
    this.reducedMotion = reducedMotion
    this.setProfile(profileId)
  }

  setReducedMotion(reducedMotion: boolean): void {
    this.reducedMotion = reducedMotion
  }

  setProfile(profileId: string): void {
    const next = profileId || 'unassigned'
    if (next !== this.profileId) this.finish(true)
    this.profileId = next
    this.stats = this.readStats()
  }

  getSummary(): KonoInteractionSummary {
    return {
      totalInteractions: this.stats.totalInteractions,
      lastActionId: this.stats.lastActionId,
      lastLandmarkId: this.stats.lastLandmarkId,
      landmarkVisits: { ...this.stats.landmarkVisits },
    }
  }

  getActions(landmarkId:KonoLandmarkId,context:ActionContext):KonoContextAction[]{return getKonoActions(landmarkId,context)}

  start(action: KonoContextAction): void {
    const now = this.scene.time.now
    if (this.lastStartedActionId === action.id && now - this.lastStartedAt < REPEAT_GUARD_MS) return
    this.lastStartedActionId = action.id
    this.lastStartedAt = now

    this.finish(true)
    this.activeAction = action
    this.stats.totalInteractions += 1
    this.stats.lastActionId = action.id
    this.stats.lastLandmarkId = action.landmarkId
    this.stats.landmarkVisits[action.landmarkId] = (this.stats.landmarkVisits[action.landmarkId] ?? 0) + 1
    this.writeStats()

    this.ensureHud()
    const visits = this.stats.landmarkVisits[action.landmarkId] ?? 1
    this.hudMeta?.setText(`KONO · ${PHASE_LABEL[action.phase]} · visit ${visits}`)
    this.hudTitle?.setText(action.title)
    this.hudHint?.setText(action.hint)
    this.spawnCue(action)
    this.positionVisuals()

    if (!this.reducedMotion && this.hudBg) {
      this.scene.tweens.killTweensOf([this.hudBg, this.hudMeta, this.hudTitle, this.hudHint])
      this.hudBg.setAlpha(0).setScale(0.985)
      this.hudMeta?.setAlpha(0)
      this.hudTitle?.setAlpha(0)
      this.hudHint?.setAlpha(0)
      this.scene.tweens.add({
        targets: [this.hudBg, this.hudMeta, this.hudTitle, this.hudHint],
        alpha: 1,
        duration: 160,
        ease: 'Sine.Out',
      })
      this.scene.tweens.add({ targets: this.hudBg, scaleX: 1, scaleY: 1, duration: 180, ease: 'Sine.Out' })
    } else {
      this.hudBg?.setAlpha(1)
      this.hudMeta?.setAlpha(1)
      this.hudTitle?.setAlpha(1)
      this.hudHint?.setAlpha(1)
    }

    this.scene.game.events.emit(SANCTUARY_EVENTS.interaction, {
      type: 'start',
      action,
      summary: this.getSummary(),
    })

    const duration = this.reducedMotion ? Math.min(1_900, action.durationMs) : action.durationMs
    this.finishTimer = this.scene.time.delayedCall(duration, () => this.finish(false))
  }

  resize(bounds: Phaser.Geom.Rectangle): void {
    this.bounds.setTo(bounds.x, bounds.y, bounds.width, bounds.height)
    this.positionVisuals()
  }

  destroy(): void {
    this.finish(true)
    this.destroyHud()
  }

  private ensureHud(): void {
    if (this.hudBg) return
    this.hudBg = this.scene.add.rectangle(0, 0, 286, 72, 0xf5ecdf, 0.97)
      .setStrokeStyle(2, 0xb58a6d, 0.92)
      .setDepth(RenderLayers.interactionHud)
    this.hudMeta = this.scene.add.text(0, 0, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '9px',
      fontStyle: 'bold',
      color: '#8a6a58',
      align: 'center',
    }).setOrigin(0.5).setDepth(RenderLayers.interactionHud + 1)
    this.hudTitle = this.scene.add.text(0, 0, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#45352f',
      align: 'center',
    }).setOrigin(0.5).setDepth(RenderLayers.interactionHud + 1)
    this.hudHint = this.scene.add.text(0, 0, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '10px',
      color: '#66564e',
      align: 'center',
      wordWrap: { width: 258 },
    }).setOrigin(0.5).setDepth(RenderLayers.interactionHud + 1)
  }

  private positionVisuals(): void {
    if (this.bounds.width <= 0 || this.bounds.height <= 0) return
    const hudX = this.bounds.x + this.bounds.width * 0.5
    const hudY = this.bounds.y + this.bounds.height * 0.54
    this.hudBg?.setPosition(hudX, hudY)
    this.hudMeta?.setPosition(hudX, hudY - 22)
    this.hudTitle?.setPosition(hudX, hudY - 5)
    this.hudHint?.setPosition(hudX, hudY + 17)
  }

  private spawnCue(action: KonoContextAction): void {
    if (action.cue === 'none' || this.bounds.width <= 0) return
    const spot = SPOTS[action.landmarkId]
    const x = this.bounds.x + this.bounds.width * spot.x
    const y = this.bounds.y + this.bounds.height * spot.y
    const sceneScale = this.bounds.width / 1448

    if (action.cue === 'ripple') {
      const ripple = this.scene.add.image(x, y, 'ripple-02')
        .setDepth(RenderLayers.interaction)
        .setAlpha(action.phase === 'night' ? 0.38 : 0.52)
        .setScale(sceneScale * 0.62)
      this.cueSprites.add(ripple)
      if (!this.reducedMotion) {
        this.scene.tweens.add({
          targets: ripple,
          alpha: 0,
          scaleX: ripple.scaleX * 1.32,
          scaleY: ripple.scaleY * 1.32,
          duration: 1_350,
          ease: 'Sine.Out',
          onComplete: () => this.destroyCue(ripple),
        })
      }
      return
    }

    const texturePrefix = action.cue === 'petal' ? 'petal' : action.cue === 'firefly' ? 'firefly' : 'leaf'
    const count = this.reducedMotion ? 1 : action.cue === 'firefly' ? 2 : 2
    for (let i = 0; i < count; i += 1) {
      const id = Phaser.Math.Between(1, 4).toString().padStart(2, '0')
      const sprite = this.scene.add.image(
        x + Phaser.Math.Between(-18, 18) * sceneScale,
        y + Phaser.Math.Between(-10, 10) * sceneScale,
        `${texturePrefix}-${id}`,
      )
        .setDepth(RenderLayers.interaction)
        .setAlpha(action.cue === 'firefly' ? 0.64 : 0.52)
        .setScale(sceneScale * (action.cue === 'firefly' ? 0.48 : 0.60))
      this.cueSprites.add(sprite)
      if (!this.reducedMotion) {
        this.scene.tweens.add({
          targets: sprite,
          x: sprite.x + Phaser.Math.Between(-12, 12) * sceneScale,
          y: sprite.y - Phaser.Math.Between(8, 20) * sceneScale,
          alpha: 0,
          angle: action.cue === 'firefly' ? 0 : Phaser.Math.Between(-12, 12),
          duration: Phaser.Math.Between(1_150, 1_650),
          delay: i * 90,
          ease: 'Sine.Out',
          onComplete: () => this.destroyCue(sprite),
        })
      }
    }
  }

  private finish(immediate: boolean): void {
    this.finishTimer?.remove(false)
    this.finishTimer = undefined
    if (!this.activeAction && !this.hudBg && this.cueSprites.size === 0) return
    const completedAction = this.activeAction
    this.activeAction = null

    if (immediate || this.reducedMotion) {
      this.hudBg?.setAlpha(0)
      this.hudMeta?.setAlpha(0)
      this.hudTitle?.setAlpha(0)
      this.hudHint?.setAlpha(0)
      this.clearCues()
    } else {
      const hudTargets = [this.hudBg, this.hudMeta, this.hudTitle, this.hudHint].filter(Boolean) as Phaser.GameObjects.GameObject[]
      if (hudTargets.length) {
        this.scene.tweens.add({ targets: hudTargets, alpha: 0, duration: 220, ease: 'Sine.Out' })
      }
      this.scene.time.delayedCall(260, () => this.clearCues())
    }

    if (completedAction) {
      this.scene.game.events.emit(SANCTUARY_EVENTS.interaction, {
        type: 'finish',
        action: completedAction,
        summary: this.getSummary(),
      })
    }
  }

  private destroyCue(sprite: Phaser.GameObjects.Image): void {
    this.cueSprites.delete(sprite)
    sprite.destroy()
  }

  private clearCues(): void {
    this.cueSprites.forEach((sprite) => {
      this.scene.tweens.killTweensOf(sprite)
      sprite.destroy()
    })
    this.cueSprites.clear()
  }

  private destroyHud(): void {
    this.hudBg?.destroy(); this.hudBg = null
    this.hudMeta?.destroy(); this.hudMeta = null
    this.hudTitle?.destroy(); this.hudTitle = null
    this.hudHint?.destroy(); this.hudHint = null
  }

  private readStats(): StoredInteractionStats {
    if (typeof window === 'undefined') return { version: 1, totalInteractions: 0, lastActionId: null, lastLandmarkId: null, landmarkVisits: {} }
    try {
      const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${this.profileId}`)
      if (!raw) return { version: 1, totalInteractions: 0, lastActionId: null, lastLandmarkId: null, landmarkVisits: {} }
      const parsed = JSON.parse(raw) as Partial<StoredInteractionStats>
      return {
        version: 1,
        totalInteractions: typeof parsed.totalInteractions === 'number' && Number.isFinite(parsed.totalInteractions) ? Math.max(0, Math.floor(parsed.totalInteractions)) : 0,
        lastActionId: typeof parsed.lastActionId === 'string' ? parsed.lastActionId : null,
        lastLandmarkId: typeof parsed.lastLandmarkId === 'string' && parsed.lastLandmarkId in SPOTS
          ? parsed.lastLandmarkId as KonoLandmarkId
          : null,
        landmarkVisits: parsed.landmarkVisits && typeof parsed.landmarkVisits === 'object' ? parsed.landmarkVisits : {},
      }
    } catch {
      return { version: 1, totalInteractions: 0, lastActionId: null, lastLandmarkId: null, landmarkVisits: {} }
    }
  }

  private writeStats(): void {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(`${STORAGE_PREFIX}${this.profileId}`, JSON.stringify(this.stats))
    } catch {
      // Storage can be unavailable in private/restricted browser modes; interactions still work for the session.
    }
  }
}
