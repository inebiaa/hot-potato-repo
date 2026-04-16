import { useEffect } from 'react';
import type { Event } from '../lib/supabase';
import { eventJsonLdScriptContent } from '../lib/eventJsonLd';
import { buildEventSocialMetaTagSpecs } from '../lib/eventSocialMeta';
import { canonicalEventUrl } from '../lib/siteBase';

const SCRIPT_ID = 'secret-blogger-event-jsonld';
const SOCIAL_META_ATTR = 'data-secret-blogger-event-social';

interface EventJsonLdProps {
  event: Event;
}

/**
 * Injects Event JSON-LD, canonical, Open Graph / Twitter meta, and document title for the event page.
 * Removes injected head nodes on unmount.
 */
export default function EventJsonLd({ event }: EventJsonLdProps) {
  useEffect(() => {
    const appName = 'Secret Blogger';
    const prevTitle = document.title;
    document.title = `${event.name} | ${appName}`;

    document.querySelectorAll(`meta[${SOCIAL_META_ATTR}]`).forEach((el) => el.remove());

    const existing = document.getElementById(SCRIPT_ID);
    if (existing) existing.remove();

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.type = 'application/ld+json';
    script.textContent = eventJsonLdScriptContent(event);
    document.head.appendChild(script);

    const linkId = 'secret-blogger-event-canonical';
    let link = document.querySelector<HTMLLinkElement>(`link#${linkId}`);
    if (!link) {
      link = document.createElement('link');
      link.id = linkId;
      link.rel = 'canonical';
      document.head.appendChild(link);
    }
    link.href = canonicalEventUrl(event.id);

    for (const spec of buildEventSocialMetaTagSpecs(event)) {
      const meta = document.createElement('meta');
      meta.setAttribute(SOCIAL_META_ATTR, '');
      if (spec.kind === 'property') {
        meta.setAttribute('property', spec.key);
      } else {
        meta.setAttribute('name', spec.key);
      }
      meta.setAttribute('content', spec.content);
      document.head.appendChild(meta);
    }

    return () => {
      document.title = prevTitle;
      document.getElementById(SCRIPT_ID)?.remove();
      document.getElementById(linkId)?.remove();
      document.querySelectorAll(`meta[${SOCIAL_META_ATTR}]`).forEach((el) => el.remove());
    };
  }, [event]);

  return null;
}
