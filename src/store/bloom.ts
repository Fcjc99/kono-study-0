/** KONO Bloom (components/KonoBloom): drop seeds into KONO's garden jar. They fall, roll and settle; two of
 * the same that touch grow into the next thing on the garden ladder (a bean into a sprout, a sprout into a
 * clover, … a pumpkin into the Great Tree), and two Great Trees make a rainbow and leave room. Growing
 * scores; let the jar fill past the dashed line for a moment and the round's over. The jar is 100 wide and
 * 140 tall (y grows downward); time is in frames at 60 a second. Pure apart from the random drops, so it
 * can be tested. */
export type Ball = { id: number; tier: number; x: number; y: number; vx: number; vy: number; age: number }
export type Pop = { x: number; y: number; tier: number; at: number }
export type Garden = { balls: Ball[]; next: number; score: number; nextId: number; frame: number; danger: number; over: boolean; pops: Pop[]; rainbows: number; best: number }

export const LADDER = [
  { emoji: '🫘', name: 'Bean', color: '#c98a5a' },
  { emoji: '🌱', name: 'Sprout', color: '#9fd86b' },
  { emoji: '🍀', name: 'Clover', color: '#5cc26f' },
  { emoji: '🌼', name: 'Daisy', color: '#ffe066' },
  { emoji: '🌷', name: 'Tulip', color: '#ff8fb1' },
  { emoji: '🌸', name: 'Blossom', color: '#ffc2dc' },
  { emoji: '🌻', name: 'Sunflower', color: '#ffc93c' },
  { emoji: '🪷', name: 'Lotus', color: '#f7a8d8' },
  { emoji: '🍄', name: 'Mushroom', color: '#ff6b5e' },
  { emoji: '🎃', name: 'Pumpkin', color: '#ff9a3c' },
  { emoji: '🌳', name: 'Great Tree', color: '#4caf6a' },
]
export const RADIUS = [4.2, 5.6, 7.2, 8.8, 10.6, 12.6, 14.8, 17.2, 19.8, 22.6, 25.6]
export const JAR = { w: 100, h: 140, line: 26, dropY: 12 }
const G = 0.055, DAMP = 0.995, BOUNCE = 0.12, FRICTION = 0.985
/** Points for growing into a tier: 1, 3, 6, 10, … */
export const points = (tier: number) => (tier + 1) * (tier + 2) / 2

export function newGarden(random: () => number = Math.random): Garden {
  return { balls: [], next: dropTier(random, 0), score: 0, nextId: 1, frame: 0, danger: 0, over: false, pops: [], rainbows: 0, best: 0 }
}
/** What drops next: one of the five smallest, the smallest most often (and bigger ones once you've grown some). */
export function dropTier(random: () => number, best: number): number {
  const top = Math.min(4, Math.max(2, best - 2)), r = random()
  return Math.min(top, Math.floor(r * r * (top + 1)))
}
/** Keeps a drop inside the jar for its size. */
export const clampX = (x: number, tier: number) => Math.max(RADIUS[tier], Math.min(JAR.w - RADIUS[tier], x))

export function drop(g: Garden, x: number, random: () => number = Math.random): Garden {
  if (g.over) return g
  const tier = g.next
  const ball: Ball = { id: g.nextId, tier, x: clampX(x, tier), y: JAR.dropY, vx: 0, vy: 0.4, age: 0 }
  return { ...g, balls: [...g.balls, ball], next: dropTier(random, g.best), nextId: g.nextId + 1 }
}

/** One frame: gravity, the jar's walls and floor, things pushing each other apart, and growing. */
export function step(g: Garden, n = 1): Garden {
  if (g.over) return g
  const balls = g.balls.map(b => ({ ...b }))
  let score = g.score, nextId = g.nextId, rainbows = g.rainbows, best = g.best
  const pops: Pop[] = g.pops.filter(p => g.frame - p.at < 40)
  for (const b of balls) {
    b.vy += G * n; b.vx *= DAMP; b.vy *= DAMP
    b.x += b.vx * n; b.y += b.vy * n; b.age += n
  }
  const gone = new Set<number>(), born: Ball[] = []
  for (let pass = 0; pass < 4; pass++) {
    for (const b of balls) {
      const r = RADIUS[b.tier]
      if (b.x < r) { b.x = r; b.vx = Math.abs(b.vx) * BOUNCE }
      if (b.x > JAR.w - r) { b.x = JAR.w - r; b.vx = -Math.abs(b.vx) * BOUNCE }
      if (b.y > JAR.h - r) { b.y = JAR.h - r; b.vy = -Math.abs(b.vy) * BOUNCE; b.vx *= FRICTION }
    }
    for (let i = 0; i < balls.length; i++) {
      const a = balls[i]; if (gone.has(a.id)) continue
      for (let j = i + 1; j < balls.length; j++) {
        const b = balls[j]; if (gone.has(b.id)) continue
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.0001, min = RADIUS[a.tier] + RADIUS[b.tier]
        if (d >= min) continue
        // Two the same grow into the next one, where they met.
        if (a.tier === b.tier) {
          gone.add(a.id); gone.add(b.id)
          const x = (a.x + b.x) / 2, y = (a.y + b.y) / 2
          if (a.tier === LADDER.length - 1) { score += 100; rainbows++; pops.push({ x, y, tier: a.tier + 1, at: g.frame }) }
          else {
            const tier = a.tier + 1
            born.push({ id: nextId++, tier, x: clampX(x, tier), y: Math.min(y, JAR.h - RADIUS[tier]), vx: (a.vx + b.vx) / 2, vy: Math.min(0, (a.vy + b.vy) / 2), age: 30 })
            score += points(tier); best = Math.max(best, tier); pops.push({ x, y, tier, at: g.frame })
          }
          break
        }
        // Otherwise they push apart, the bigger one moving less.
        const nx = dx / d, ny = dy / d, over = min - d, ma = RADIUS[a.tier] ** 2, mb = RADIUS[b.tier] ** 2, wa = mb / (ma + mb), wb = ma / (ma + mb)
        a.x -= nx * over * wa; a.y -= ny * over * wa; b.x += nx * over * wb; b.y += ny * over * wb
        const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny
        if (rel < 0) { const k = -(1 + BOUNCE) * rel; a.vx -= nx * k * wa; a.vy -= ny * k * wa; b.vx += nx * k * wb; b.vy += ny * k * wb }
      }
    }
  }
  const kept = [...balls.filter(b => !gone.has(b.id)), ...born]
  // Over the line: something that has settled (not one just dropped) sticking up past it, for about 2 seconds.
  const high = kept.some(b => b.age > 90 && b.y - RADIUS[b.tier] < JAR.line && Math.abs(b.vy) < 0.6)
  const danger = high ? g.danger + n : Math.max(0, g.danger - n * 2)
  return { ...g, balls: kept, score, nextId, rainbows, best, pops, frame: g.frame + n, danger, over: danger > 120 }
}
