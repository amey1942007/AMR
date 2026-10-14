import NextLink from 'next/link';
import type { ComponentProps } from 'react';
/**
 * Review home-r4 #6: in a static export, Next's viewport prefetch first sends a HEAD to the target URL (to detect
 * redirects) and then fetches the RSC tree, for every link that scrolls into view (the 4 HEAD requests on home).
 * Links default to prefetch={false}: navigation stays client-side, pages are tiny, and no speculative requests.
 */
export default function Link(props: ComponentProps<typeof NextLink>) {
  return <NextLink prefetch={false} {...props} />;
}
