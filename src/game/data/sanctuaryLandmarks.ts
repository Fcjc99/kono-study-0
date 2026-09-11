import type { SanctuaryLandmark } from '../types/SanctuaryLandmark'

/*
 * Coordinates are normalized from 0 to 1 relative to the visible island.
 *
 * If one click area needs adjustment later:
 * x = horizontal center, y = vertical center
 * width/height = click-area size
 */
export const SANCTUARY_LANDMARKS: SanctuaryLandmark[] = [
  {
    id: 'house',
    title: 'Home',
    level: 'Stage 0',
    description:
      'The cottage grows into a furnished sanctuary home as assignments are completed.',
    requirement: 'Complete 5 assignments for the first cottage upgrade.',
    reward: 'A front porch and a growing home',
    progress: 0,
    progressGoal: 1,
    x: 0.23,
    y: 0.43,
    width: 0.18,
    height: 0.24,
  },
  {
    id: 'garden',
    title: 'Sanctuary Garden',
    level: 'Level 0',
    description:
      'Quiet planting zones that gradually connect the cottage, tree, pond, bridge, and terrace.',
    requirement: 'Complete 4 assignments to establish the first permanent blooms.',
    reward: 'The first pathside flower clusters',
    progress: 0,
    progressGoal: 4,
    x: 0.30,
    y: 0.67,
    width: 0.22,
    height: 0.16,
  },
  {
    id: 'cherry',
    title: 'Cherry Blossom',
    level: 'Level 0',
    description:
      'The cherry tree grows on the upper plateau above the central stairs.',
    requirement: 'Complete 3 assignments to help it grow.',
    reward: 'The first cherry blossom sprout',
    progress: 0,
    progressGoal: 3,
    x: 0.486,
    y: 0.250,
    width: 0.25,
    height: 0.27,
  },
  {
    id: 'pond',
    title: 'Koi Pond',
    level: 'Level 0',
    description:
      'The water is calm and clear. Someday, koi may call this pond home.',
    requirement: 'Complete 3 science assignments.',
    reward: 'Your first koi fish',
    progress: 0,
    progressGoal: 3,
    x: 0.56,
    y: 0.635,
    width: 0.24,
    height: 0.18,
  },
  {
    id: 'bridge',
    title: 'Garden Bridge',
    level: 'Level 1',
    description:
      'A small bridge connecting the quiet corners of the sanctuary.',
    requirement: 'Complete every planned task for one full week.',
    reward: 'Flowers and lanterns along the bridge',
    progress: 0,
    progressGoal: 7,
    x: 0.50,
    y: 0.76,
    width: 0.19,
    height: 0.13,
  },
  {
    id: 'mailbox',
    title: 'Mailbox',
    level: 'Level 1',
    description:
      'Daily notes, reminders, and tomorrow’s work will eventually appear here.',
    requirement: 'Finish all of today’s assignments.',
    reward: 'A letter from Mochi',
    progress: 0,
    progressGoal: 1,
    x: 0.30,
    y: 0.46,
    width: 0.10,
    height: 0.13,
  },
  {
    id: 'lanterns',
    title: 'Lantern Terrace',
    level: 'Level 0',
    description:
      'A quiet deck that permanently gains trim, lanterns, tea seating, plants, and a cozy KONO hangout as productive days are completed.',
    requirement: 'Complete work on 1 productive day to awaken the first light.',
    reward: 'The first permanent terrace upgrade',
    progress: 0,
    progressGoal: 1,
    x: 0.76,
    y: 0.425,
    width: 0.22,
    height: 0.20,
  },
]
