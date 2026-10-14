import { Timer, setConsoleFunction } from 'three';

/**
 * Timer-backed stand-in for R3F's store clock (`state.clock`). R3F 9 still constructs a THREE.Clock when it creates
 * its store; JourneyCanvas swaps that for this in onCreated, and silenceR3FClockWarning() drops only that one
 * deprecation line (three's documented setConsoleFunction hook); every other three.js message passes through.
 */
export class TimerClock {
  autoStart = true; running = false; startTime = 0; oldTime = 0; elapsedTime = 0;
  private t = new Timer();
  start() { this.t.reset(); this.running = true; }
  stop() { this.running = false; }
  getElapsedTime() { if (!this.running && this.autoStart) this.start(); if (this.running) { this.t.update(); this.elapsedTime = this.t.getElapsed(); } return this.elapsedTime; }
  getDelta() { if (!this.running && this.autoStart) this.start(); if (!this.running) return 0; this.t.update(); return this.t.getDelta(); }
}
let silenced = false;
export function silenceR3FClockWarning() {
  if (silenced) return;
  silenced = true;
  setConsoleFunction((type: string, message: string, ...rest: unknown[]) => {
    if (type === 'warn' && /Clock: This module has been deprecated/.test(String(message))) return;
    (console as unknown as Record<string, (...a: unknown[]) => void>)[type]?.(message, ...rest);
  });
}
