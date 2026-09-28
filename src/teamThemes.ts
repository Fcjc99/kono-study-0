/** Team colors (Settings › Team colors). Each works in Cozy and Simplified. A "dark" jersey paints the
 * sidebar and phone header in the team's main color; a "light" one keeps them white with team-colored
 * trim. The colors themselves live in team-themes.css. */
export const TEAM_THEMES = [
  { id: 'dragons', label: 'Duxbury · Green & White', jersey: 'dark', note: 'Bright school green on white' },
  { id: 'dragonsblack', label: 'Duxbury · Black & Green', jersey: 'dark', note: 'Black with school-green trim' },
  { id: 'hanover', label: 'Hanover High · Navy & Gold', jersey: 'dark', note: 'Navy with gold trim' },
  { id: 'nda', label: 'Notre Dame Academy · Navy & Gold', jersey: 'light', note: 'White with navy and gold trim' },
  { id: 'bc', label: 'Boston College · Maroon & Gold', jersey: 'dark', note: 'Maroon with gold trim' },
  { id: 'mcgill', label: 'McGill · Red & White', jersey: 'dark', note: 'McGill red with white trim' },
  { id: 'gamehome', label: 'Game Day Green · Home', jersey: 'dark', note: 'Deep green with white trim' },
  { id: 'gameaway', label: 'Game Day Green · Away', jersey: 'light', note: 'White with deep green and black trim' },
] as const
export type TeamThemeId = typeof TEAM_THEMES[number]['id']
export const teamThemeIds: string[] = TEAM_THEMES.map(t => t.id)
export const teamJersey = (theme: string) => TEAM_THEMES.find(t => t.id === theme)?.jersey
