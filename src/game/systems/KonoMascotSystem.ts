import Phaser from 'phaser'
import { RenderLayers } from '../engine/RenderLayers'
import { SANCTUARY_EVENTS } from '../sanctuary/runtime'
import type { EnvironmentSnapshot } from '../sanctuary/environmentManager'
import type { DayPhase } from '../sanctuary/types'
import type { KonoContextAction, KonoLandmarkId } from './KonoInteractionSystem'
import { PHASE_LIGHT } from './sanctuaryLighting'

const SOURCE_HEIGHT = 1_086
const MASCOT_HEIGHT_RATIO = 0.064
const ASSET_ROOT = '/garden/kono'

const WALK_FRAMES = {
  down: ['kono-walk-down-01', 'kono-walk-down-02'],
  up: ['kono-walk-up-01', 'kono-walk-up-02'],
  left: ['kono-walk-left-01', 'kono-walk-left-02'],
  right: ['kono-walk-right-01', 'kono-walk-right-02'],
} as const

type WalkDirection = keyof typeof WALK_FRAMES
type ReactionTexture = 'kono-happy' | 'kono-excited' | 'kono-question' | 'kono-sleep' | 'kono-tea' | 'kono-read' | 'kono-idle'

type NavNodeId =
  | 'house'
  | 'mailbox'
  | 'garden'
  | 'west-junction'
  | 'north-west'
  | 'north-center'
  | 'tree-approach'
  | 'tree-stairs'
  | 'tree-landing'
  | 'cherry'
  | 'terrace-entry'
  | 'lanterns'
  | 'pond-north'
  | 'pond-west'
  | 'pond-south-west'
  | 'bridge'
  | 'pond-south-east'
  | 'pond-east'

/** Build 22.7.0: KONO only walks on island land/path/bridge/terrace nodes. */
const NAV_NODES: Record<NavNodeId, { x: number; y: number }> = {
  house: { x: 0.275, y: 0.515 },
  mailbox: { x: 0.312, y: 0.500 },
  garden: { x: 0.250, y: 0.650 },
  'west-junction': { x: 0.392, y: 0.555 },
  'north-west': { x: 0.420, y: 0.492 },
  'north-center': { x: 0.545, y: 0.474 },
  // Follow the painted path and stair flight onto the tree plateau.
  'tree-approach': { x: 0.372, y: 0.395 },
  'tree-stairs': { x: 0.442, y: 0.315 },
  'tree-landing': { x: 0.456, y: 0.259 },
  cherry: { x: 0.486, y: 0.255 },
  'terrace-entry': { x: 0.680, y: 0.485 },
  lanterns: { x: 0.748, y: 0.455 },
  'pond-north': { x: 0.575, y: 0.545 },
  'pond-west': { x: 0.390, y: 0.650 },
  'pond-south-west': { x: 0.425, y: 0.715 },
  bridge: { x: 0.505, y: 0.755 },
  'pond-south-east': { x: 0.670, y: 0.735 },
  'pond-east': { x: 0.720, y: 0.640 },
}

const NAV_GRAPH: Record<NavNodeId, readonly NavNodeId[]> = {
  house: ['mailbox', 'west-junction', 'garden'],
  mailbox: ['house', 'west-junction'],
  garden: ['house', 'pond-west'],
  'west-junction': ['house', 'mailbox', 'north-west', 'pond-west'],
  'north-west': ['west-junction', 'north-center', 'tree-approach'],
  'north-center': ['north-west', 'pond-north', 'terrace-entry'],
  'tree-approach': ['north-west', 'tree-stairs'],
  'tree-stairs': ['tree-approach', 'tree-landing'],
  'tree-landing': ['tree-stairs', 'cherry'],
  cherry: ['tree-landing'],
  'terrace-entry': ['north-center', 'lanterns', 'pond-east'],
  lanterns: ['terrace-entry'],
  'pond-north': ['north-center'],
  'pond-west': ['garden', 'west-junction', 'pond-south-west'],
  'pond-south-west': ['pond-west', 'bridge'],
  bridge: ['pond-south-west', 'pond-south-east'],
  'pond-south-east': ['bridge', 'pond-east'],
  'pond-east': ['pond-south-east', 'terrace-entry'],
}

