/** KONO's premium themes (Settings › Look & feel › Premium; premium.css draws them). Each is a whole look, not just
 * an accent: its own background, cards, sidebar, buttons and headings. Workspace sets data-premium to the id.
 * `dark` themes are dark whatever the dark-mode setting says. `swatch` is the picker tile's preview. */
export const PREMIUM_THEMES = [
  { id: 'obsidian', label: 'Obsidian', note: 'Black & gold', dark: true, swatch: 'linear-gradient(135deg,#1c1915 0 55%,#d4af37 55% 62%,#0c0b0a 62%)' },
  { id: 'aurora', label: 'Aurora', note: 'Frosted glass', dark: false, swatch: 'radial-gradient(circle at 20% 25%,#c9b8ff,transparent 55%),radial-gradient(circle at 80% 30%,#9fe3ea,transparent 55%),radial-gradient(circle at 50% 90%,#ffc9e4,transparent 60%),#f4f2fb' },
  { id: 'champagne', label: 'Champagne', note: 'Ivory & gold', dark: false, swatch: 'linear-gradient(135deg,#fbf6ee 0 50%,#e6cf9f 50% 70%,#a77b2f 70%)' },
  { id: 'verdant', label: 'Verdant', note: 'Linen & emerald', dark: false, swatch: 'linear-gradient(135deg,#123c2f 0 38%,#f2f0e8 38% 82%,#c8a96a 82%)' },
] as const
export const premiumThemeIds: string[] = PREMIUM_THEMES.map(t => t.id)
export const isPremiumTheme = (theme: string | undefined) => !!theme && premiumThemeIds.includes(theme)
export const premiumIsDark = (theme: string | undefined) => PREMIUM_THEMES.some(t => t.id === theme && t.dark)
