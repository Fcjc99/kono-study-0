import { uid, type AppData, type Grocery, type Meal } from './model'

/** Dinners & groceries (Home): what's for dinner each day this week, and one shared grocery list. */
export const dinnerOn = (data: Pick<AppData, 'meals'>, profileId: string, date: string) => (data.meals ?? []).find(m => m.profileId === profileId && m.date === date && m.meal === 'dinner')

/** Sets (or, with an empty title, clears) a day's dinner. Meals more than two months old are let go. */
export function setDinner(data: AppData, profileId: string, date: string, title: string, today: string): AppData {
  const cutoff = new Date(today + 'T12:00:00'); cutoff.setDate(cutoff.getDate() - 60)
  const keep = (m: Meal) => !(m.profileId === profileId && m.date === date && m.meal === 'dinner') && m.date >= cutoff.toISOString().slice(0, 10)
  const text = title.trim().slice(0, 200)
  return { ...data, meals: [...(data.meals ?? []).filter(keep), ...(text ? [{ id: uid('meal'), profileId, date, title: text, meal: 'dinner' as const }] : [])] }
}

/** Adds groceries; one per line or comma, skipping ones already on the list (not yet bought). */
export function addGroceries(data: AppData, profileId: string, text: string): AppData {
  const list = data.groceries ?? [], open = new Set(list.filter(g => g.profileId === profileId && !g.done).map(g => g.title.toLowerCase()))
  const added: Grocery[] = []
  for (const raw of text.split(/[\n,]/)) {
    const title = raw.trim().slice(0, 200)
    if (!title || open.has(title.toLowerCase())) continue
    open.add(title.toLowerCase()); added.push({ id: uid('grocery'), profileId, title, done: false })
  }
  return added.length ? { ...data, groceries: [...list, ...added] } : data
}
export const toggleGrocery = (data: AppData, id: string): AppData => ({ ...data, groceries: (data.groceries ?? []).map(g => g.id === id ? { ...g, done: !g.done } : g) })
export const clearBought = (data: AppData, profileId: string): AppData => ({ ...data, groceries: (data.groceries ?? []).filter(g => g.profileId !== profileId || !g.done) })
