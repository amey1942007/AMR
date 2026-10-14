import type { ReactNode } from 'react';
/** Robot applicability chip on /technology statements (HARDWARE BOT white / AMR4 violet). */
export function RobotTag({ robot }: { robot: 'hardware' | 'amr4' }) {
  return <span className={`eyebrow inline-flex h-6 items-center rounded-full border px-2.5 align-middle ${robot === 'hardware' ? 'border-white/60 text-white' : 'border-violet text-white'}`}>{robot === 'hardware' ? 'HARDWARE BOT' : 'AMR4'}</span>;
}
export function Tagged({ robot, children }: { robot: 'hardware' | 'amr4'; children: ReactNode }) {
  return <p className="flex flex-wrap items-baseline gap-3"><RobotTag robot={robot} /><span>{children}</span></p>;
}
