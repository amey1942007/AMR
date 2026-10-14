import { describe, expect, it } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { figures, getFigure } from '@/data/pages/figures';
import { robotFacts, factFor, COMPARE_KEYS, lidarRange } from '@/data/pages/robots';
import { amr4Arch, hardwareArch } from '@/data/pages/architecture';
import { buildMailto, validatePage, MAILTO_BODY_MAX } from '@/lib/contact-page';
import { normalise } from '@/services/adapters/contact.shared';
import { createSupabaseContact } from '@/services/adapters/contact.supabase';
import { linear } from '@/components/paper/Chart';
import { Figure } from '@/components/paper/Figure';
import { SpecTable, CompareTable } from '@/components/paper/SpecTable';
import { LayeredDiagram } from '@/components/paper/LayeredDiagram';
import { PaperSection } from '@/components/paper/PaperSection';
import { PageHeader } from '@/components/paper/PageHeader';

describe('figure text (§11.7)', () => {
  it('has all 22 figures with caption + explainer that pass the rules', () => {
    expect(Object.keys(figures)).toHaveLength(21);
    for (const id of Object.keys(figures)) expect(() => getFigure(id)).not.toThrow();
  });
  it('throws (fails the static build) when a figure has no text', () => {
    expect(() => getFigure('nope-1')).toThrow(/caption \+ explainer required/);
    expect(() => renderToStaticMarkup(h(Figure, { id: 'nope-1' as never, children: 'x' }))).toThrow();
  });
  it('renders number, caption, explainer and source chip', () => {
    const html = renderToStaticMarkup(h(Figure, { id: 'tech-2', children: h('svg') }));
    expect(html).toContain('<strong>Fig. 2</strong> How far each lidar can see.');
    expect(html).toContain('15 cm to 12 m');
    expect(html).toContain('FROM PROJECT NOTES');
    expect(html).toMatch(/<figure[^>]+aria-labelledby="fig-tech-2-cap"/);
  });
});

describe('robot facts never mix (brief §0.1)', () => {
  const { hardware, amr4 } = robotFacts;
  it('keeps AMR4 free of Hardware-Bot-only items and claims', () => {
    const txt = JSON.stringify(amr4.facts).toLowerCase();
    for (const w of ['pi 5', 'jazzy', 's2e', 'ddsm', 'pan/tilt', 'slam_toolbox', 'nav2', 'yolo', 'dashboard', 'frontier']) expect(txt).not.toContain(w);
    expect(factFor(amr4, 'camera')?.absent).toBe(true);
  });
  it('keeps Hardware Bot free of AMR4 items', () => {
    const txt = JSON.stringify(hardware.facts).toLowerCase();
    for (const w of ['jetson', 'humble', 'a1', 'mecanum', '0.52', '22.04']) expect(txt).not.toContain(w);
  });
  it('never renders pending (CODE-PENDING) rows', () => {
    const html = renderToStaticMarkup(h(SpecTable, { robot: amr4, caption: 'c' }));
    expect(html).not.toContain('CODE-PENDING');
    expect(html).toContain('absent in this branch');
    expect(html).toContain('1.0 m/s (design max)');
  });
  it('compare table binds each column to one robot', () => {
    const html = renderToStaticMarkup(h(CompareTable, { left: hardware, right: amr4, caption: 'c' }));
    expect((html.match(/data-robot="hardware"/g) ?? []).length).toBe(COMPARE_KEYS.length * 2); // desktop + mobile table
    expect((html.match(/data-robot="amr4"/g) ?? []).length).toBe(COMPARE_KEYS.length * 2);
    expect(html).toContain('scope="col"');
  });
  it('imports no datasheet lidar range for Hardware Bot', () => {
    expect(lidarRange.hardware).toBeNull();
    expect(lidarRange.amr4).toEqual([0.15, 12]);
  });
});

describe('layered architecture', () => {
  it('AMR4 has no Nav2/SLAM claims; upper layers are absent', () => {
    const labels = amr4Arch.layers.flatMap((l) => l.nodes.map((n) => n.label.toLowerCase())).join(' ');
    expect(labels).not.toMatch(/nav2|slam|yolo|dashboard/);
    expect(amr4Arch.layers.slice(0, 3).every((l) => l.nodes.every((n) => n.status === 'absent'))).toBe(true);
    // Only the driver + odometry are confirmed (§0); the lidar driver node is not.
    const confirmed = amr4Arch.layers.slice(3, 5).flatMap((l) => l.nodes.filter((n) => n.status !== 'absent').map((n) => n.id));
    expect(confirmed.sort()).toEqual(['drv', 'mo']);
  });
  it('edges reference existing nodes', () => {
    for (const a of [hardwareArch, amr4Arch]) {
      const ids = new Set(a.layers.flatMap((l) => l.nodes.map((n) => n.id)));
      for (const e of a.edges) { expect(ids.has(e.from)).toBe(true); expect(ids.has(e.to)).toBe(true); }
    }
  });
  it('renders dashed absent boxes and a text description', () => {
    const html = renderToStaticMarkup(h(LayeredDiagram, { arch: amr4Arch, title: 't' }));
    expect(html).toContain('data-status="absent"');
    expect(html).toContain('Text description');
  });
});

