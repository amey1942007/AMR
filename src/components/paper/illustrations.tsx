/** Schematic line drawings for subpage figures (status 'notes': positions are schematic until URDF is available). */
import type { ReactNode } from 'react';
import { Graphic } from './Graphic';
import { svgA11y } from './svgA11y';

export function HardwareTopView() {
  // Chassis 0.45 × 0.25 m (forward = right). Two hub motors mid-length on each side; casters front and back.
  return (
    <Graphic viewBox="0 0 760 360" title="Hardware Bot, top view (schematic)" alt="Schematic top view of Hardware Bot, front to the right: a rectangular chassis with a DDSM115 hub motor on each side, a caster at the front and one at the back, the RPLidar S2E on top in the centre, the pan/tilt camera near the front and the Raspberry Pi 5 inside."
      labels={[
        { x: 380, y: 69, text: 'hub motor 1/2', tx: 600, ty: 40 },
        { x: 380, y: 291, text: 'hub motor 2/2', tx: 600, ty: 330 },
        { x: 380, y: 160, text: 'RPLidar S2E', tx: 610, ty: 120 },
        { x: 485, y: 205, text: 'pan/tilt camera', tx: 610, ty: 230 },
        { x: 300, y: 233, text: 'Raspberry Pi 5', tx: 150, ty: 330 },
        { x: 530, y: 120, text: 'front caster', tx: 610, ty: 80 },
        { x: 230, y: 120, text: 'rear caster', tx: 150, ty: 40 },
      ]}>
      <rect x={200} y={80} width={360} height={200} rx={18} />
      <rect x={340} y={58} width={80} height={22} rx={6} />
      <rect x={340} y={280} width={80} height={22} rx={6} />
      <circle cx={230} cy={120} r={11} />
      <circle cx={530} cy={120} r={11} />
      <circle cx={380} cy={160} r={34} /><circle cx={380} cy={160} r={14} />
      <rect x={470} y={190} width={30} height={30} rx={6} />
      <rect x={265} y={210} width={70} height={46} rx={4} strokeDasharray="4 3" />
      <path d="M575 180 h36 m-10 -8 l10 8 l-10 8" stroke="#8A8794" />
    </Graphic>
  );
}

function Mecanum({ x, y, flip }: { x: number; y: number; flip?: boolean }) {
  return (
    <g>
      <rect x={x} y={y} width={44} height={90} rx={8} />
      {[0, 1, 2, 3, 4].map((i) => <line key={i} x1={x + 6} x2={x + 38} y1={y + 12 + i * 16 + (flip ? 12 : 0)} y2={y + 12 + i * 16 + (flip ? 0 : 12)} strokeWidth={1} />)}
    </g>
  );
}

export function Amr4TopView() {
  return (
    <Graphic viewBox="0 0 760 420" title="AMR4, top view (schematic)" alt="Schematic top view of AMR4: rectangular chassis with four mecanum wheels whose rollers are angled, the RPLidar A1 near the front and the Jetson Orin Nano computer in the centre."
      labels={[
        { x: 222, y: 80, text: '4 mecanum wheels (angled rollers)', tx: 250, ty: 30 },
        { x: 380, y: 120, text: 'RPLidar A1 (USB)', tx: 620, ty: 60 },
        { x: 380, y: 250, text: 'Jetson Orin Nano', tx: 620, ty: 300 },
      ]}>
      <rect x={250} y={60} width={260} height={315} rx={16} />
      <Mecanum x={200} y={70} /><Mecanum x={516} y={70} flip /><Mecanum x={200} y={275} flip /><Mecanum x={516} y={275} />
      <circle cx={380} cy={120} r={30} /><circle cx={380} cy={120} r={12} />
      <rect x={330} y={215} width={100} height={70} rx={6} strokeDasharray="4 3" />
    </Graphic>
  );
}

export function HolonomicMotion() {
  const box = (cx: number, _label: string, arrows: ReactNode) => (
    <g>
      <rect x={cx - 60} y={90} width={120} height={150} rx={12} />
      {arrows}
    </g>
  );
  const head = (x: number, y: number, rot: number) => <path d="M-8 -6 L0 6 L8 -6" transform={`translate(${x} ${y}) rotate(${rot})`} stroke="#7B2FF7" strokeWidth={2} />;
  return (
    <Graphic viewBox="0 0 760 330" title="Holonomic motion (illustration)" alt="Illustration of three mecanum motions: forward, strafing sideways and rotating."
      labels={[{ x: 140, y: 270, text: 'forward' }, { x: 380, y: 270, text: 'strafe sideways' }, { x: 620, y: 270, text: 'rotate' }]}>
      {box(140, 'forward', <><line x1={140} y1={210} x2={140} y2={40} stroke="#7B2FF7" strokeWidth={2} />{head(140, 40, 180)}</>)}
      {box(380, 'strafe', <><line x1={330} y1={165} x2={500} y2={165} stroke="#7B2FF7" strokeWidth={2} />{head(500, 165, -90)}</>)}
      {box(620, 'rotate', <><path d="M560 100 A80 80 0 0 1 690 110" stroke="#7B2FF7" strokeWidth={2} />{head(690, 110, -60)}</>)}
    </Graphic>
  );
}

