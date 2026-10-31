/** Snack sort (components/SnackSort): KONO's pantry jars are all mixed up. Tap a jar to pick up the snacks
 * on top (every one of the same kind that's stacked together), then tap another jar to put them in: onto
 * the same snack, or into an empty jar, as many as fit. Each jar holds four. Sorted means every jar is
 * empty or full of one snack. A level is dealt at random and kept only if a quick search can solve it, so
 * every level can be won; Undo takes back a move, and one extra jar can be added if you get stuck. Pure,
 * so it can be tested. */
export const JAR = 4
export const SNACKS = ['🍓', '🫐', '🍋', '🥝', '🍊', '🍇', '🍪', '🍩', '🍑']
export type Jars = string[][]

/** How many snack kinds and jars a level has: 3 kinds and 2 spare jars to start, up to 9 kinds. */
export const levelShape = (level: number) => ({ kinds: Math.min(SNACKS.length, 3 + Math.floor((level - 1) / 2)), spare: level >= 9 ? 1 : 2 })

/** The run of the same snack on top of a jar. */
export function topRun(jar: string[]): number {
  if (!jar.length) return 0
  const top = jar[jar.length - 1]; let n = 0
  for (let i = jar.length - 1; i >= 0 && jar[i] === top; i--) n++
  return n
}
/** How many snacks would move from jar `a` to jar `b` (0 when they can't). */
export function canPour(jars: Jars, a: number, b: number): number {
  if (a === b) return 0
  const from = jars[a], to = jars[b]
  if (!from?.length || !to || to.length >= JAR) return 0
  if (to.length && to[to.length - 1] !== from[from.length - 1]) return 0
  return Math.min(topRun(from), JAR - to.length)
}
export function pour(jars: Jars, a: number, b: number): Jars {
  const n = canPour(jars, a, b)
  if (!n) return jars
  const out = jars.map(j => [...j]), moving = out[a].splice(out[a].length - n, n)
  out[b].push(...moving)
  return out
}
export const sorted = (jars: Jars) => jars.every(j => !j.length || (j.length === JAR && j.every(s => s === j[0])))
/** A jar that's finished: full of one snack. */
export const done = (jar: string[]) => jar.length === JAR && jar.every(s => s === jar[0])

const key = (jars: Jars) => jars.map(j => j.join('')).sort().join('|')
/** A depth-first search for a way to sort, giving up after `limit` positions (then it's dealt again). */
export function solvable(jars: Jars, limit = 40000): boolean {
  const seen = new Set<string>(); let budget = limit
  const go = (js: Jars): boolean => {
    if (sorted(js)) return true
    if (--budget <= 0) return false
    const k = key(js); if (seen.has(k)) return false; seen.add(k)
    for (let a = 0; a < js.length; a++) {
      if (done(js[a])) continue
      for (let b = 0; b < js.length; b++) {
        const n = canPour(js, a, b)
        // Moving a whole jar into an empty one changes nothing.
        if (!n || (!js[b].length && n === js[a].length)) continue
        if (go(pour(js, a, b))) return true
      }
    }
    return false
  }
  return go(jars)
}

/** Deals a level: each kind four times, shuffled into the jars, plus the spare empty ones. */
export function deal(level: number, random: () => number = Math.random): Jars {
  const { kinds, spare } = levelShape(level)
  for (let tries = 0; tries < 40; tries++) {
    const bag = SNACKS.slice(0, kinds).flatMap(s => Array(JAR).fill(s) as string[])
    for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1));[bag[i], bag[j]] = [bag[j], bag[i]] }
    const jars: Jars = Array.from({ length: kinds }, (_, i) => bag.slice(i * JAR, i * JAR + JAR))
    for (let i = 0; i < spare; i++) jars.push([])
    if (!sorted(jars) && solvable(jars)) return jars
  }
  // Very unlikely: a gentle level (two kinds swapped on top) that's always solvable.
  const jars: Jars = SNACKS.slice(0, kinds).map(s => Array(JAR).fill(s) as string[])
  if (kinds > 1) { const a = jars[0].pop()!, b = jars[1].pop()!; jars[0].push(b); jars[1].push(a) }
  for (let i = 0; i < spare; i++) jars.push([])
  return jars
}

/** Stars for a sorted level: three for few moves, by how many snacks there were. */
export function sortStars(moves: number, kinds: number, usedExtra: boolean): number {
  const par = kinds * 3
  return Math.max(1, (moves <= par ? 3 : moves <= par * 1.5 ? 2 : 1) - (usedExtra ? 1 : 0))
}

const LEVEL_KEY = 'kono-sort-level'
export function sortLevel(): number { try { const n = Number(localStorage.getItem(LEVEL_KEY)); return Number.isInteger(n) && n > 0 ? n : 1 } catch { return 1 } }
export function saveSortLevel(n: number) { try { localStorage.setItem(LEVEL_KEY, String(n)) } catch { /* storage unavailable */ } }
