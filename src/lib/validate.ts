export interface ContactFields { name: string; email: string; company: string; message: string }
export type FieldErrors = Partial<Record<keyof ContactFields, string>>;
export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export const MESSAGE_MAX = 5000;

export function validateField(field: keyof ContactFields, v: string): string | undefined {
  const t = v.trim();
  switch (field) {
    case 'name':
      if (!t) return 'Please enter your name.';
      if (t.length > 120) return 'Name must be 120 characters or fewer.';
      return;
    case 'email':
      if (t.length > 254 || !EMAIL_RE.test(t)) return 'Enter a valid email address.';
      return;
    case 'company':
      if (t.length > 160) return 'Company must be 160 characters or fewer.';
      return;
    case 'message':
      if (!t) return 'Please write a message.';
      if (t.length > MESSAGE_MAX) return 'Message is too long (5000 max).';
      return;
  }
}

export function validateAll(f: ContactFields): FieldErrors {
  const out: FieldErrors = {};
  (Object.keys(f) as (keyof ContactFields)[]).forEach((k) => {
    const e = validateField(k, f[k]);
    if (e) out[k] = e;
  });
  return out;
}
