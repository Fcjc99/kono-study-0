/** KONO Medal Cove (components/MedalCove): a medal pusher in the Japanese arcade style, KONO's own machine.
 *
 * The field is seen from above, 100 wide and 120 deep (y grows toward you). A pusher slides in and out at
 * the back; you drop medals from the back (aim left or right) and they land just in front of it. The
 * pusher shoves the pile forward: medals that fall off the front edge are yours, the sides lose them.
 *
 * The bonus chain:
 * - A lantern hole slides back and forth on the pusher's face. A medal dropped through it is a "check":
 *   it spins the lottery (three reels). Up to 4 spins wait their turn.
 * - The reels: three of a kind wins. 🪙 a shower of 12 medals onto the field; 🗼 a medal tower of 20 (a
 *   tall stack that tips over onto the field); 🔮 a prize ball onto the field; ⭐ a step; 🐚 a shower of 8.
 *   Two of a kind drops 2. Every spin also adds a medal to the jackpot.
 * - Lamps: the lighthouse has five. A ⭐ on the reels (or a medal in the star pocket) lights one; all five
 *   is the BIG BONUS: a medal shower, a prize ball and a medal tower.
 * - The pin board (when the physics engine runs the machine): medals go in at the top of a pin board and
 *   bounce down into one of three pockets: 🏮 spins the lottery, ⭐ lights a lamp, 🗼 builds a medal tower.
 *   A miss drops onto the pusher's shelf and joins the pile.
 * - A prize ball pushed off the front rolls into the ball dish: it circles and settles in a pocket:
 *   medals, a tower, or JACKPOT CHANCE.
 * - Jackpot Chance: a big wheel with 12 pockets. A win pays the jackpot (it starts at 100 and grows with
 *   every spin and every miss); a miss adds a winning pocket for next time (up to 4) and pays a few medals.
 *
 * Pure apart from the random numbers, so it can be tested. Time is in frames at 60 a second. */
export type Medal = { id: number; x: number; y: number; vx: number; vy: number; ball?: boolean; high?: boolean }
export type Reel = '🪙' | '🗼' | '🔮' | '⭐' | '🐚' | '🌺'
export type Spin = { reels: [Reel, Reel, Reel]; prize: SpinPrize; at: number }
export type SpinPrize = { kind: 'shower'; n: number } | { kind: 'tower'; n: number } | { kind: 'ball' } | { kind: 'step' } | { kind: 'none' }
export type DishPocket = { label: string; prize: { kind: 'medals'; n: number } | { kind: 'tower'; n: number } | { kind: 'chance' } }
export type Cove = {
  medals: Medal[]; nextId: number; frame: number
  pusher: number; checker: number
  hand: number; won: number; lost: number; dropped: number
  queue: number; spinning: Spin | null; spinsDone: number; steps: number
  dish: { pocket: number; at: number } | null; dishQueue: number
  chance: { pocket: number; at: number } | null; chanceQueue: number
  jackpot: number; jpWins: number; winPockets: number
  towers: { x: number; n: number; at: number }[]; events: { text: string; at: number }[]
  /** The pile is moved by a real physics engine (components/MedalCove): `medals` then only holds medals and
   * balls waiting to be put into the machine, towers stand until it builds them, and it reports what
   * falls off (settle). */
  external?: boolean
  /** The pin board's three mini wheels: one spinning per pocket, and spins waiting (up to 3 each). */
  wheels?: ({ seg: number; at: number } | null)[]; wheelQueue?: number[]
  /** The giant tower: medals banked by tower layers, released onto the field by the BIG BONUS. */
  bank?: number
  /** Medals still to rain into the machine from a prize (with the pin board the prizes are real medals). */
  rain?: number
  /** FEVER TIME: all three pockets hit within FEVER_WINDOW frames; until `until`, pockets spin their wheel
   * twice (and the cabinet throws a party). `hits` is when each pocket was last hit. */
  fever?: { until: number } | null; hits?: number[]
  /** Pockets one after another, each within COMBO_GAP frames of the last: COMBO ×n pays n medals. */
  combo?: { n: number; at: number }
}