const WANDER_NODE_POOL: readonly NavNodeId[] = ['house', 'mailbox', 'garden', 'west-junction', 'north-west', 'north-center', 'cherry', 'terrace-entry', 'lanterns', 'pond-north', 'pond-west', 'pond-east']
const DEFAULT_SPAWN_NODE: NavNodeId = 'west-junction'

const REACTION_SPOTS: Record<KonoLandmarkId, { x: number; y: number }> = {
  house: NAV_NODES.house,
  garden: NAV_NODES.garden,
  cherry: NAV_NODES.cherry,
  pond: NAV_NODES['pond-north'],
  bridge: NAV_NODES.bridge,
  mailbox: NAV_NODES.mailbox,
  lanterns: NAV_NODES.lanterns,
}

const POND_EXCLUSION = Object.freeze({ cx: 0.555, cy: 0.635, rx: 0.155, ry: 0.085 })

const isWalkablePoint = (point: { x: number; y: number }): boolean => {
  if (point.x < 0.18 || point.x > 0.82 || point.y < 0.20 || point.y > 0.80) return false
  const nx = (point.x - POND_EXCLUSION.cx) / POND_EXCLUSION.rx
  const ny = (point.y - POND_EXCLUSION.cy) / POND_EXCLUSION.ry
  return nx * nx + ny * ny >= 1
}

const idleReactionForNode = (nodeId: NavNodeId, phase: DayPhase): ReactionTexture | null => {
  if (nodeId === 'garden') return 'kono-happy'
  if (nodeId === 'pond-north' || nodeId === 'pond-west' || nodeId === 'pond-east') return 'kono-question'
  if (nodeId === 'lanterns') return phase === 'evening' ? 'kono-tea' : phase === 'night' ? 'kono-sleep' : 'kono-idle'
  if (nodeId === 'cherry') return phase === 'night' ? 'kono-sleep' : 'kono-read'
  if (nodeId === 'house') return phase === 'night' ? 'kono-sleep' : null
  return null
}

interface InteractionPayload {
  type?: string
  action?: KonoContextAction
}

const textureForAction = (action: KonoContextAction): ReactionTexture => {
  if (action.id.includes('rest')) return action.phase === 'night' ? 'kono-sleep' : 'kono-tea'
  if (action.id.includes('read')) return 'kono-read'
  if (action.id.includes('tea') || action.id.includes('sit')) return 'kono-tea'
  if (action.landmarkId === 'pond' || action.landmarkId === 'bridge' || action.id.includes('mailbox')) return 'kono-question'
  if (action.landmarkId === 'garden' || action.landmarkId === 'cherry') return 'kono-happy'
  if (action.landmarkId === 'house' && action.phase === 'evening') return 'kono-tea'
  return 'kono-excited'
}

export class KonoMascotSystem {
  private readonly scene: Phaser.Scene
  private sprite!: Phaser.GameObjects.Image
  private shadow!: Phaser.GameObjects.Image
  private bounds = new Phaser.Geom.Rectangle()
  // Build 22.7.39: spawn on a verified navigation node. The previous
  // (0.455, 0.600) start point was inside the pond exclusion ellipse, which
  // could trap KONO in the water guard before its first route even began.
  private position = { ...NAV_NODES[DEFAULT_SPAWN_NODE] }
  private target = { ...this.position }
  private route: { x: number; y: number }[] = []
  private phase: DayPhase = 'afternoon'
  private reducedMotion = false
  private walkDirection: WalkDirection = 'down'
  private currentTexture = 'kono-idle'
  private nextWanderAt = 0
  private reactionTexture: ReactionTexture | null = null
  private reactionUntil = 0
  private pendingReaction: ReactionTexture | null = null
  private forcedTarget = false
  private lastFrameIndex = -1
  private destinationNode: NavNodeId | null = null

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  static preload(scene: Phaser.Scene): void {
    scene.load.image('kono-idle', `${ASSET_ROOT}/idle.png`)
    scene.load.image('kono-happy', `${ASSET_ROOT}/happy.png`)
    scene.load.image('kono-excited', `${ASSET_ROOT}/excited.png`)
    scene.load.image('kono-question', `${ASSET_ROOT}/question.png`)
    scene.load.image('kono-sleep', `${ASSET_ROOT}/sleep.png`)
    scene.load.image('kono-tea', `${ASSET_ROOT}/tea.png`)
    scene.load.image('kono-read', `${ASSET_ROOT}/read.png`)
    scene.load.image('kono-shadow', `${ASSET_ROOT}/shadow.png`)
    WALK_FRAMES.down.forEach((key, index) => scene.load.image(key, `${ASSET_ROOT}/walk-down-0${index + 1}.png`))
    WALK_FRAMES.up.forEach((key, index) => scene.load.image(key, `${ASSET_ROOT}/walk-up-0${index + 1}.png`))
    WALK_FRAMES.left.forEach((key, index) => scene.load.image(key, `${ASSET_ROOT}/walk-left-0${index + 1}.png`))
    WALK_FRAMES.right.forEach((key, index) => scene.load.image(key, `${ASSET_ROOT}/walk-right-0${index + 1}.png`))
  }

