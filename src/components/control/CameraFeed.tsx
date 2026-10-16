'use client';
import type { LinkPhase } from '@/lib/telemetry/link-status';
import type { BotTelemetry } from '@/lib/telemetry/protocol';

function cameraSrc(frame: BotTelemetry | null): string | null {
  if (!frame) return null;
  if (frame.cameraJpegB64) {
    return frame.cameraJpegB64.startsWith('data:')
      ? frame.cameraJpegB64
      : `data:image/jpeg;base64,${frame.cameraJpegB64}`;
  }
  if (frame.cameraUrl) {
    return `${frame.cameraUrl}${frame.cameraUrl.includes('?') ? '&' : '?'}t=${frame.ts}`;
  }
  return null;
}

export function CameraFeed({
  frame,
  phase,
  boardMode,
}: {
  frame: BotTelemetry | null;
  phase: LinkPhase;
  boardMode: boolean;
}) {
  if (boardMode) {
    return (
      <div className="grid aspect-video place-items-center bg-black/40 text-[length:var(--text-small)] text-muted">
        Camera paused (board mode)
      </div>
    );
  }

  const src = phase === 'live' ? cameraSrc(frame) : null;
  const waiting = phase === 'live' || phase === 'connecting'
    ? 'Waiting for camera…'
    : 'Camera unavailable until the robot is live';

  return (
    <div className="relative aspect-video overflow-hidden bg-[#050507]">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="Robot camera" className="size-full object-cover" />
      ) : (
        <div className="grid size-full place-items-center px-4 text-center text-[length:var(--text-small)] text-muted">
          {waiting}
        </div>
      )}
      <span className="absolute left-3 top-3 eyebrow text-white/70">CAM</span>
    </div>
  );
}
