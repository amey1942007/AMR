/** Pack screen stick deltas into the 8-float `a` array web_gamepad_node expects.
 *
 * Screen: +x right, +y down.
 * ROS / web_gamepad (left stick): left = +1, up = +1.
 * Matches the browser Gamepad path in the control panel (`-axes[0]`, `-axes[1]`).
 */
export function screenToLeftStick(dx: number, dy: number): { x: number; y: number } {
  return { x: clamp(-dx), y: clamp(-dy) };
}

/** Right stick: match existing browser Gamepad mapping (−axes[2], +axes[3]). */
export function screenToRightStick(dx: number, dy: number): { x: number; y: number } {
  return { x: clamp(-dx), y: clamp(dy) };
}

export function clamp(n: number, lo = -1, hi = 1): number {
  const v = Math.max(lo, Math.min(hi, n));
  return Object.is(v, -0) ? 0 : v;
}

export function joyActive(a: number[], b: number, eps = 0.02): boolean {
  if (b !== 0) return true;
  return a.some((v) => Math.abs(v) > eps);
}

function px(n: number): number {
  const v = Math.round(n * 1000) / 1000;
  return Object.is(v, -0) ? 0 : v;
}

/** Knob CSS translate (px) so the visual matches packed axes. */
export function leftKnobOffset(ax: number, ay: number, radius = 28): { x: number; y: number } {
  return { x: px(-ax * radius), y: px(-ay * radius) };
}

export function rightKnobOffset(ax: number, ay: number, radius = 28): { x: number; y: number } {
  return { x: px(-ax * radius), y: px(ay * radius) };
}