  create(reducedMotion: boolean, phase: DayPhase): void {
    this.reducedMotion = reducedMotion
    this.phase = phase
    this.ensureSafePosition()

    this.shadow = this.scene.add.image(0, 0, 'kono-shadow')
      .setOrigin(0.5)
      .setDepth(RenderLayers.critters + 0.18)
      .setAlpha(0.46)

    this.sprite = this.scene.add.image(0, 0, 'kono-idle')
      .setOrigin(0.5, 0.88)
      .setDepth(RenderLayers.critters + 0.30)
      .setInteractive({ useHandCursor: true })

    this.sprite.on('pointerdown', () => {
      this.beginReaction(Math.random() < 0.35 ? 'kono-excited' : 'kono-happy', this.scene.time.now + 1_250)
    })

    this.scene.game.events.on(SANCTUARY_EVENTS.interaction, this.handleInteraction, this)
    if (phase === 'night') this.enterNightSleep()
    else this.pickWanderTarget(this.scene.time.now + 1_200)
    this.applyLighting()
  }

  setReducedMotion(reducedMotion: boolean): void {
    this.reducedMotion = reducedMotion
  }

  getNormalizedPosition(): { x: number; y: number } {
    return { x: this.position.x, y: this.position.y }
  }

  setPhase(phase: DayPhase): void {
    if (phase === this.phase) return
    const wasNight = this.phase === 'night'
    this.phase = phase
    if (phase === 'night') this.enterNightSleep()
    else if (wasNight) {
      this.reactionTexture = null
      this.reactionUntil = 0
      this.nextWanderAt = this.scene.time.now + 1_200
      this.setTexture('kono-idle')
    }
    this.applyLighting()
  }

  resize(bounds: Phaser.Geom.Rectangle): void {
    this.bounds.setTo(bounds.x, bounds.y, bounds.width, bounds.height)
    this.positionVisuals()
  }

  update(timeMs: number, deltaSeconds: number, environment: EnvironmentSnapshot): void {
    this.setPhase(environment.phase)
    this.ensureSafePosition()
    this.applyLighting()
    if (this.phase === 'night') {
      this.setTexture('kono-sleep')
      this.positionVisuals()
      return
    }

    if (this.reactionTexture && timeMs < this.reactionUntil) {
      this.setTexture(this.reactionTexture)
      this.positionVisuals()
      return
    }

    if (this.reactionTexture && timeMs >= this.reactionUntil) {
      this.reactionTexture = null
      this.forcedTarget = false
      this.nextWanderAt = timeMs + Phaser.Math.Between(900, 1_800)
    }

    const activeTarget = this.route[0] ?? this.target
    const dx = activeTarget.x - this.position.x
    const dy = activeTarget.y - this.position.y
    const distance = Math.hypot(dx, dy)
    const phaseSpeed = this.phase === 'evening' ? 0.034 : 0.040
    const speed = this.reducedMotion ? phaseSpeed * 0.48 : phaseSpeed
    const delta = Number.isFinite(deltaSeconds) ? Phaser.Math.Clamp(deltaSeconds, 0, 0.034) : 0
    const step = Math.min(distance, speed * delta)

    // Reach a waypoint only within this frame's travel budget; never snap ahead.
    if (distance <= step) {
      this.position.x = activeTarget.x
      this.position.y = activeTarget.y

      if (this.route.length > 0) {
        this.route.shift()
      }

      if (this.route.length > 0) {
        // Keep the current walk frame between navigation nodes so path turns do not visibly hitch.
        this.positionVisuals()
        return
      }

      if (this.pendingReaction) {
        const reaction = this.pendingReaction
        this.pendingReaction = null
        this.beginReaction(reaction, timeMs + (reaction === 'kono-sleep' ? 2_450 : 1_550))
      } else if (this.destinationNode) {
        const idleReaction = idleReactionForNode(this.destinationNode, this.phase)
        this.destinationNode = null
        if (idleReaction && idleReaction !== 'kono-idle' && Math.random() < 0.58) {
          this.beginReaction(idleReaction, timeMs + (idleReaction === 'kono-sleep' ? 2_300 : 1_350))
        } else {
          this.setTexture('kono-idle')
        }
      } else {
        this.setTexture('kono-idle')
      }

      if (!this.forcedTarget && timeMs >= this.nextWanderAt) this.pickWanderTarget(timeMs)
      this.positionVisuals()
      return
    }

    const proposed = { x: this.position.x + dx / distance * step, y: this.position.y + dy / distance * step }
    if (isWalkablePoint(proposed)) {
      this.position.x = proposed.x
      this.position.y = proposed.y
    } else {
      const safeNode = this.closestNode(this.position)
      this.route = [{ ...NAV_NODES[safeNode] }]
      this.target = { ...NAV_NODES[safeNode] }
    }
    this.walkDirection = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down')
    this.applyWalkFrame(timeMs)
    this.positionVisuals()
  }

