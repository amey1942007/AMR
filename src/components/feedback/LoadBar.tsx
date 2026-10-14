'use client';
import { useScene } from '@/lib/store';
/** 1 px gradient progress along the top while 3D assets load; fades at 100%. Decorative (aria-hidden). */
export function LoadBar() {
  const load = useScene((s) => s.load);
  return (
    <div aria-hidden className="bg-grad absolute top-0 left-0 h-px" style={{ width: `${load * 100}%`, opacity: load > 0 && load < 1 ? 1 : 0, transition: 'opacity 300ms, width 200ms' }} />
  );
}
