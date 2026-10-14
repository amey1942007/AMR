'use client';
import { Dialog } from '@/components/ui/Dialog';
import { ContactForm } from './ContactForm';
import { PillButton } from '@/components/nav/PillButton';
import { Close } from '@/components/icons';
import { useUI } from '@/lib/ui-store';
import { useServices } from '@/components/providers/ServicesProvider';
import { EMAIL } from '@/lib/content';

export function ContactDrawer() {
  const open = useUI((s) => s.dialog === 'contact');
  const close = useUI((s) => s.closeDialog);
  const opener = useUI((s) => s.opener);
  const { contact } = useServices();
  const available = contact.isAvailable();

  return (
    <Dialog
      id="contact-drawer"
      open={open}
      onClose={close}
      labelledBy="contact-title"
      returnFocus={() => opener}
      initialFocus={() => (available ? document.getElementById('cf-name') : document.querySelector<HTMLElement>('#contact-mailto-wrap a'))}
    >
      <div data-open={open} className="dlg-backdrop absolute inset-0 bg-[rgba(5,5,7,.6)]" onClick={close} />
      <div
        data-open={open}
        className="drawer-panel absolute top-0 right-0 flex h-full w-full flex-col overflow-y-auto border-l border-[var(--line-dark)] bg-bg p-8 text-white min-[480px]:w-[440px]"
        style={{ boxShadow: '-24px 0 64px rgba(0,0,0,.5)' }}
      >
        <div className="mb-8 flex items-center justify-between">
          <h2 id="contact-title" className="text-[length:var(--text-h3)] font-semibold tracking-[-0.01em]">Contact us</h2>
          <button type="button" onClick={close} aria-label="Close contact form" className="grid size-11 place-items-center rounded-full border border-white/40">
            <Close />
          </button>
        </div>
        <div className="flex-1">
          {available ? (
            <ContactForm />
          ) : (
            <span id="contact-mailto-wrap">
              <PillButton kind="filled" href={`mailto:${EMAIL}`} icon="arrow">Email {EMAIL}</PillButton>
            </span>
          )}
        </div>
        <p className="mt-8 text-[length:var(--text-small)] text-muted">
          Prefer email? <a className="text-white underline" href={`mailto:${EMAIL}`}>{EMAIL}</a>
        </p>
      </div>
    </Dialog>
  );
}