export const FIELD = { w: 100, h: 120, r: 3.1, ball: 4.4, back: 14, reach: 30, checkerW: 9 }
export const REELS: Reel[] = ['🪙', '🪙', '🪙', '🗼', '🔮', '⭐', '⭐', '🐚', '🌺', '🐚', '🌺']
export const DISH: DishPocket[] = [
  { label: '+10', prize: { kind: 'medals', n: 10 } }, { label: 'JP CHANCE', prize: { kind: 'chance' } }, { label: '+20', prize: { kind: 'medals', n: 20 } },
  { label: 'Tower 30', prize: { kind: 'tower', n: 30 } }, { label: '+10', prize: { kind: 'medals', n: 10 } }, { label: '+50', prize: { kind: 'medals', n: 50 } },
  { label: '+20', prize: { kind: 'medals', n: 20 } }, { label: 'JP CHANCE', prize: { kind: 'chance' } },
]
export const CHANCE_POCKETS = 12, JP_START = 100
/** The pusher's front edge at a frame: it eases in and out between the back wall and its reach. */
export const pusherAt = (frame: number) => FIELD.back + (FIELD.reach - FIELD.back) * (0.5 - 0.5 * Math.cos(frame / 70))
/** The lantern hole's center on the pusher's face at a frame (it slides across, a little faster). */
export const checkerAt = (frame: number) => 50 + 34 * Math.sin(frame / 47)

/** A fresh machine: a big pile already on the field (the medals that make it a pusher), and a hand of medals. */
export function newCove(random: () => number = Math.random, hand = 100, external = false): Cove {
  const medals: Medal[] = []
  let id = 1
  // Rows of medals from the pusher's reach to near the front edge, packed with a little jitter.
  for (let y = FIELD.reach + 4; y < FIELD.h - 1.5; y += FIELD.r * 1.7) for (let x = 6; x < FIELD.w - 6; x += FIELD.r * 2.05) medals.push({ id: id++, x: x + (random() - 0.5) * 1.2, y: y + (random() - 0.5) * 1.2, vx: 0, vy: 0 })
  if (external) medals.length = 0
  return { ...(external ? { external } : {}), medals, nextId: id, frame: 0, pusher: pusherAt(0), checker: checkerAt(0), hand, won: 0, lost: 0, dropped: 0, queue: 0, spinning: null, spinsDone: 0, steps: 0, dish: null, dishQueue: 0, chance: null, chanceQueue: 0, jackpot: JP_START, jpWins: 0, winPockets: 1, towers: [], events: [], wheels: [null, null, null], wheelQueue: [0, 0, 0], bank: BANK_START }
}

const say = (c: Cove, text: string): Cove => ({ ...c, events: [...c.events.slice(-4), { text, at: c.frame }] })
const add = (c: Cove, list: Omit<Medal, 'id'>[]): Cove => ({ ...c, medals: [...c.medals, ...list.map((m, i) => ({ ...m, id: c.nextId + i }))], nextId: c.nextId + list.length })
/** Medals raining onto the middle of the field. */
function shower(c: Cove, n: number, random: () => number): Cove {
  return add(c, Array.from({ length: n }, () => ({ x: 14 + random() * 72, y: c.pusher + 4 + random() * 22, vx: (random() - 0.5) * 0.3, vy: 0.2 + random() * 0.3 })))
}
/** Pays `n` medals: straight into the tray (and your hand), or, with the pin board, as real medals that rain
 * down onto the field from above, a few a frame (`rain`). */
function pay(c: Cove, n: number): Cove { return c.external ? { ...c, rain: (c.rain ?? 0) + n } : { ...c, won: c.won + n } }
function ballOnField(c: Cove, random: () => number): Cove { return add(c, [{ x: 30 + random() * 40, y: c.pusher + FIELD.ball + 1, vx: 0, vy: 0.3, ball: true }]) }

/** Drops a medal from your hand at `aim` (0–100). Through the lantern hole it's a check (a spin, up to 4
 * waiting); otherwise it lands in front of the pusher. */
