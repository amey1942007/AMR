/** /contact form rules (pages-spec §7): the shared field validation + a required topic; mailto builder. */
import { validateAll, type ContactFields, type FieldErrors } from '@/lib/validate';
import { TOPICS } from '@/components/paper/TopicSelect';
import { EMAIL } from '@/lib/content';

export type PageFields = ContactFields & { topic: string };
export type PageErrors = FieldErrors & { topic?: string };
export const MAILTO_BODY_MAX = 1800;

export function validatePage(f: PageFields): PageErrors {
  const out: PageErrors = validateAll({ name: f.name, email: f.email, company: f.company, message: f.message });
  if (!(TOPICS as readonly string[]).includes(f.topic)) out.topic = 'Choose a topic.';
  return out;
}

/** mailto:amey@amrslam.tech?subject=[<topic>] Website enquiry from <name>&body=<message>\n\n<name> · <company> · <email> */
export function buildMailto(f: PageFields): string {
  const sig = `\n\n${[f.name.trim(), f.company.trim(), f.email.trim()].filter(Boolean).join(' · ')}`;
  const body = (f.message.trim().slice(0, Math.max(0, MAILTO_BODY_MAX - sig.length)) + sig).slice(0, MAILTO_BODY_MAX);
  const subject = `[${f.topic}] Website enquiry from ${f.name.trim()}`;
  return `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
