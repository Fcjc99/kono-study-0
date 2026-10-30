import { uid, type AppData, type Grocery, type Meal, type Recipe } from './model'

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

/** The recipe box: a family's dinners with their ingredients; one tap puts what's needed on the list. */
export function addRecipe(data: AppData, profileId: string, title: string, ingredients: string, url = ''): AppData {
  const t = title.trim().slice(0, 200), list = ingredients.split(/\r?\n|,/).map(x => x.trim().slice(0, 200)).filter(Boolean).slice(0, 80)
  if (!t) return data
  return { ...data, recipes: [...(data.recipes ?? []), { id: uid('recipe'), profileId, title: t, ingredients: list, ...(/^https?:\/\//.test(url.trim()) ? { url: url.trim().slice(0, 2000) } : {}) }] }
}
export const removeRecipe = (data: AppData, id: string): AppData => ({ ...data, recipes: (data.recipes ?? []).filter(r => r.id !== id) })
export const recipeFor = (data: Pick<AppData, 'recipes'>, profileId: string, title: string) => (data.recipes ?? []).find(r => r.profileId === profileId && r.title.toLowerCase() === title.trim().toLowerCase())
export const shopFor = (data: AppData, profileId: string, recipe: Recipe): AppData => addGroceries(data, profileId, recipe.ingredients.join('\n'))
