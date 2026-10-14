import type { ReactNode } from 'react';
import { svgA11y } from './svgA11y';

export interface GLabel { x: number; y: number; text: string; tx?: number; ty?: number }
/**
 * Labelled line-art illustration. Children = the drawing (1.5 px white strokes) inside a viewBox; labels get leader
 * lines on ≥ 768 px and become a numbered key below on < 768 px.
 */
export function Graphic({ viewBox, title, alt, labels = [], children }: { viewBox: string; title: string; alt: string; labels?: GLabel[]; children: ReactNode }) {
  const a = svgA11y(title, alt);
  return (
    <div>
      <svg {...a.props} viewBox={viewBox} className="mx-auto w-full max-w-[760px]" fill="none" stroke="#fff" strokeWidth={1.5}>
        {a.nodes}
        {children}
        {labels.map((l, i) => (
          <g key={l.text}>
            {l.tx != null && <line x1={l.x} y1={l.y} x2={l.tx} y2={l.ty ?? l.y} stroke="#8A8794" strokeWidth={1} className="hidden @[640px]:inline" />}
            <circle cx={l.x} cy={l.y} r={3} fill="#E81CB0" stroke="none" />
            <text x={(l.tx ?? l.x) + (l.tx != null && l.tx < l.x ? -6 : 6)} y={(l.ty ?? l.y) + 4} textAnchor={l.tx != null && l.tx < l.x ? 'end' : 'start'} fill="#fff" stroke="none" className="hidden @[640px]:inline" style={{ fontFamily: 'var(--font-mono)', fontSize: 16 }}>{l.text}</text>
            <text x={l.x + 6} y={l.y - 6} fill="#fff" stroke="none" className="@[640px]:hidden" style={{ fontFamily: 'var(--font-mono)', fontSize: 40 }}>{i + 1}</text>
          </g>
        ))}
      </svg>
      {labels.length > 0 && (
        <ol className="mt-4 grid list-decimal grid-cols-1 gap-1 pl-5 font-mono text-[12px] text-white/85 sm:grid-cols-2 @[640px]:sr-only">
          {labels.map((l) => <li key={l.text}>{l.text}</li>)}
        </ol>
      )}
    </div>
  );
}
