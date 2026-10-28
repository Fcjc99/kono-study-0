/** The animated KONO (components/KonoRive.tsx): a Rive file made in the Rive editor (rive.app), played in
 * KONO's corner in place of the pose pictures. Off until the file exists: set KONO_RIVE to it, e.g.
 * { src: '/garden/kono/kono.riv', stateMachine: 'KONO' }, and put the file in public/garden/kono/.
 * The Rive player (about 420 KB) only downloads on devices that show it.
 *
 * What the file needs (docs/kono-rive-brief.md has the whole brief for whoever animates it):
 * an artboard with a state machine named `stateMachine` with these inputs —
 *   mood    number   0 calm (tea), 1 happy, 2 celebrate, 3 worried, 4 busy (reading), 5 sleepy
 *   asleep  boolean  tucked in for the night (eyes shut, slow breathing, z's)
 *   lookX   number   −100…100, where the finger or pointer is, left to right (KONO's eyes and head follow)
 *   lookY   number   −100…100, top to bottom
 *   pet     trigger  a pat (squish and smile)
 *   wave    trigger  hello
 *   cheer   trigger  something got finished (a happy hop)
 *   eat     trigger  a snack
 * Missing inputs are skipped, so a first version can start with mood and pet. */
export const KONO_RIVE: { src: string; stateMachine: string } | null = null

export const RIVE_MOODS = ['calm', 'happy', 'celebrate', 'worried', 'busy', 'sleepy'] as const
/** KONO's reactions (Workspace's careMoment.react) → the trigger that plays them. */
export const RIVE_TRIGGER: Record<string, 'pet' | 'wave' | 'cheer' | 'eat'> = { wave: 'wave', heart: 'pet', tickle: 'pet', highfive: 'cheer', pet: 'pet', eat: 'eat', cheer: 'cheer' }