export function drop(c: Cove, aim: number, random: () => number = Math.random): Cove {
  if (c.hand <= 0) return c
  // With the pin board, a medal goes in at the top (y -1 marks it) and the board decides where it lands.
  if (c.external) return add({ ...c, hand: c.hand - 1, dropped: c.dropped + 1 }, [{ x: Math.max(4, Math.min(96, aim)), y: -1, vx: 0, vy: 0 }])
  const x = Math.max(FIELD.r + 1, Math.min(FIELD.w - FIELD.r - 1, aim))
  const next: Cove = { ...c, hand: c.hand - 1, dropped: c.dropped + 1 }
  if (Math.abs(x - c.checker) <= FIELD.checkerW / 2) {
    // With four spins already waiting, the medal just joins the pile.
    if (c.queue + (c.spinning ? 1 : 0) >= 4) return add(next, [{ x, y: c.pusher + FIELD.r + 0.5, vx: 0, vy: 0.4 }])
    return { ...next, queue: next.queue + 1 }
  }
  return add(next, [{ x, y: c.pusher + FIELD.r + 0.5, vx: (random() - 0.5) * 0.2, vy: 0.5 }])
}

/** What three reels pay. */
export function spinPrize(reels: Reel[]): SpinPrize {
  const [a, b, c] = reels
  if (a === b && b === c) return a === '🪙' ? { kind: 'shower', n: 20 } : a === '🗼' ? { kind: 'tower', n: 20 } : a === '🔮' ? { kind: 'ball' } : a === '⭐' ? { kind: 'step' } : { kind: 'shower', n: 12 }
  if (a === b || b === c || a === c) return { kind: 'shower', n: 4 }
  return { kind: 'none' }
}
/** A spin's outcome, from a payout table (as real machines tune theirs), then reels drawn to show it. */
export const ODDS: [SpinPrize['kind'] | 'pair', Reel | null, number][] = [['shower', '🪙', 0.06], ['tower', '🗼', 0.04], ['ball', '🔮', 0.05], ['step', '⭐', 0.13], ['shower', '🐚', 0.05], ['pair', null, 0.22]]
export function spinReels(random: () => number): [Reel, Reel, Reel] {
  let r = random()
  for (const [kind, face, p] of ODDS) {
    if (r < p) {
      if (face) return [face, face, face]
      const pick = REELS[Math.floor(random() * REELS.length)]
      let other = REELS[Math.floor(random() * REELS.length)]; while (other === pick) other = REELS[Math.floor(random() * REELS.length)]
      return (kind === 'pair' ? [[pick, pick, other], [pick, other, pick], [other, pick, pick]][Math.floor(random() * 3)] : [pick, pick, pick]) as [Reel, Reel, Reel]
    }
    r -= p
  }
  // A miss: three different faces.
  const faces = [...new Set(REELS)]; const out: Reel[] = []
  while (out.length < 3) { const f = faces[Math.floor(random() * faces.length)]; if (!out.includes(f)) out.push(f) }
  return out as [Reel, Reel, Reel]
}
export const LAMPS = 5, BANK_START = 20, LAYER = 5
/** All five lamps lit: the BIG BONUS. The giant tower comes down onto the field with every medal banked
 * in it, with a prize ball; the tower starts again at its base. */
function lampCheck(c: Cove, random: () => number): Cove {
  if (c.steps < LAMPS) return c
  const bank = c.bank ?? BANK_START
  return say(ballOnField({ ...c, steps: 0, bank: BANK_START, towers: [...c.towers, { x: 50, n: bank, at: c.frame }] }, random), '💡 BIG BONUS! The giant tower comes down: ' + bank + ' medals!')
}
/** A mini wheel's segment: medals onto the field, layers for the giant tower, a prize ball, a lamp, or a
 * lottery spin. */
export type WheelSeg = { label: string; kind: 'medals' | 'layers' | 'ball' | 'lamp' | 'spin'; n: number }
const seg = (label: string, kind: WheelSeg['kind'], n = 0): WheelSeg => ({ label, kind, n })
/** The three wheels, one over each pocket, each with its own mix: the 🏮 wheel leans to medals and spins,
 * the ⭐ wheel to lamps, the 🗼 wheel to tower layers. Eight segments each. */
