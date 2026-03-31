/**
 * Normalize user-entered URL for safe opening in a new tab (http/https only).
 * Empty input returns null. Missing scheme gets https:// prepended.
 */
export function normalizeExternalUrl(raw: string | null | undefined): string | null {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return null;
  const withScheme = /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    throw new Error('Enter a valid URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http and https links are allowed');
  }
  return parsed.href;
}

/** Safe parse for display/click; returns null if invalid or empty (no throw). */
export function tryNormalizeExternalUrl(raw: string | null | undefined): string | null {
  try {
    return normalizeExternalUrl(raw);
  } catch {
    return null;
  }
}
