import { useEffect } from 'react';
import { overridesFromSettings, t as copyT } from '../copy';
import {
  brandShareImageUrl,
  setRuntimeBrandShareImage,
  syncSiteSocialOgDescriptionInDocument,
  syncSiteSocialOgImageInDocument,
} from '../lib/brandSocial';
import type { AppSettings } from '../types/appSettings';

/** Favicon + Open Graph tags from branding settings. */
export function useAppDocumentMeta(appSettings: AppSettings | null | undefined) {
  useEffect(() => {
    if (appSettings?.app_favicon_url) {
      const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
      if (link) link.href = appSettings.app_favicon_url;
    }
  }, [appSettings?.app_favicon_url]);

  useEffect(() => {
    if (!appSettings) return;
    const image = brandShareImageUrl(appSettings);
    setRuntimeBrandShareImage(image);
    syncSiteSocialOgImageInDocument(image, appSettings.app_name || 'Secret Blogger');
    syncSiteSocialOgDescriptionInDocument(
      copyT('home.subtitleSignedIn', overridesFromSettings(appSettings)),
    );
  }, [appSettings]);
}
