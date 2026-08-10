import { useEffect } from 'react';
import type { Event } from '../lib/supabase';
import { eventJsonLdScriptContent } from '../lib/eventJsonLd';
import {
  EVENT_SOCIAL_ATTR,
  SITE_SOCIAL_ATTR,
  buildEventSocialMetaTagSpecs,
} from '../lib/eventSocialMeta';
import { canonicalEventUrl } from '../lib/siteBase';
import { appName } from '../lib/brandMeta';

const SCRIPT_ID = 'secret-blogger-event-jsonld';

interface EventJsonLdProps {
  event: Event;
}

/**
 * Injects Event JSON-LD, canonical, Open Graph meta, and document title for the event page.
 * Removes homepage OG tags while mounted so scrapers don't see the site brand image first.
 */
export default function EventJsonLd({ event }: EventJsonLdProps) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = `${event.name} | ${appName()}`;

    document.querySelectorAll(`meta[${EVENT_SOCIAL_ATTR}]`).forEach((el) => el.remove());

    const parkedSiteSocial: Node[] = [];
    document.querySelectorAll(`meta[${SITE_SOCIAL_ATTR}]`).forEach((el) => {
      parkedSiteSocial.push(el.cloneNode(true));
      el.remove();
    });

    const existing = document.getElementById(SCRIPT_ID);
    if (existing) existing.remove();

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.type = 'application/ld+json';
    script.textContent = eventJsonLdScriptContent(event);
    document.head.appendChild(script);

    const linkId = 'secret-blogger-event-canonical';
    const homeCanonical = document.querySelector<HTMLLinkElement>(
      `link[rel="canonical"]:not(#${linkId})`,
    );
    let parkedHomeCanonical: Node | null = null;
    if (homeCanonical) {
      parkedHomeCanonical = homeCanonical.cloneNode(true);
      homeCanonical.remove();
    }

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
      meta.setAttribute(EVENT_SOCIAL_ATTR, '');
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
      document.querySelectorAll(`meta[${EVENT_SOCIAL_ATTR}]`).forEach((el) => el.remove());
      for (const node of parkedSiteSocial) document.head.appendChild(node);
      if (parkedHomeCanonical) document.head.appendChild(parkedHomeCanonical);
    };
  }, [event]);

  return null;
}
