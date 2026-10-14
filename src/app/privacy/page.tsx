import { StubPage } from '@/components/StubPage';
import { COMPANY_NAME, EMAIL } from '@/lib/content';
export const metadata = { title: 'Privacy | amrslam.tech', alternates: { canonical: '/privacy/' } };

export default function Page() {
  return (
    <StubPage eyebrow="Privacy" title="Privacy">
      <div className="flex flex-col gap-6">
        <p>Last updated: 14 October 2026. This notice covers amrslam.tech, run by {COMPANY_NAME} (founder: Amey Chaudhari, India).</p>
        <section>
          <h2 className="text-[length:var(--text-h3)] font-semibold text-white">What we collect</h2>
          <p className="mt-2">Only what you send through the contact form: your name, email address, optional company and your message. With it we store the page you sent it from, your browser&apos;s user-agent string and the time. We use no analytics, advertising or tracking cookies.</p>
        </section>
        <section>
          <h2 className="text-[length:var(--text-h3)] font-semibold text-white">Why and where</h2>
          <p className="mt-2">We use it only to reply to you. Submissions are stored in our Supabase database (region ap-south-1, Mumbai) and are readable only by us. The site itself is static and hosted on GitHub Pages, which may keep standard server logs (such as IP addresses) for security.</p>
        </section>
        <section>
          <h2 className="text-[length:var(--text-h3)] font-semibold text-white">Local storage</h2>
          <p className="mt-2">Your browser stores one value, <code className="font-mono">amr_contact_last</code> (the time of your last message), to prevent repeat submissions within 30 seconds. It never leaves your device.</p>
        </section>
        <section>
          <h2 className="text-[length:var(--text-h3)] font-semibold text-white">Retention and your rights</h2>
          <p className="mt-2">We keep messages for as long as needed to handle your enquiry, then delete them. To see, correct or delete what we hold about you, email <a className="underline" href={`mailto:${EMAIL}`}>{EMAIL}</a>.</p>
        </section>
      </div>
    </StubPage>
  );
}
