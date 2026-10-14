'use client';
import { useState } from 'react';
import { PillButton } from '@/components/nav/PillButton';
import { useUI } from '@/lib/ui-store';
import { useServices } from '@/components/providers/ServicesProvider';
import { EMAIL, REPO_URL } from '@/lib/content';
import dynamic from 'next/dynamic';
const VideoModal = dynamic(() => import('./VideoModal').then((m) => m.VideoModal), { ssr: false });
import { asset } from '@/lib/asset';

export function LinkRow() {
  const { media, config } = useServices();
  const openDialog = useUI((s) => s.openDialog);
  const showToast = useUI((s) => s.showToast);
  const [video, setVideo] = useState<HTMLElement | null>(null);
  return (
    <div className="reveal">
      <h2 className="sr-only">Links</h2>
      <div className="flex flex-wrap gap-3 text-white">
        <PillButton kind="ghost" href={REPO_URL} icon="external">GitHub repo</PillButton>
        {media.hasDemoVideo && <PillButton kind="ghost" onClick={(e) => setVideo(e.currentTarget)}>Watch demo</PillButton>}
        {config.controlPanelUrl ? (
          <PillButton kind="ghost" href={config.controlPanelUrl} icon="external">Control panel</PillButton>
        ) : (
          <PillButton kind="ghost" onClick={() => showToast('Live control panel: coming soon')}>Control panel</PillButton>
        )}
        <PillButton kind="ghost" onClick={(e) => openDialog('contact', e.currentTarget)}>Contact</PillButton>
        <PillButton kind="ghost" href={`mailto:${EMAIL}`}>{EMAIL}</PillButton>
      </div>
      {media.hasDemoVideo && video && (
        <VideoModal open={!!video} onClose={() => setVideo(null)} opener={video} src={asset('/video/demo.mp4')} poster={asset('/img/stills/s3.webp')} />
      )}
    </div>
  );
}
