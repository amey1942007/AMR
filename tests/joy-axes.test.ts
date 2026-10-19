import { describe, expect, it } from 'vitest';
import { joyActive, leftKnobOffset, screenToLeftStick, screenToRightStick } from '@/lib/control/joy-axes';

describe('joy axes ↔ web_gamepad_node', () => {
  it('maps screen up/right to ROS left-stick up/right', () => {
    // screen up (dy < 0) → a[1] = +1 forward
    expect(screenToLeftStick(0, -1)).toEqual({ x: 0, y: 1 });
    // screen right (dx > 0) → a[0] = -1 (turn right)
    expect(screenToLeftStick(1, 0)).toEqual({ x: -1, y: 0 });
    // screen left → +1
    expect(screenToLeftStick(-1, 0)).toEqual({ x: 1, y: 0 });
  });

  it('maps right stick like the browser Gamepad path', () => {
    expect(screenToRightStick(1, 0)).toEqual({ x: -1, y: 0 });
    expect(screenToRightStick(0, -1)).toEqual({ x: 0, y: -1 });
  });

  it('knob offset follows packed left axes', () => {
    // forward (y=+1) moves knob up
    expect(leftKnobOffset(0, 1, 28)).toEqual({ x: 0, y: -28 });
    // turn right (x=-1) moves knob right
    expect(leftKnobOffset(-1, 0, 28)).toEqual({ x: 28, y: 0 });
  });

  it('detects active joy', () => {
    expect(joyActive([0, 0, 0, 0, 0, 0, 0, 0], 0)).toBe(false);
    expect(joyActive([0, 0.5, 0, 0, 0, 0, 0, 0], 0)).toBe(true);
    expect(joyActive([0, 0, 0, 0, 0, 0, 0, 0], 1)).toBe(true);
  });
});