  destroy(): void {
    this.scene.game.events.off(SANCTUARY_EVENTS.interaction, this.handleInteraction, this)
    this.sprite?.removeAllListeners()
    this.sprite?.destroy()
    this.shadow?.destroy()
  }


  private ensureSafePosition(): void {
    if (isWalkablePoint(this.position)) return
    const safeNode = this.closestNode(this.position)
    this.position = { ...NAV_NODES[safeNode] }
    this.target = { ...this.position }
    this.route = []
    this.destinationNode = safeNode
    this.forcedTarget = false
  }

  private handleInteraction(payload: InteractionPayload): void {
    if (this.phase === 'night') return
    if (!payload || payload.type !== 'start' || !payload.action) return
    const action = payload.action
    const spot = REACTION_SPOTS[action.landmarkId]
    this.pendingReaction = textureForAction(action)
    this.forcedTarget = true
    const nodeId: NavNodeId = action.landmarkId === 'pond' ? 'pond-north' : action.landmarkId === 'lanterns' ? 'lanterns' : action.landmarkId === 'bridge' ? 'bridge' : action.landmarkId === 'garden' ? 'garden' : action.landmarkId === 'cherry' ? 'cherry' : action.landmarkId === 'mailbox' ? 'mailbox' : 'house'
    this.navigateTo(spot, nodeId)
    if (this.reducedMotion) {
      this.position = { ...spot }
      this.route = []
      const reaction = this.pendingReaction
      this.pendingReaction = null
      this.beginReaction(reaction ?? 'kono-happy', this.scene.time.now + 1_550)
    }
  }

  private beginReaction(texture: ReactionTexture, until: number): void {
    if (this.phase === 'night') return
    this.reactionTexture = texture
    this.reactionUntil = until
    // A pointer reaction can briefly pause travel without discarding its destination action.
    this.setTexture(texture)
  }

  private pickWanderTarget(timeMs: number): void {
    if (this.phase === 'night') return
    {
      const candidates = WANDER_NODE_POOL.filter((id) => {
        const point = NAV_NODES[id]
        return Math.hypot(point.x - this.position.x, point.y - this.position.y) > 0.055
      })
      const next = Phaser.Utils.Array.GetRandom(candidates.length ? [...candidates] : [...WANDER_NODE_POOL])
      this.navigateToNode(next)
    }
    this.nextWanderAt = timeMs + Phaser.Math.Between(3_800, 7_200)
  }

  private navigateToNode(nodeId: NavNodeId): void {
    this.navigateTo(NAV_NODES[nodeId], nodeId)
  }

  private navigateTo(destination: { x: number; y: number }, destinationNode: NavNodeId | null = null): void {
    this.destinationNode = destinationNode
    this.target = { ...destination }
    const startNode = this.closestNode(this.position)
    const endNode = this.closestNode(destination)
    const nodePath = this.findNodePath(startNode, endNode)
    const routePoints = nodePath.map((id) => ({ ...NAV_NODES[id] }))
    if (routePoints.length > 0 && Math.hypot(routePoints[0].x - this.position.x, routePoints[0].y - this.position.y) < 0.015) routePoints.shift()
    if (routePoints.length > 0 && Math.hypot(routePoints[routePoints.length - 1].x - destination.x, routePoints[routePoints.length - 1].y - destination.y) < 0.015) {
      routePoints[routePoints.length - 1] = { ...destination }
    } else {
      routePoints.push({ ...destination })
    }
    this.route = routePoints.filter(isWalkablePoint)
  }

