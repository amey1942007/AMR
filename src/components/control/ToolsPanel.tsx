'use client';
import { useState } from 'react';
import type { BotTelemetry, ControlCommand } from '@/lib/telemetry/protocol';

const BTN =
  'rounded-[var(--radius-chip)] border border-white/15 bg-white/5 px-3 py-2 text-[length:var(--text-small)] text-white transition enabled:hover:bg-white/12 disabled:opacity-40';

export function ToolsPanel({
  frame,
  canDrive,
  onCommand,
}: {
  frame: BotTelemetry | null;
  canDrive: boolean;
  onCommand: (cmd: ControlCommand) => void;
}) {
  const toolBusy = !!frame?.tool;
  const [calSpeed, setCalSpeed] = useState('0.5');
  const [calRot, setCalRot] = useState('2');
  const [ddDist, setDdDist] = useState('1.0');
  const [ddVel, setDdVel] = useState('0.3');
  const [mapName, setMapName] = useState('');
  const disabled = !canDrive || toolBusy;

  const yolo =
    Array.isArray(frame?.yoloDet) && frame.yoloDet.length
      ? frame.yoloDet.map(String).join(', ')
      : '';

  return (
    <div className="flex flex-col gap-4">
      {toolBusy && (
        <div className="flex items-center gap-2 rounded-[var(--radius-chip)] border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-[length:var(--text-small)] text-amber-200">
          <span className="font-mono">{frame?.tool}</span> running…
          <button
            type="button"
            className={`${BTN} ml-auto border-[var(--danger)]/40 text-[var(--danger)]`}
            disabled={!canDrive}
            onClick={() => onCommand({ type: 'stop_tool' })}
          >
            Stop
          </button>
        </div>
      )}

      <section className="space-y-2">
        <h3 className="text-[length:var(--text-small)] font-semibold text-white/90">IMU test</h3>
        <p className="text-[length:var(--text-small)] text-muted">Static bias / noise / rate — keep robot still.</p>
        <button type="button" className={BTN} disabled={disabled} onClick={() => onCommand({ type: 'run_tool', tool: 'imu_test' })}>
          Run test
        </button>
      </section>

      <section className="space-y-2">
        <h3 className="text-[length:var(--text-small)] font-semibold text-white/90">IMU calibration</h3>
        <p className="text-[length:var(--text-small)] text-muted">Rotates in place — clear space first.</p>
        <div className="flex flex-wrap gap-2">
          <label className="text-[length:var(--text-small)] text-muted">
            speed
            <input className="ml-1 w-16 rounded border border-white/15 bg-black/40 px-2 py-1 text-white" value={calSpeed} onChange={(e) => setCalSpeed(e.target.value)} />
          </label>
          <label className="text-[length:var(--text-small)] text-muted">
            rotations
            <input className="ml-1 w-14 rounded border border-white/15 bg-black/40 px-2 py-1 text-white" value={calRot} onChange={(e) => setCalRot(e.target.value)} />
          </label>
          <button
            type="button"
            className={BTN}
            disabled={disabled}
            onClick={() => onCommand({ type: 'run_tool', tool: 'imu_calibration', params: { speed: calSpeed, rotations: calRot } })}
          >
            Calibrate
          </button>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-[length:var(--text-small)] font-semibold text-white/90">Drive distance</h3>
        <p className="text-[length:var(--text-small)] text-muted">Negative distance = backward.</p>
        <div className="flex flex-wrap gap-2">
          <label className="text-[length:var(--text-small)] text-muted">
            m
            <input className="ml-1 w-16 rounded border border-white/15 bg-black/40 px-2 py-1 text-white" value={ddDist} onChange={(e) => setDdDist(e.target.value)} />
          </label>
          <label className="text-[length:var(--text-small)] text-muted">
            max vel
            <input className="ml-1 w-16 rounded border border-white/15 bg-black/40 px-2 py-1 text-white" value={ddVel} onChange={(e) => setDdVel(e.target.value)} />
          </label>
          <button
            type="button"
            className={BTN}
            disabled={disabled}
            onClick={() => onCommand({ type: 'run_tool', tool: 'drive_distance', params: { distance: ddDist, max_vel: ddVel } })}
          >
            Drive
          </button>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-[length:var(--text-small)] font-semibold text-white/90">Semantic vision</h3>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={`${BTN} ${frame?.vision ? 'border-[var(--danger)]/40 text-[var(--danger)]' : ''}`}
            disabled={!canDrive}
            onClick={() => onCommand({ type: 'vision', on: !frame?.vision })}
          >
            {frame?.vision ? 'Stop vision' : 'Start vision'}
          </button>
          {yolo && <span className="text-[length:var(--text-small)] text-muted">{yolo}</span>}
        </div>
      </section>

      <section className="space-y-2 border-t border-white/10 pt-3">
        <h3 className="text-[length:var(--text-small)] font-semibold text-white/90">Save map</h3>
        <div className="flex flex-wrap gap-2">
          <input
            className="min-w-0 flex-1 rounded border border-white/15 bg-black/40 px-2 py-1.5 text-[length:var(--text-small)] text-white"
            placeholder="map name (blank = timestamp)"
            value={mapName}
            onChange={(e) => setMapName(e.target.value)}
          />
          <button
            type="button"
            className={BTN}
            disabled={!canDrive || !!frame?.saving}
            onClick={() => onCommand({ type: 'save_map', name: mapName || undefined })}
          >
            {frame?.saving ? 'Saving…' : 'Save map'}
          </button>
        </div>
        <p className="text-[10px] text-muted">Gamepad: B save · X vision · LT+RT+LB+RB IMU cal · A sequential</p>
      </section>
    </div>
  );
}
