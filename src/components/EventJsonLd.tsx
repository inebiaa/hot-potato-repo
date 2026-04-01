import { useEffect } from 'react';
import type { Event } from '../lib/supabase';
import { eventJsonLdScriptContent } from '../lib/eventJsonLd';
import { canonicalEventUrl } from '../lib/siteBase';

const SCRIPT_ID = 'secret-blogger-event-jsonld';

interface EventJsonLdProps {
  event: Event;
}

/**
 * Injects a single Event JSON-LD script and updates document title for the event page.
 * Removes script on unmount.
 */
export default function EventJsonLd({ event }: EventJsonLdProps) {
  useEffect(() => {
    const appName = 'Secret Blogger';
    const prevTitle = document.title;
    document.title = `${event.name} | ${appName}`;

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

    return () => {
      document.title = prevTitle;
      document.getElementById(SCRIPT_ID)?.remove();
      document.getElementById(linkId)?.remove();
    };
  }, [event]);

  return null;
}
