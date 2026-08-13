import { useEffect } from 'react';
import { appName } from '../lib/brandMeta';
import { SITE_SOCIAL_ATTR } from '../lib/eventSocialMeta';
import {
  LIST_SOCIAL_ATTR,
  buildListSocialMetaTagSpecs,
  listJsonLdScriptContent,
  type ListSharePayload,
} from '../lib/listSocialMeta';
import { canonicalListUrl } from '../lib/siteBase';

const SCRIPT_ID = 'secret-blogger-list-jsonld';

interface ListSocialMetaProps {
  list: ListSharePayload;
}

/**
 * Injects CollectionPage JSON-LD, canonical, Open Graph meta, and document title for a shared list.
 * Parks homepage OG tags while mounted so scrapers don't see the site brand image first.
 */
export default function ListSocialMeta({ list }: ListSocialMetaProps) {
  useEffect(() => {
    const prevTitle = document.title;
    const title = list.title.trim() || 'Shared list';
    document.title = `${title} | ${appName()}`;

    document.querySelectorAll(`meta[${LIST_SOCIAL_ATTR}]`).forEach((el) => el.remove());

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
    script.textContent = listJsonLdScriptContent(list);
    document.head.appendChild(script);

    const linkId = 'secret-blogger-list-canonical';
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
    const handle = (list.ownerHandle || '').trim();
    link.href = handle ? canonicalListUrl(handle, list.id) : `${window.location.origin}/list/${list.id}`;

    for (const spec of buildListSocialMetaTagSpecs(list)) {
      const meta = document.createElement('meta');
      meta.setAttribute(LIST_SOCIAL_ATTR, '');
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
      document.querySelectorAll(`meta[${LIST_SOCIAL_ATTR}]`).forEach((el) => el.remove());
      for (const node of parkedSiteSocial) document.head.appendChild(node);
      if (parkedHomeCanonical) document.head.appendChild(parkedHomeCanonical);
    };
  }, [list]);

  return null;
}