export const WHEELS: WheelSeg[][] = [
  [seg('+10', 'medals', 10), seg('+2 layers', 'layers', 2), seg('SPIN', 'spin'), seg('+20', 'medals', 20), seg('+1 layer', 'layers', 1), seg('+6', 'medals', 6), seg('BALL', 'ball'), seg('SPIN', 'spin')],
  [seg('LAMP', 'lamp'), seg('+20', 'medals', 20), seg('+1 layer', 'layers', 1), seg('+2 layers', 'layers', 2), seg('BALL', 'ball'), seg('+6', 'medals', 6), seg('LAMP', 'lamp'), seg('SPIN', 'spin')],
  [seg('+2 layers', 'layers', 2), seg('+10', 'medals', 10), seg('+4 layers', 'layers', 4), seg('BALL', 'ball'), seg('+1 layer', 'layers', 1), seg('LAMP', 'lamp'), seg('+3 layers', 'layers', 3), seg('+6', 'medals', 6)],
]
export const WHEEL_FRAMES = 100
export type Pocket = 'spin' | 'lamp' | 'tower'
/** The pin board's three pockets (left, the moving middle one, right), each with its mini wheel. */
export const POCKETS: Pocket[] = ['spin', 'lamp', 'tower']
/** A medal in one of the pin board's pockets: that pocket's mini wheel spins (up to 3 spins wait their
 * turn). Every pocket also adds a medal to the jackpot. */
/** Tuned for about a FEVER a minute of steady play: all three pockets within 3 seconds, and a rest of 45
 * seconds after one ends. A combo needs pockets within a second of each other, and pays from ×3. */
export const FEVER_WINDOW = 180, FEVER_FRAMES = 1200, FEVER_REST = 2700, COMBO_GAP = 60
export const inFever = (c: Cove) => !!c.fever && c.frame < c.fever.until
export function pocket(c: Cove, kind: Pocket, random: () => number = Math.random): Cove {
  const i = POCKETS.indexOf(kind), q = [...(c.wheelQueue ?? [0, 0, 0])], fever = inFever(c)
  q[i] = Math.min(3, q[i] + (fever ? 2 : 1))
  const hits = [...(c.hits ?? [-1e9, -1e9, -1e9])]; hits[i] = c.frame
  let next: Cove = { ...c, jackpot: c.jackpot + 1, wheelQueue: q, hits }
  // A combo: pockets in quick succession.
  const n = c.combo && c.frame - c.combo.at <= COMBO_GAP ? c.combo.n + 1 : 1
  next = { ...next, combo: { n, at: c.frame } }
  if (n >= 3) next = say(shower(next, n, random), '🔥 COMBO ×' + n + '! +' + n)
  // All three pockets within the window: FEVER TIME.
  if (!fever && (!c.fever || c.frame >= c.fever.until + FEVER_REST) && hits.every(h => c.frame - h <= FEVER_WINDOW)) next = say({ ...next, fever: { until: c.frame + FEVER_FRAMES }, hits: [-1e9, -1e9, -1e9] }, '🌈 FEVER TIME! Every pocket spins twice!')
  return next
}
/** What a mini wheel's segment gives. */
function wheelPrize(c: Cove, s: WheelSeg, random: () => number): Cove {
  if (s.kind === 'medals') return say(shower(c, s.n, random), '🎡 +' + s.n + ' medals')
  if (s.kind === 'layers') return say({ ...c, bank: (c.bank ?? BANK_START) + s.n * LAYER }, '🗼 The giant tower grows +' + s.n + (s.n === 1 ? ' layer' : ' layers') + ' (' + ((c.bank ?? BANK_START) + s.n * LAYER) + ')')
  if (s.kind === 'ball') return say(ballOnField(c, random), '🔮 A prize ball!')
  if (s.kind === 'spin') return c.queue + (c.spinning ? 1 : 0) >= 4 ? c : say({ ...c, queue: c.queue + 1 }, '🎰 A lottery spin!')
  return lampCheck(say({ ...c, steps: c.steps + 1 }, '💡 A lamp lights up (' + (c.steps + 1) + '/' + LAMPS + ')'), random)
}
const SPIN_FRAMES = 110, DISH_FRAMES = 200, CHANCE_FRAMES = 230
/** Is pocket `i` of the Jackpot Chance wheel a winning one (the first `winPockets`, spread round the wheel)? */
export const isWinPocket = (i: number, winPockets: number) => Array.from({ length: winPockets }, (_, k) => Math.round(k * CHANCE_POCKETS / winPockets)).includes(i)

