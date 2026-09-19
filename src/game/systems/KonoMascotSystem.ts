import Phaser from 'phaser'
import { RenderLayers } from '../engine/RenderLayers'
import { SANCTUARY_EVENTS } from '../sanctuary/runtime'
import type { EnvironmentSnapshot } from '../sanctuary/environmentManager'
import type { DayPhase, SanctuaryWeather } from '../sanctuary/types'
import type { KonoContextAction, KonoLandmarkId } from './KonoInteractionSystem'
import { PHASE_LIGHT } from './sanctuaryLighting'
import type { MascotObstacle } from '../data/buildAssets'

const SOURCE_HEIGHT = 1_086
const MASCOT_HEIGHT_RATIO = 0.064
const ASSET_ROOT = '/garden/kono'

const WALK_FRAMES = {
  down: ['kono-walk-down-01', 'kono-walk-down-02', 'kono-walk-down-03'],
  up: ['kono-walk-up-01', 'kono-walk-up-02', 'kono-walk-up-03'],
  left: ['kono-walk-left-01', 'kono-walk-left-02'],
  right: ['kono-walk-right-01', 'kono-walk-right-02'],
} as const

type WalkDirection = keyof typeof WALK_FRAMES
type ReactionTexture = 'kono-happy' | 'kono-excited' | 'kono-question' | 'kono-sleep' | 'kono-tea' | 'kono-read' | 'kono-idle' | 'kono-pond' | 'kono-fishing'

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

const WANDER_NODE_POOL: readonly NavNodeId[] = ['house', 'mailbox', 'garden', 'west-junction', 'north-west', 'north-center', 'cherry', 'terrace-entry', 'lanterns', 'pond-north', 'pond-west', 'pond-east', 'bridge']
// The roofed cottage and the tree canopy are the only wander stops that read as actual shelter --
// used to bias where KONO heads while it's raining or snowing, without needing new weather-specific
// art (no umbrella/huddle pose exists, so this is a behavioral reaction only).
const SHELTERED_NODES: ReadonlySet<NavNodeId> = new Set(['house', 'cherry'])
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

const POND_EXCLUSION = Object.freeze({ x: 0.555, y: 0.635, rx: 0.155, ry: 0.085 })

const insideEllipse = (point: { x: number; y: number }, ellipse: { x: number; y: number; rx: number; ry: number }): boolean => {
  const nx = (point.x - ellipse.x) / ellipse.rx
  const ny = (point.y - ellipse.y) / ellipse.ry
  return nx * nx + ny * ny < 1
}

