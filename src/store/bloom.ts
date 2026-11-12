/** KONO Bloom (components/KonoBloom): drop fruit into KONO's jar. It falls, rolls and settles; two of the
 * same that touch grow into the next fruit on the ladder (a blueberry into a cherry, a cherry into a
 * strawberry, … a watermelon into the Rainbow Fruit), and two Rainbow Fruits make a rainbow and leave room. Growing
 * scores; let the jar fill past the dashed line for a moment and the round's over. The jar is 100 wide and
 * 140 tall (y grows downward); time is in frames at 60 a second. Pure apart from the random drops, so it
 * can be tested. */
export type Ball = { id: number; tier: number; x: number; y: number; vx: number; vy: number; age: number }
export type Pop = { x: number; y: number; tier: number; at: number }
/** The power-ups: Shake the jar (everything jumps and settles again, maybe into new pairs), Pop a fruit
 * (it's gone), Grow a fruit (one step up the ladder, with its points) and Swap the fruit KONO holds for the
 * one after it. You start with one of each; growing fruit fills a meter that earns another (in turn). */
export type Power = 'shake' | 'pop' | 'grow' | 'swap'
export const POWERS: { id: Power; emoji: string; name: string; help: string }[] = [
  { id: 'shake', emoji: '🫨', name: 'Shake', help: 'Shake the jar: everything jumps and settles again' },
  { id: 'pop', emoji: '💥', name: 'Pop', help: 'Tap a fruit to pop it out of the jar' },
  { id: 'grow', emoji: '✨', name: 'Grow', help: 'Tap a fruit to grow it into the next one' },
  { id: 'swap', emoji: '🔄', name: 'Swap', help: 'Swap the fruit KONO holds for the next one' },
]
/** Points of growing that earn the next power-up. */
export const CHARGE = 60
export type Garden = { balls: Ball[]; next: number; after: number; score: number; nextId: number; frame: number; danger: number; over: boolean; pops: Pop[]; rainbows: number; best: number; powers: Record<Power, number>; charge: number; earned: number }

/** The fruit ladder, smallest first. `kind` is how the fruit is drawn (components/KonoBloom). */
export const LADDER = [
  { emoji: '🫐', name: 'Blueberry', color: '#6f7fe0', kind: 'blueberry' },
  { emoji: '🍒', name: 'Cherry', color: '#f2546b', kind: 'cherry' },
  { emoji: '🍓', name: 'Strawberry', color: '#ff6f86', kind: 'strawberry' },
  { emoji: '🥝', name: 'Kiwi', color: '#9fd86b', kind: 'kiwi' },
  { emoji: '🟣', name: 'Plum', color: '#b277d9', kind: 'plum' },
  { emoji: '🍋', name: 'Lemon', color: '#ffe066', kind: 'lemon' },
  { emoji: '🍑', name: 'Peach', color: '#ffb08a', kind: 'peach' },
  { emoji: '🥭', name: 'Mango', color: '#ffb347', kind: 'mango' },
  { emoji: '🥥', name: 'Coconut', color: '#b07a52', kind: 'coconut' },
  { emoji: '🍉', name: 'Watermelon', color: '#8fd36f', kind: 'melon' },
  { emoji: '🌈', name: 'Rainbow Fruit', color: '#ff9ad5', kind: 'rainbow' },
] as const
export const RADIUS = [4.2, 5.6, 7.2, 8.8, 10.6, 12.6, 14.8, 17.2, 19.8, 22.6, 25.6]
export const JAR = { w: 100, h: 140, line: 26, dropY: 12 }
const G = 0.055, DAMP = 0.995, BOUNCE = 0.12, FRICTION = 0.985
/** Points for growing into a tier: 1, 3, 6, 10, … */
export const points = (tier: number) => (tier + 1) * (tier + 2) / 2

