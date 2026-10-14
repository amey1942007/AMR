/** <title>/<desc> for an inline SVG, wired via aria-labelledby. Ids are a stable hash of the text (SSR-safe). */
const hash = (s: string) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h.toString(36); };
export function svgA11y(title: string, desc: string, salt = '') {
  const id = `svg-${hash(title + desc + salt)}`;
  return {
    props: { role: 'img' as const, 'aria-labelledby': `${id}-t ${id}-d` },
    nodes: (<><title id={`${id}-t`}>{title}</title><desc id={`${id}-d`}>{desc}</desc></>),
  };
}
