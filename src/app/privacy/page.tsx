import { PageShell, meta } from '@/components/paper/PageShell';
import { PageHeader } from '@/components/paper/PageHeader';
import { Figure } from '@/components/paper/Figure';
import { DataTable } from '@/components/paper/SpecTable';
import { Note } from '@/components/paper/Note';
import { EMAIL } from '@/lib/content';

export const metadata = { ...meta('/privacy/', 'Privacy policy | AMR', 'How AMR handles personal data on amrslam.tech.'), robots: { index: true, follow: true } };

// DRAFT (pages-spec §8): legal must approve or remove the banner before launch (Q8).
const sections: { id: string; title: string; body: string[] }[] = [
  { id: 'who', title: 'Who we are', body: [`AMR ("we") runs amrslam.tech. Contact: ${EMAIL}. Legal entity name and address: pending.`] },
  { id: 'collect', title: 'What we collect', body: ['Contact form: your name, email, optional company, topic and message, plus the page URL and your browser user-agent.', 'Emails you send us.', 'No accounts and no tracking cookies. The site sets no analytics cookies.'] },
  { id: 'why', title: 'Why we use it (legal basis)', body: ["To reply to your enquiry, on the basis of consent or legitimate interest (to be confirmed under India's DPDP Act 2023 and, for EU visitors, the GDPR)."] },
  { id: 'where', title: "Where it's stored", body: ['Supabase (database) and Zoho Mail (email). The site is hosted on GitHub Pages, which may log IP addresses for security; see GitHub\'s privacy statement.'] },
  { id: 'how-long', title: 'How long', body: ['Form messages are kept for up to 12 months, then deleted.'] },
  { id: 'sharing', title: 'Sharing', body: ['We do not sell or share your data, except with the providers above that process it for us, or when the law requires it.'] },
  { id: 'rights', title: 'Your rights', body: [`You can ask to access, correct or delete your data, or withdraw consent: email ${EMAIL} and we will reply within 30 days. Grievance officer (DPDP): pending.`] },
  { id: 'security', title: 'Security', body: ['HTTPS everywhere, database access rules that only let the public add messages, and no secret keys in the browser.'] },
  { id: 'children', title: 'Children', body: ['This site is not directed at children under 18.'] },
  { id: 'changes', title: 'Changes', body: ['We will update this page and the date above when the policy changes.'] },
];

export default function Page() {
  return (
    <PageShell header={<PageHeader crumbs={[{ label: 'Home', href: '/' }, { label: 'Privacy' }]} eyebrow="PRIVACY" title="Privacy policy"
      abstract="How AMR handles personal data on amrslam.tech: what we collect, why, where it is stored and for how long." meta="DRAFT · pending legal review"
      contents={sections.map((s) => ({ id: s.id, label: s.title }))} />}>
      <div className="print-doc max-w-[72ch]">
        <Note kind="legal" label="DRAFT">Draft: under legal review. Last updated 14 October 2026.</Note>
        <div className="mt-12 max-w-none">
          <Figure id="privacy-1">
            <DataTable caption="Your data at a glance" cols={['Data', 'Purpose', 'Stored in', 'Retention', 'Legal basis']} rows={[
              ['Name, email, company, topic, message', 'Reply to your enquiry', 'Supabase', 'Up to 12 months', 'Consent / legitimate interest (to confirm)'],
              ['Page URL, browser user-agent', 'Spam and abuse checks', 'Supabase', 'Up to 12 months', 'Legitimate interest (to confirm)'],
              ['Emails you send', 'Reply to you', 'Zoho Mail', 'Up to 12 months', 'Consent / legitimate interest (to confirm)'],
              ['IP address (hosting logs)', 'Security', 'GitHub Pages', "Per GitHub's policy", "GitHub's legitimate interest"],
            ]} />
          </Figure>
        </div>
        {sections.map((s, i) => (
          <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="mt-12 scroll-mt-[calc(var(--nav-h)+24px)]">
            <h2 id={`${s.id}-h`} className="flex items-baseline gap-3 text-[length:var(--text-h3)] font-semibold"><span className="font-mono text-[0.7em] text-muted">{i + 1}</span>{s.title}</h2>
            {s.body.map((p) => <p key={p.slice(0, 20)} className="mt-3 text-white/85">{p}</p>)}
          </section>
        ))}
      </div>
    </PageShell>
  );
}