export function newGarden(random: () => number = Math.random): Garden {
  return { balls: [], next: dropTier(random, 0), after: dropTier(random, 0), powers: { shake: 1, pop: 1, grow: 1, swap: 1 }, charge: 0, earned: 0, score: 0, nextId: 1, frame: 0, danger: 0, over: false, pops: [], rainbows: 0, best: 0 }
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
  return { ...g, balls: [...g.balls, ball], next: g.after, after: dropTier(random, g.best), nextId: g.nextId + 1 }
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
  for (let pass = 0; pass < 8; pass++) {
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
        // Resting on each other: a little rolling friction, so a pile settles instead of shivering.
        if (Math.abs(ny) > 0.5) { const f = Math.pow(0.97, n); a.vx *= f; b.vx *= f }
      }
    }
  }
  const kept = [...balls.filter(b => !gone.has(b.id)), ...born]
  // Over the line: something that has settled (not one just dropped) sticking up past it, for about 2 seconds.
  const high = kept.some(b => b.age > 90 && b.y - RADIUS[b.tier] < JAR.line && Math.abs(b.vy) < 0.6)
  const danger = high ? g.danger + n : Math.max(0, g.danger - n * 2)
  return { ...g, ...charged(g, score - g.score), balls: kept, score, nextId, rainbows, best, pops, frame: g.frame + n, danger, over: danger > 120 }
}

/** Growing fills the meter; each time it's full, the next power-up in turn (shake, pop, grow, swap). */
function charged(g: Garden, gained: number): Pick<Garden, 'charge' | 'earned' | 'powers'> {
  let charge = g.charge + gained, earned = g.earned
  const powers = { ...g.powers }
  while (charge >= CHARGE) { charge -= CHARGE; powers[POWERS[earned % POWERS.length].id]++; earned++ }
  return { charge, earned, powers }
}
const spend = (g: Garden, p: Power) => ({ ...g.powers, [p]: g.powers[p] - 1 })

/** Shake: every fruit jumps (up and a little sideways) and the danger count starts again while they settle. */
export function shake(g: Garden, random: () => number = Math.random): Garden {
  if (g.over || g.powers.shake < 1 || !g.balls.length) return g
  const balls = g.balls.map(b => ({ ...b, vx: b.vx + (random() - 0.5) * 2.4, vy: b.vy - 1.4 - random() * 1.2, age: Math.min(b.age, 40) }))
  return { ...g, balls, danger: 0, powers: spend(g, 'shake') }
}
/** The fruit at a point in the jar (the top one if they overlap), or undefined. */
export function fruitAt(g: Garden, x: number, y: number): Ball | undefined {
  let hit: Ball | undefined
  for (const b of g.balls) if (Math.hypot(b.x - x, b.y - y) <= RADIUS[b.tier] + 2 && (!hit || b.y < hit.y)) hit = b
  return hit
}
/** Pop: that fruit is gone (no points). */
export function popFruit(g: Garden, id: number): Garden {
  const b = g.balls.find(b => b.id === id)
  if (g.over || g.powers.pop < 1 || !b) return g
  return { ...g, balls: g.balls.filter(o => o !== b), pops: [...g.pops, { x: b.x, y: b.y, tier: b.tier, at: g.frame }], powers: spend(g, 'pop') }
}
/** Grow: that fruit grows one step, with the points for it (a Rainbow Fruit makes a rainbow and leaves room). */
export function growFruit(g: Garden, id: number): Garden {
  const b = g.balls.find(b => b.id === id)
  if (g.over || g.powers.grow < 1 || !b) return g
  const powers = spend(g, 'grow')
  if (b.tier === LADDER.length - 1) return { ...g, powers, balls: g.balls.filter(o => o !== b), score: g.score + 100, rainbows: g.rainbows + 1, pops: [...g.pops, { x: b.x, y: b.y, tier: b.tier + 1, at: g.frame }] }
  const tier = b.tier + 1
  const grown = { ...b, tier, x: clampX(b.x, tier), y: Math.min(b.y, JAR.h - RADIUS[tier]), age: Math.min(b.age, 40) }
  return { ...g, powers, balls: g.balls.map(o => o === b ? grown : o), score: g.score + points(tier), best: Math.max(g.best, tier), pops: [...g.pops, { x: b.x, y: b.y, tier, at: g.frame }] }
}
/** Swap: KONO's fruit and the next one change places. */
export function swapNext(g: Garden): Garden {
  if (g.over || g.powers.swap < 1 || g.next === g.after) return g
  return { ...g, next: g.after, after: g.next, powers: spend(g, 'swap') }
}
