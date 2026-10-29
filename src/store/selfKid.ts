import type { AppData, Kid, Profile } from './model'

/** "You, also listed as a kid": a parent who added themselves under Kids ends up with two of them in
 * every "Who's it for?" (Me and their own name) and items reading "Jeffrey & Sylvie". This finds that kid
 * (same first name as the plan's person, no kid plan of their own) so it can be merged back into "Me". */
const firstName = (name: string) => name.trim().toLowerCase().split(/\s+/)[0] ?? ''
export function selfKid(data: Pick<AppData, 'kids' | 'profiles'>, profile: Pick<Profile, 'id' | 'name' | 'kidId'>): Kid | undefined {
  if (profile.kidId || !firstName(profile.name)) return undefined
  return data.kids.find(k => k.profileId === profile.id && firstName(k.name) === firstName(profile.name) && !data.profiles.some(p => p.kidId === k.id))
}

type Tagged = { kidId?: string; kidIds?: string[] }
/** One item without the kid: the others on it stay (the first of them becomes its kidId), and with no
 * one left it's the plan's own -- "Me". */
function untag<T extends Tagged>(item: T, kidId: string): T {
  const ids = item.kidIds ?? (item.kidId ? [item.kidId] : [])
  if (!ids.includes(kidId)) return item
  const rest = ids.filter(id => id !== kidId), next = { ...item }
  delete next.kidId; delete next.kidIds
  return rest.length > 1 ? { ...next, kidId: rest[0], kidIds: rest } : rest.length ? { ...next, kidId: rest[0] } : next
}

/** Merges that kid into "Me": everything tagged to them becomes the plan's own (or stays with whoever
 * else it was for), and the kid is removed. A day off just for them goes; their stars go with them. */
export function mergeSelfKid(data: AppData, kidId: string): AppData {
  const off = (data.daysOff ?? []).flatMap(d => !d.kidIds.includes(kidId) ? [d] : d.kidIds.length === 1 ? [] : [{ ...d, kidIds: d.kidIds.filter(id => id !== kidId) }])
  return {
    ...data,
    kids: data.kids.filter(k => k.id !== kidId),
    tasks: data.tasks.map(t => untag(t, kidId)),
    exams: data.exams.map(e => untag(e, kidId)),
    calendarEvents: data.calendarEvents.map(e => untag(e, kidId)),
    studySeasons: data.studySeasons.map(s => untag(s, kidId)),
    specialDays: (data.specialDays ?? []).map(s => untag(s, kidId)),
    familyTodos: (data.familyTodos ?? []).map(t => { if (t.forKidId !== kidId) return t; const next = { ...t }; delete next.forKidId; return next }),
    daysOff: off,
    starLog: (data.starLog ?? []).filter(e => e.kidId !== kidId),
  }
}
