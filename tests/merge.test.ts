import { describe, expect, it } from 'vitest';
import { BoxGeometry, BufferGeometry, Group, InterleavedBuffer, InterleavedBufferAttribute, Mesh, MeshBasicMaterial } from 'three';
import { mergeByMaterialAsync } from '@/lib/merge-async';

describe('mergeByMaterialAsync', () => {
  it('dequantizes interleaved normalized attributes and bakes transforms', async () => {
    // one vertex at (0.5, -0.5, 1) stored as normalized int16 in an interleaved buffer (meshopt style)
    const g = new BufferGeometry();
    const ib = new InterleavedBuffer(new Int16Array([16383, -16384, 32767, 0, 0, 0, 0, 0, 32767, 0, 0, 0]), 4);
    g.setAttribute('position', new InterleavedBufferAttribute(ib, 3, 0, true));
    const mat = new MeshBasicMaterial(), root = new Group();
    const a = new Mesh(g, mat); a.position.set(1, 0, 0); root.add(a);
    const b = new Mesh(new BoxGeometry(1, 1, 1).deleteAttribute('uv').deleteAttribute('normal'), mat); root.add(b);
    const slice = async () => {};
    const out = await mergeByMaterialAsync(root, () => 3, slice);
    expect(out.children.length).toBe(1);
    const pos = (out.children[0] as Mesh).geometry.getAttribute('position');
    expect(pos.getX(0)).toBeCloseTo(1.5, 3);
    expect(pos.getY(0)).toBeCloseTo(-0.5, 3);
    expect(pos.getZ(0)).toBeCloseTo(1, 3);
    expect((out.children[0] as Mesh).geometry.getAttribute('aRoom').getX(0)).toBe(3);
  });
});