/** One frame of the machine: the pusher, the pile, medals off the edges, and the bonus chain. */
export function step(c0: Cove, random: () => number = Math.random, n = 1): Cove {
  let c: Cove = { ...c0, frame: c0.frame + n }
  const pusher = pusherAt(c.frame), checker = checkerAt(c.frame)
  c = { ...c, pusher, checker }
  // Bonuses: one spin, ball lottery and jackpot chance at a time.
  if (!c.spinning && c.queue > 0) {
    const reels = spinReels(random)
    c = { ...c, queue: c.queue - 1, spinning: { reels, prize: spinPrize(reels), at: c.frame }, jackpot: c.jackpot + 1 }
  }
  if (c.spinning && c.frame - c.spinning.at >= SPIN_FRAMES) {
    const p = c.spinning.prize
    c = { ...c, spinning: null, spinsDone: c.spinsDone + 1 }
    if (p.kind === 'shower') c = say(shower(c, p.n, random), p.n >= 10 ? '🪙 Medal shower! +' + p.n : '+' + p.n + ' medals')
    else if (p.kind === 'tower') c = say({ ...c, towers: [...c.towers, { x: 25 + random() * 50, n: p.n, at: c.frame }] }, '🗼 Medal tower!')
    else if (p.kind === 'ball') c = say(ballOnField(c, random), '🔮 Prize ball!')
    else if (p.kind === 'step') c = { ...c, steps: c.steps + 1 }
    c = lampCheck(c, random)
  }
  // A tower tips over after a moment: its medals spill onto the field around where it stood.
  if (!c.external) for (const t of c.towers.filter(t => c.frame - t.at >= 90)) c = add(c, Array.from({ length: t.n }, (_, i) => ({ x: Math.max(5, Math.min(95, t.x + (random() - 0.5) * 18)), y: pusher + 6 + (i / t.n) * 26 + random() * 4, vx: (random() - 0.5) * 0.6, vy: 0.4 + random() * 0.5 })))
  c = { ...c, towers: c.towers.filter(t => c.frame - t.at < 90) }
  // The mini wheels: each starts its next spin when it's free, and pays when it stops.
  if (c.wheels && c.wheelQueue) {
    const wheels = [...c.wheels], q = [...c.wheelQueue]
    for (let i = 0; i < 3; i++) {
      const w = wheels[i]
      if (w && c.frame - w.at >= WHEEL_FRAMES) { wheels[i] = null; c = wheelPrize({ ...c, wheels, wheelQueue: q }, WHEELS[i][w.seg], random) }
      if (!wheels[i] && q[i] > 0) { q[i]--; wheels[i] = { seg: Math.floor(random() * WHEELS[i].length), at: c.frame } }
    }
    c = { ...c, wheels, wheelQueue: q }
  }
  if (!c.dish && c.dishQueue > 0) c = { ...c, dishQueue: c.dishQueue - 1, dish: { pocket: Math.floor(random() * DISH.length), at: c.frame } }
  if (c.dish && c.frame - c.dish.at >= DISH_FRAMES) {
    const p = DISH[c.dish.pocket].prize
    c = { ...c, dish: null }
    if (p.kind === 'medals') c = say(pay(c, p.n), '🔮 Ball lottery: +' + p.n + ' medals')
    else if (p.kind === 'tower') c = say({ ...c, towers: [...c.towers, { x: 50, n: p.n, at: c.frame }] }, '🔮 Ball lottery: a medal tower!')
    else c = say({ ...c, chanceQueue: c.chanceQueue + 1 }, '🔮 JACKPOT CHANCE!')
  }
  if (!c.chance && c.chanceQueue > 0) c = { ...c, chanceQueue: c.chanceQueue - 1, chance: { pocket: Math.floor(random() * CHANCE_POCKETS), at: c.frame } }
  if (c.chance && c.frame - c.chance.at >= CHANCE_FRAMES) {
    const hit = isWinPocket(c.chance.pocket, c.winPockets)
    if (hit) c = say({ ...pay(c, c.jackpot), chance: null, jpWins: c.jpWins + 1, jackpot: JP_START, winPockets: 1 }, '🎉 JACKPOT! +' + c.jackpot)
    else c = say({ ...pay(c, 10), chance: null, jackpot: c.jackpot + 20, winPockets: Math.min(4, c.winPockets + 1) }, 'So close! +10, and a winning pocket is added')
  }
  // A prize's medals rain from high above the field, two a frame, spread across it.
  if (c.external && c.rain) {
    const k = Math.min(c.rain, 2)
    c = { ...add(c, Array.from({ length: k }, () => ({ x: 10 + random() * 80, y: c.pusher + 4 + random() * 26, vx: 0, vy: 0, high: true }))), rain: c.rain - k }
  }
  if (c.external) return c
  // The pile: the pusher shoves what's in front of it; medals push each other apart and slow down.
  const ms = c.medals.map(m => ({ ...m }))
  for (const m of ms) {
    const r = m.ball ? FIELD.ball : FIELD.r
    m.x += m.vx * n; m.y += m.vy * n; m.vx *= 0.86; m.vy *= 0.86
    if (m.y - r < pusher) { m.vy = Math.max(m.vy, 0.35); m.y = pusher + r }
  }
  for (let pass = 0; pass < 4; pass++) {
    // A coarse grid keeps the pairs to check to neighbors.
    const cell = 8, grid = new Map<number, number[]>()
    ms.forEach((m, i) => { const k = Math.floor(m.x / cell) * 1000 + Math.floor(m.y / cell); const list = grid.get(k); if (list) list.push(i); else grid.set(k, [i]) })
    for (let i = 0; i < ms.length; i++) {
      const a = ms[i], ra = a.ball ? FIELD.ball : FIELD.r, gx = Math.floor(a.x / cell), gy = Math.floor(a.y / cell)
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const j of grid.get((gx + dx) * 1000 + gy + dy) ?? []) {
        if (j <= i) continue
        const b = ms[j], rb = b.ball ? FIELD.ball : FIELD.r, ddx = b.x - a.x, ddy = b.y - a.y, d = Math.hypot(ddx, ddy) || 0.001, min = (ra + rb) * 0.92
        if (d >= min) continue
        const nx = ddx / d, ny = ddy / d, push = (min - d) / 2
        // Something against the pusher can't move back, so the other one takes all of the push.
        const aStuck = a.y - ra <= pusher + 0.01 && ny > 0, bStuck = b.y - rb <= pusher + 0.01 && ny < 0
        const ka = aStuck ? 0 : bStuck ? 2 : 1, kb = bStuck ? 0 : aStuck ? 2 : 1
        a.x -= nx * push * ka; a.y -= ny * push * ka; b.x += nx * push * kb; b.y += ny * push * kb
        a.vx -= nx * 0.02 * ka; a.vy -= ny * 0.02 * ka; b.vx += nx * 0.02 * kb; b.vy += ny * 0.02 * kb
      }
    }
    // The cabinet's side walls keep the pile in; the pusher can't be pushed back.
    for (const m of ms) { const r = m.ball ? FIELD.ball : FIELD.r; if (m.y - r < pusher) m.y = pusher + r; if (m.x < r) { m.x = r; m.vx = Math.abs(m.vx) * 0.3 } if (m.x > FIELD.w - r) { m.x = FIELD.w - r; m.vx = -Math.abs(m.vx) * 0.3 } }
  }
  // Off the front: yours (a ball goes to the ball lottery). Through the two side drops near the front: lost.
  let won = c.won, lost = c.lost, dishQueue = c.dishQueue
  const kept: Medal[] = []
  for (const m of ms) {
    if (m.y > FIELD.h) { if (m.ball) dishQueue++; else won++ }
    else if ((m.x <= FIELD.r + 0.05 || m.x >= FIELD.w - FIELD.r - 0.05) && m.y > FIELD.h - 16) { if (m.ball) dishQueue++; else lost++ }
    else kept.push(m)
  }
  // What's won goes straight back into your hand, as a medal tray would.
  return { ...c, medals: kept, won, lost, dishQueue, hand: c.hand + (won - c0.won) }
}

/** Busy: a spin, a ball lottery, a chance, a tower or anything still waiting. */
export const busy = (c: Cove) => !!(c.rain || c.spinning || c.queue || c.dish || c.dishQueue || c.chance || c.chanceQueue || c.towers.length || c.wheels?.some(Boolean) || c.wheelQueue?.some(n => n > 0))

/** With a physics engine moving the pile: what fell off since last time. Medals off the front are yours
 * (back into your hand), off the sides are lost, and a prize ball off the front goes to the ball lottery. */
export function settle(c: Cove, won: number, lost: number, balls: number): Cove {
  if (!won && !lost && !balls) return c
  return { ...c, won: c.won + won, hand: c.hand + won, lost: c.lost + lost, dishQueue: c.dishQueue + balls }
}
/** Takes the medals and balls waiting to go into the machine (the physics engine puts them in). */
export const spawned = (c: Cove): Cove => c.medals.length ? { ...c, medals: [] } : c
