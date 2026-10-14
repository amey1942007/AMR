/**
 * Figure text from pages-spec §11.7 (UI/UX-written). Every Figure looks itself up here by id; a missing or empty
 * caption/explainer throws during static render AND fails `scripts/check-figures.mjs` (prebuild), so the build fails.
 */
export interface FigureText { caption: string; explainer: string; status: 'verified' | 'notes' | 'pending'; source: string }
export const figures = {
  'robots-1': { caption: 'Two robots at a glance', explainer: 'One robot is already tested in real rooms; the other is our next design. Each column describes only its own robot, so you can compare them without mixing details.', status: 'notes', source: 'brief:§0' },
  'robots-2': { caption: 'Footprint, drawn to scale', explainer: "AMR4's base is 0.52 × 0.63 m and Hardware Bot's is 0.45 × 0.25 m, so AMR4 is slightly wider and about two and a half times as long. AMR4's base carries four mecanum wheels; Hardware Bot runs on two hub motors and casters.", status: 'notes', source: 'brief:§0' },
  'hw-1': { caption: 'Hardware Bot, top view', explainer: "The main parts and where they sit: two hub motors, casters front and back, the lidar and a pan/tilt camera. The layout is a sketch until we publish the exact design files.", status: 'notes', source: 'brief:§0' },
  'hw-2': { caption: 'Hardware Bot specifications', explainer: 'The hardware and software the robot runs on. Every value comes from the project notes, and anything not yet confirmed is left out rather than guessed.', status: 'notes', source: 'brief:§0' },
  'hw-3': { caption: 'What Hardware Bot can do', explainer: "Seven abilities, from drawing a map to stopping safely. Together they let the robot explore a room it has never seen and report what's in it.", status: 'notes', source: 'brief:§0' },
  'hw-4': { caption: 'Hardware Bot software, layer by layer', explainer: "Read it bottom to top: sensors and motors at the bottom, mapping and decisions in the middle, the dashboard at the top. Data flows up from the sensors, and commands flow back down to the motors.", status: 'notes', source: 'brief:§0' },
  'amr4-1': { caption: 'AMR4, top view', explainer: 'Four special wheels with angled rollers, a lidar and an onboard computer. AMR4 is still in development, so this shows the design, not finished results.', status: 'notes', source: 'brief:§0' },
  'amr4-2': { caption: 'AMR4 specifications', explainer: 'What AMR4 is built from today. "Absent" means the item isn\'t part of this robot yet, for example a camera.', status: 'notes', source: 'brief:§0' },
  'amr4-3': { caption: 'Moving in any direction', explainer: "Mecanum wheels let a robot move in any direction, including straight sideways, without steering. This is a generic drawing of holonomic drive, not a measured AMR4 result. (Illustration.)", status: 'notes', source: 'generic mecanum kinematics (illustrative)' },
  'amr4-4': { caption: 'AMR4 software, layer by layer', explainer: "Only the motor driver and the wheel odometry are confirmed so far. The empty, dashed boxes are deliberate; they show what isn't built or confirmed yet.", status: 'pending', source: 'brief:§0' },
  'tech-1': { caption: 'The technology stack', explainer: 'Everything that makes our robots work, stacked from physical parts up to apps. The white and violet dots show which robot uses each piece, so shared and separate parts are easy to see.', status: 'notes', source: 'brief:§0' },
  'tech-2': { caption: 'How far each lidar can see', explainer: "A lidar measures distance with light. AMR4's sensor sees from 15 cm to 12 m. Hardware Bot's range isn't stated in its branch, so we show a gap instead of borrowing a number.", status: 'notes', source: 'brief:§0' },
  'tech-3': { caption: 'Which sensors each robot has', explainer: "A simple yes or absent grid. It explains why only Hardware Bot can label objects: it's the only one with a camera.", status: 'notes', source: 'brief:§0' },
  'tech-4': { caption: 'An occupancy map, up close', explainer: 'The robot splits the floor into 5 cm squares and marks each one free, blocked or unknown. That grid is what it uses to plan where it can safely drive. (Illustration.)', status: 'notes', source: 'brief:§0 (illustrative grid)' },
  'tech-5': { caption: 'From goal to wheels', explainer: 'You pick a destination; the planner finds a route, the controller turns it into wheel speeds, and the motors move. Exact plugin names will be added once confirmed from the code.', status: 'notes', source: 'brief:§0' },
  'tech-6': { caption: 'Knowing where it is', explainer: "On Hardware Bot, an EKF (a statistical filter) merges several estimates of how the robot moved into one best guess of its position. Which inputs it uses will be listed once confirmed from the code.", status: 'pending', source: 'brief:§0' },
  'tech-7': { caption: 'Seeing and naming objects', explainer: 'The camera image goes through an object-recognition model, and the names land on the map ("chair", "door"). That turns a floor plan into a map people can read.', status: 'notes', source: 'brief:§0' },
  'tech-8': { caption: 'The robot dashboard', explainer: "Hardware Bot has a web dashboard that opens in a browser, so there is nothing to install. This is a sketch until a screenshot is published.", status: 'notes', source: 'brief:§0' },
  'about-1': { caption: 'Where we are', explainer: 'Our milestones so far. Dates are added as they\'re confirmed, so the timeline only shows what has actually happened.', status: 'notes', source: 'brief:§0, §1' },
  'contact-1': { caption: 'Where your message goes', explainer: "Your message goes either into a database that only accepts new messages, or straight from your own email app to amey@amrslam.tech. Either way it's used only to reply to you.", status: 'notes', source: 'AMR contact process' },
  'privacy-1': { caption: 'Your data at a glance', explainer: 'Each row is one piece of data: why we keep it, where, and for how long. It summarises the policy below in a single view.', status: 'notes', source: 'pages-spec §8 (draft)' },
} as const satisfies Record<string, FigureText>;
export type FigureId = keyof typeof figures;

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const sentences = (s: string) => (s.match(/[.!?](\s|$)/g) ?? []).length;
/** Throws on a missing/invalid figure text; used by Figure at render time and by tests. */
export function getFigure(id: string): FigureText {
  const f = (figures as Record<string, FigureText>)[id];
  if (!f) throw new Error(`Figure "${id}" has no entry in src/data/pages/figures.ts (caption + explainer required)`);
  if (!f.caption?.trim()) throw new Error(`Figure "${id}" is missing its caption`);
  if (!f.explainer?.trim()) throw new Error(`Figure "${id}" is missing its explainer`);
  if (words(f.caption) > 12) throw new Error(`Figure "${id}" caption exceeds 12 words`);
  if (words(f.explainer) > 60 || sentences(f.explainer) < 1 || sentences(f.explainer) > 3) throw new Error(`Figure "${id}" explainer must be 1-3 sentences, ≤ 60 words`);
  return f;
}