  private closestNode(point: { x: number; y: number }): NavNodeId {
    let closest: NavNodeId = 'west-junction'
    let best = Number.POSITIVE_INFINITY
    ;(Object.keys(NAV_NODES) as NavNodeId[]).forEach((id) => {
      const candidate = NAV_NODES[id]
      const distance = Math.hypot(candidate.x - point.x, candidate.y - point.y)
      if (distance < best) {
        best = distance
        closest = id
      }
    })
    return closest
  }

  private findNodePath(start: NavNodeId, end: NavNodeId): NavNodeId[] {
    if (start === end) return [end]
    const queue: NavNodeId[] = [start]
    const previous = new Map<NavNodeId, NavNodeId | null>([[start, null]])
    while (queue.length > 0) {
      const current = queue.shift() as NavNodeId
      for (const next of NAV_GRAPH[current]) {
        if (previous.has(next)) continue
        previous.set(next, current)
        if (next === end) {
          const path: NavNodeId[] = [end]
          let cursor: NavNodeId | null = current
          while (cursor) {
            path.unshift(cursor)
            cursor = previous.get(cursor) ?? null
          }
          return path
        }
        queue.push(next)
      }
    }
    return [end]
  }

  private applyWalkFrame(timeMs: number): void {
    const frames = WALK_FRAMES[this.walkDirection]
    const cadence = this.reducedMotion ? 390 : 205
    const index = Math.floor(timeMs / cadence) % frames.length
    if (index === this.lastFrameIndex && this.currentTexture === frames[index]) return
    this.lastFrameIndex = index
    this.setTexture(frames[index])
  }

  private setTexture(texture: string): void {
    if (!this.sprite || texture === this.currentTexture) return
    this.currentTexture = texture
    this.sprite.setTexture(texture)
    this.applySpriteScale()
  }

  private enterNightSleep(): void {
    this.position = { ...NAV_NODES.house }
    this.target = { ...this.position }
    this.route = []
    this.pendingReaction = null
    this.reactionTexture = null
    this.reactionUntil = 0
    this.forcedTarget = false
    this.destinationNode = null
    this.setTexture('kono-sleep')
    this.positionVisuals()
  }

  private applyLighting(): void {
    if (!this.sprite) return
    const [tl, tr, bl, br] = PHASE_LIGHT[this.phase].kono
    this.sprite.setTint(tl, tr, bl, br)
    this.shadow?.setAlpha(this.phase === 'night' ? .22 : this.phase === 'evening' ? .48 : .36)
  }

  private applySpriteScale(): void {
    if (!this.sprite || !this.bounds.height) return
    const perspective = Phaser.Math.Clamp(0.90 + (this.position.y - 0.45) * 0.32, 0.86, 1.04)
    // Keep actions readable on phones without changing the foot anchor or route.
    // Very small embedded maps still cap the readability floor to their size.
    const readableFloor = Math.min(26, this.bounds.height * 0.12)
    const targetHeight = Math.max(readableFloor, this.bounds.height * MASCOT_HEIGHT_RATIO * perspective)
    const scale = targetHeight / Math.max(1, this.sprite.height)
    this.sprite.setScale(scale)
    const shadowScale = targetHeight / (SOURCE_HEIGHT * MASCOT_HEIGHT_RATIO)
    this.shadow.setScale(shadowScale)
  }

  private positionVisuals(): void {
    if (!this.bounds.width || !this.sprite) return
    const x = this.bounds.left + this.bounds.width * this.position.x
    const y = this.bounds.top + this.bounds.height * this.position.y
    this.sprite.setPosition(Math.round(x), Math.round(y))
    this.shadow.setPosition(Math.round(x), Math.round(y + this.bounds.height * 0.006))
    this.sprite.setDepth(RenderLayers.critters + 0.30 + this.position.y * 0.12)
    this.shadow.setDepth(RenderLayers.critters + 0.17 + this.position.y * 0.12)
    this.applySpriteScale()
  }
}
