import { uid, type AppData, type FamilyTodo, type StarEntry, type StarReward } from './model'

/** The star chart (Kids › Star chart): a kid's chores (family to-dos for them) earn stars when ticked,
 * 1 unless the chore says otherwise, and the stars buy rewards the parent puts on the shelf ("Movie
 * night", 10 stars). Everything is a line in the plan's star log, so a balance is just a sum, and
 * unticking a chore takes its stars back. Repeating chores earn on every turn. */
export const DEFAULT_STARS = 1

export const starsOf = (t: Pick<FamilyTodo, 'stars'>) => t.stars ?? DEFAULT_STARS
export const balance = (log: StarEntry[], kidId: string) => log.filter(e => e.kidId === kidId).reduce((n, e) => n + e.n, 0)
export const earnedSince = (log: StarEntry[], kidId: string, since: string) => log.filter(e => e.kidId === kidId && e.n > 0 && e.at >= since).reduce((n, e) => n + e.n, 0)

/** The star log after ticking a to-do: a kid's chore earns its stars on each turn; unticking a one-off
 * chore takes back what it earned. `before` is the to-do as it was, `after` as tickTodo left it. */
export function starsAfterTick(log: StarEntry[], before: FamilyTodo, after: FamilyTodo, now = new Date()): StarEntry[] {
  if (!before.forKidId) return log
  const n = starsOf(before)
  const unticked = before.done && !after.done
  if (unticked) {
    const last = [...log].reverse().find(e => e.todoId === before.id && e.n > 0)
    return last ? log.filter(e => e !== last) : log
  }
  if (n <= 0) return log
  return [...log, { id: uid('star'), profileId: before.profileId, kidId: before.forKidId, at: now.toISOString(), n, note: before.title, todoId: before.id }]
}

/** Spending stars on a reward: refused (null) if the kid hasn't enough. */
export function redeem(log: StarEntry[], kidId: string, reward: StarReward, now = new Date()): StarEntry[] | null {
  if (balance(log, kidId) < reward.cost) return null
  return [...log, { id: uid('star'), profileId: reward.profileId, kidId, at: now.toISOString(), n: -reward.cost, note: (reward.emoji ? reward.emoji + ' ' : '') + reward.title }]
}

/** A few rewards to start a shelf with, for a parent who hasn't made any. */
export const STARTER_REWARDS: Omit<StarReward, 'id' | 'profileId'>[] = [
  { title: 'Pick dessert', cost: 5, emoji: '🍦' },
  { title: 'Movie night pick', cost: 10, emoji: '🎬' },
  { title: '30 min extra screen time', cost: 8, emoji: '🎮' },
  { title: 'Stay up 30 min later', cost: 12, emoji: '🌙' },
]

/** A kid's chores this week and what's on the shelf, for the chart. */
export function chartFor(data: AppData, profileId: string, kidId: string, weekStart: string) {
  const log = data.starLog ?? []
  return {
    stars: balance(log, kidId),
    week: earnedSince(log, kidId, weekStart),
    recent: log.filter(e => e.kidId === kidId).slice(-6).reverse(),
    chores: (data.familyTodos ?? []).filter(t => t.profileId === profileId && t.forKidId === kidId && !t.done),
    rewards: (data.starRewards ?? []).filter(r => r.profileId === profileId).sort((a, b) => a.cost - b.cost),
  }
}