/** Deterministic illustrative 5 cm occupancy grid (24 × 14 cells = 1.2 × 0.7 m). */
export function OccupancyGrid() {
  const C = 26, cols = 24, rows = 14;
  const cell = (c: number, r: number) => {
    if (r === 0 || r === rows - 1 || c === 0 || (c === cols - 1 && r < 9)) return 'occ';
    if (c >= 9 && c <= 11 && r >= 4 && r <= 6) return 'occ';
    if (c > 16 && r > 8) return 'unk';
    return 'free';
  };
  const a = svgA11y('An occupancy map, up close (illustration)', 'Illustrative occupancy grid of 5 centimetre cells: walls and an obstacle are blocked (light grey), open floor is free (faint), a corner not yet seen is unknown (outlined), and one planned path is highlighted in magenta.');
  const cells = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const k = cell(c, r);
    cells.push(<rect key={`${c}-${r}`} x={c * C + 1} y={r * C + 1} width={C - 2} height={C - 2} rx={2} fill={k === 'occ' ? 'rgba(230,228,236,.6)' : k === 'free' ? 'rgba(255,255,255,.10)' : 'transparent'} stroke={k === 'unk' ? 'rgba(255,255,255,.18)' : 'none'} strokeDasharray="2 2" strokeWidth={1} />);
  }
  return (
    <div>
      <svg {...a.props} viewBox={`0 0 ${cols * C} ${rows * C + 40}`} className="w-full">
        {a.nodes}
        {cells}
        <path d={`M${2.5 * C} ${10.5 * C} L${7.5 * C} ${8.5 * C} L${13.5 * C} ${8.5 * C} L${15.5 * C} ${3.5 * C}`} fill="none" stroke="#E81CB0" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        <line x1={0} x2={C} y1={rows * C + 16} y2={rows * C + 16} stroke="#8A8794" />
      </svg>
      <p className="mt-3 flex flex-wrap gap-5 font-mono text-[12px] text-muted">
        <span className="inline-flex items-center gap-2"><span aria-hidden className="h-3 w-3 rounded-sm bg-white/10" />free</span>
        <span className="inline-flex items-center gap-2"><span aria-hidden className="h-3 w-3 rounded-sm bg-[rgba(230,228,236,.6)]" />blocked</span>
        <span className="inline-flex items-center gap-2"><span aria-hidden className="h-0.5 w-4 bg-magenta" />planned path (highlight)</span>
        <span className="inline-flex items-center gap-2"><span aria-hidden className="h-px w-4 bg-muted" />scale: one cell = 5 cm</span>
        <span className="inline-flex items-center gap-2"><span aria-hidden className="h-3 w-3 rounded-sm border border-dashed border-white/30" />unknown</span>
      </p>
    </div>
  );
}

export function DashboardSketch() {
  return (
    <Graphic viewBox="0 0 760 400" title="Robot dashboard, wireframe sketch" alt="Wireframe sketch of a browser window for the robot web dashboard, with one large panel and three smaller panels. Layout only, not a screenshot."
      labels={[{ x: 260, y: 210, text: 'main panel (sketch)', tx: 260, ty: 385 }, { x: 600, y: 120, text: 'side panels (sketch)', tx: 500, ty: 20 }]}>
      <rect x={40} y={30} width={680} height={330} rx={12} />
      <line x1={40} y1={64} x2={720} y2={64} />
      <circle cx={62} cy={47} r={5} /><circle cx={80} cy={47} r={5} />
      <rect x={60} y={84} width={400} height={256} rx={8} strokeDasharray="5 4" />
      <path d="M100 300 L160 220 L240 250 L300 160 L400 200" stroke="#E81CB0" />
      <rect x={480} y={84} width={220} height={70} rx={8} />
      <rect x={480} y={170} width={220} height={70} rx={8} />
      <rect x={480} y={256} width={220} height={84} rx={8} />
    </Graphic>
  );
}

/** Lidar sweep: inline SVG + CSS (2.4 s loop), paused off-screen via .sweep-paused and static under reduced motion. */
export function LidarSweep() {
  const sw = svgA11y('Lidar sweep (illustration)', 'A beam rotates around the sensor and dots mark where it hits walls and an obstacle.');
  return (
    <svg {...sw.props} viewBox="0 0 400 300" className="lidar-sweep mx-auto w-full max-w-[520px]">
      {sw.nodes}
      <rect x={20} y={20} width={360} height={260} rx={8} fill="none" stroke="rgba(255,255,255,.25)" />
      <rect x={250} y={70} width={60} height={50} fill="none" stroke="rgba(255,255,255,.25)" />
      {[[20, 60], [20, 150], [20, 240], [120, 20], [220, 20], [340, 20], [380, 140], [380, 230], [250, 95], [280, 120], [120, 280], [260, 280]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r={3} fill="#fff" fillOpacity={0.8} />)}
      <g className="sweep-beam" style={{ transformOrigin: '200px 160px' }}>
        <path d="M200 160 L380 120 A185 185 0 0 1 380 200 Z" fill="url(#sweepgrad)" />
      </g>
      <defs><linearGradient id="sweepgrad" x1="0" x2="1"><stop offset="0" stopColor="#7B2FF7" stopOpacity="0" /><stop offset="1" stopColor="#7B2FF7" stopOpacity=".55" /></linearGradient></defs>
      <circle cx={200} cy={160} r={10} fill="#050507" stroke="#fff" strokeWidth={1.5} />
    </svg>
  );
}