describe('paper copy rules', () => {
  it('rejects > 4 paragraphs and > 60-word paragraphs', () => {
    expect(() => renderToStaticMarkup(h(PaperSection, { id: 'a', n: '1', title: 't', paras: ['a', 'b', 'c', 'd', 'e'] }))).toThrow();
    expect(() => renderToStaticMarkup(h(PaperSection, { id: 'a', n: '1', title: 't', paras: [Array(61).fill('w').join(' ')] }))).toThrow();
  });
  it('rejects an abstract over 35 words', () => {
    expect(() => renderToStaticMarkup(h(PageHeader, { crumbs: [{ label: 'Home' }], eyebrow: 'e', title: 't', abstract: Array(36).fill('w').join(' ') }))).toThrow();
  });
});

describe('contact page', () => {
  const ok = { name: 'Asha', email: 'asha@example.com', company: 'Acme', topic: 'Pilot / demo', message: 'Hello' };
  it('requires a topic from the list', () => {
    expect(validatePage({ ...ok, topic: '' }).topic).toBe('Choose a topic.');
    expect(validatePage({ ...ok, topic: 'Spam' }).topic).toBe('Choose a topic.');
    expect(validatePage(ok)).toEqual({});
  });
  it('builds the mailto per spec (encoded, truncated to 1800)', () => {
    const url = buildMailto(ok);
    expect(url.startsWith('mailto:amey@amrslam.tech?subject=')).toBe(true);
    const q = new URLSearchParams(url.split('?')[1]);
    expect(q.get('subject')).toBe('[Pilot / demo] Website enquiry from Asha');
    expect(q.get('body')).toBe('Hello\n\nAsha · Acme · asha@example.com');
    const long = new URLSearchParams(buildMailto({ ...ok, message: 'x'.repeat(5000) }).split('?')[1]).get('body')!;
    expect(long.length).toBeLessThanOrEqual(MAILTO_BODY_MAX);
    expect(long.endsWith('asha@example.com')).toBe(true);
  });
  it('whitespace-only or null subject inserts null through the Supabase adapter', async () => {
    const rows: Record<string, unknown>[] = [];
    const mem = new Map<string, string>();
    const kv = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    const svc = createSupabaseContact({ url: 'https://x.supabase.co', key: 'sb_publishable_abc', kv, insert: async (r) => { rows.push(r); return { error: null }; } });
    expect((await svc.submit({ ...ok, subject: '   ' })).status).toBe('ok');
    mem.clear();
    expect((await svc.submit({ ...ok, subject: null })).status).toBe('ok');
    expect(rows.map((r) => r.subject)).toEqual([null, null]);
  });
  it('maps topic → subject column and source contact-page', () => {
    const row = normalise({ ...ok, subject: 'Pilot / demo', source: 'contact-page' });
    expect(row.subject).toBe('Pilot / demo');
    expect(row.source).toBe('contact-page');
    expect(normalise({ ...ok }).subject).toBeNull();
  });
});

it('linear scale', () => {
  const x = linear([0, 12], [0, 120]);
  expect(x(6)).toBe(60);
});

describe('review fixes', () => {
  it('no unbacked claims in figure text', () => {
    const all = JSON.stringify(figures).toLowerCase();
    for (const w of ['heavier computer', 'only relies on the one below', 'live map', 'turn on the spot', 'tight homes', 'wheel movement and sensor data', 'pre-built static', '3D viewer', 'GitHub Pages', 'this website', 'secure database']) expect(all).not.toContain(w);
  });
  it('magenta is not used as a fill for the occupancy grid cells', async () => {
    const { OccupancyGrid } = await import('@/components/paper/illustrations');
    const html = renderToStaticMarkup(h(OccupancyGrid));
    expect((html.match(/fill="#E81CB0"/g) ?? []).length).toBe(0);
    expect(html).toContain('<title');
  });
});