const idleReactionForNode = (nodeId: NavNodeId, phase: DayPhase): ReactionTexture | null => {
  if (nodeId === 'garden') return 'kono-happy'
  if (nodeId === 'pond-north' || nodeId === 'pond-west' || nodeId === 'pond-east') return Math.random() < 0.5 ? 'kono-pond' : 'kono-fishing'
  if (nodeId === 'bridge') return 'kono-fishing'
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
  if (action.landmarkId === 'pond') return 'kono-pond'
  if (action.landmarkId === 'bridge') return 'kono-fishing'
  if (action.id.includes('mailbox')) return 'kono-question'
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
  private weather: SanctuaryWeather = 'clear'
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
  private obstacles: MascotObstacle[] = []
  private focusCompanion = false

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
    scene.load.image('kono-pond', `${ASSET_ROOT}/pond.png`)
    scene.load.image('kono-fishing', `${ASSET_ROOT}/fishing.png`)
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
    this.scene.game.events.on(SANCTUARY_EVENTS.celebrate, this.celebrate, this)
    this.scene.game.events.on(SANCTUARY_EVENTS.focusCompanion, this.setFocusCompanion, this)
    if (phase === 'night') this.enterNightSleep()
    else this.pickWanderTarget(this.scene.time.now + 1_200)
    this.applyLighting()
  }

  setReducedMotion(reducedMotion: boolean): void {
    this.reducedMotion = reducedMotion
  }

  /** Decorate mode pauses the whole render loop while it's open (see GardenCard's `paused` prop),
   * so a new footprint only actually has to be respected once play resumes — at that point the
   * next update() tick's ensureSafePosition() call already relocates KONO off any point that's
   * now blocked, and clears any in-flight route through it, with no extra bookkeeping needed here. */
  setObstacles(obstacles: MascotObstacle[]): void {
    this.obstacles = obstacles
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
      if (this.focusCompanion) {
        this.forcedTarget = true
        this.navigateToNode('cherry')
      }
    }
    this.applyLighting()
  }

  private isSheltering(): boolean {
    return this.weather === 'rain' || this.weather === 'snow'
  }

  setWeather(weather: SanctuaryWeather): void {
    this.weather = weather
  }

  resize(bounds: Phaser.Geom.Rectangle): void {
    this.bounds.setTo(bounds.x, bounds.y, bounds.width, bounds.height)
    this.positionVisuals()
  }

  update(timeMs: number, deltaSeconds: number, environment: EnvironmentSnapshot): void {
    this.setPhase(environment.phase)
    this.setWeather(environment.weather)
    this.ensureSafePosition()
    this.applyLighting()
    if (this.phase === 'night') {
      this.setTexture('kono-sleep')
      this.positionVisuals()
      return
    }

    // A focus-companion reaction (see setFocusCompanion) holds regardless of its own timer -- it
    // only ever lifts when focus itself ends, not after the usual short reaction window.
    if (this.reactionTexture && (timeMs < this.reactionUntil || this.focusCompanion)) {
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
    // A slower, more careful pace picking through rain or snow -- the only weather cue available
    // without new art, but a believable one on its own.
    const weatherSpeed = this.isSheltering() ? phaseSpeed * 0.78 : phaseSpeed
    const speed = this.reducedMotion ? weatherSpeed * 0.48 : weatherSpeed
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
        const atFocusSpot = this.focusCompanion && this.destinationNode === 'cherry'
        this.destinationNode = null
        if (atFocusSpot) {
          this.beginReaction('kono-read', timeMs + 1_350)
        } else if (idleReaction && idleReaction !== 'kono-idle' && Math.random() < 0.58) {
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
    if (this.isWalkablePoint(proposed)) {
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

  /** Fired from outside the scene (see GardenCard's celebrateSignal prop) when the student actually
   * finishes something -- clearing today's list, a streak milestone -- so KONO reacts to the moment
   * itself, not only to a click on the sprite. Reuses the exact same reaction textures/duration as a
   * pointer tap, just triggered externally. */
  celebrate(): void {
    if (this.phase === 'night') return
    this.beginReaction(Math.random() < 0.5 ? 'kono-excited' : 'kono-happy', this.scene.time.now + 1_600)
  }

  /** Fired from outside the scene (see GardenCard's focusCompanionActive prop) when a Focus Session
   * starts or ends. While active, KONO heads for the cherry tree, settles into its reading pose, and
   * skips normal wandering -- a calm companion rather than a distraction -- then resumes wandering
   * the moment focus ends. */
  setFocusCompanion(active: boolean): void {
    if (active === this.focusCompanion) return
    this.focusCompanion = active
    if (active) {
      this.pendingReaction = null
      if (this.phase !== 'night') {
        this.forcedTarget = true
        this.navigateToNode('cherry')
      }
    } else {
      this.forcedTarget = false
      this.reactionTexture = null
      this.reactionUntil = 0
      this.nextWanderAt = this.scene.time.now
    }
  }

  destroy(): void {
    this.scene.game.events.off(SANCTUARY_EVENTS.interaction, this.handleInteraction, this)
    this.scene.game.events.off(SANCTUARY_EVENTS.celebrate, this.celebrate, this)
    this.scene.game.events.off(SANCTUARY_EVENTS.focusCompanion, this.setFocusCompanion, this)
    this.sprite?.removeAllListeners()
    this.sprite?.destroy()
    this.shadow?.destroy()
  }


  private isWalkablePoint = (point: { x: number; y: number }): boolean => {
    if (point.x < 0.18 || point.x > 0.82 || point.y < 0.20 || point.y > 0.80) return false
    if (insideEllipse(point, POND_EXCLUSION)) return false
    return this.obstacles.every((obstacle) => !insideEllipse(point, obstacle))
  }

  private ensureSafePosition(): void {
    if (this.isWalkablePoint(this.position)) return
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
        return Math.hypot(point.x - this.position.x, point.y - this.position.y) > 0.055 && this.isWalkablePoint(point)
      })
      // While it's raining or snowing, head for shelter (the cottage or the tree canopy) rather than
      // an exposed spot like the pond or bridge, whenever one is actually reachable.
      const sheltered = candidates.filter((id) => SHELTERED_NODES.has(id))
      const pool = this.isSheltering() && sheltered.length ? sheltered : candidates.length ? candidates : [...WANDER_NODE_POOL]
      const next = Phaser.Utils.Array.GetRandom([...pool])
      this.navigateToNode(next)
    }
    // Lingers longer once it reaches shelter in bad weather, rather than dashing straight back out.
    this.nextWanderAt = timeMs + (this.isSheltering() && SHELTERED_NODES.has(this.closestNode(this.position)) ? Phaser.Math.Between(7_000, 12_000) : Phaser.Math.Between(3_800, 7_200))
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
    this.route = routePoints.filter(this.isWalkablePoint)
  }

  /** Prefers a node KONO can actually stand on — a decoration placed on or near a nav node would
   * otherwise make that node its own unsafe fallback. Only falls back to the nearest node
   * regardless of blockage if every single one is somehow blocked, so this never returns nothing. */
  private closestNode(point: { x: number; y: number }): NavNodeId {
    let closest: NavNodeId = 'west-junction'
    let closestWalkable: NavNodeId | null = null
    let best = Number.POSITIVE_INFINITY
    let bestWalkable = Number.POSITIVE_INFINITY
    ;(Object.keys(NAV_NODES) as NavNodeId[]).forEach((id) => {
      const candidate = NAV_NODES[id]
      const distance = Math.hypot(candidate.x - point.x, candidate.y - point.y)
      if (distance < best) {
        best = distance
        closest = id
      }
      if (distance < bestWalkable && this.isWalkablePoint(candidate)) {
        bestWalkable = distance
        closestWalkable = id
      }
    })
    return closestWalkable ?? closest
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
