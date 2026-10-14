import { PageShell, meta } from '@/components/paper/PageShell';
import { PageHeader } from '@/components/paper/PageHeader';
import { Figure } from '@/components/paper/Figure';
import { Mermaid } from '@/components/paper/Mermaid';
import { Callout } from '@/components/paper/Callout';
import { ContactPageForm } from '@/components/pages/ContactPageForm';
import { CopyEmail } from '@/components/pages/CopyEmail';
import { REPO_URL } from '@/lib/content';

export const metadata = meta('/contact/', 'Contact | AMR', 'Get in touch with AMR about pilots, partnerships or the robots. Email amey@amrslam.tech.');

export default function Page() {
  return (
    <PageShell header={<PageHeader crumbs={[{ label: 'Home', href: '/' }, { label: 'Contact' }]} eyebrow="CONTACT" title="Let's talk."
      abstract="Questions about the robots, pilots or partnerships? We usually reply within two working days." meta="EMAIL amey@amrslam.tech" />}>
      <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-12">
        <section aria-label="Send us a message" className="reveal-in lg:col-span-7"><ContactPageForm /></section>
        <aside aria-labelledby="direct-h" className="reveal-in glass h-fit rounded-[var(--radius-card)] p-8 lg:col-span-5">
          <h2 id="direct-h" className="text-[length:var(--text-h3)] font-semibold">Email us directly</h2>
          <div className="mt-4"><CopyEmail /></div>
          <ul className="mt-4 flex flex-col gap-2 text-white/85">
            <li><a className="inline-flex min-h-11 items-center underline underline-offset-4" href={REPO_URL.replace(/\/Ros_lidar_bot$/, '')} target="_blank" rel="noopener noreferrer">GitHub<span className="sr-only"> (opens in new tab)</span></a></li>
            <li>Based in India</li>
          </ul>
        </aside>
      </div>
      <section aria-labelledby="flow-h" className="reveal-in mt-[calc(var(--section-gap)/2)]">
        <h2 id="flow-h" className="sr-only">How your message travels</h2>
        <Figure id="contact-1"><Mermaid name="contact-flow" title="Where your message goes" label="Flowchart: the contact form goes either to Supabase (insert-only) or to your own email app, and both reach amey@amrslam.tech." /></Figure>
        <div className="mt-6 max-w-[640px]"><Callout kind="note" title="Privacy">We use your details only to reply to your message. See the privacy policy for storage and retention.</Callout></div>
      </section>
    </PageShell>
  );
}
