import type { Event } from './eventTypes';
import { eventAbsoluteImageUrl } from './eventJsonLd';
import { canonicalEventUrl } from './siteBase';
import { formatEventDateDisplay } from './formatEventDate';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeHtmlAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function venueLine(event: Event): string {
  const bits = [event.location?.trim(), event.city?.trim()].filter(Boolean);
  return bits.join(' · ');
}

export function buildEventEmailPlainText(event: Event): string {
  const url = canonicalEventUrl(event.id);
  const lines: string[] = [event.name, ''];
  if (event.date?.trim()) {
    lines.push(formatEventDateDisplay(event.date.trim()));
  }
  const v = venueLine(event);
  if (v) lines.push(v);
  const addr =
    (event.formatted_address && event.formatted_address.trim()) ||
    (event.address && event.address.trim()) ||
    '';
  if (addr) lines.push(addr.replace(/\r\n/g, '\n'));
  if (event.description?.trim()) {
    lines.push('');
    lines.push(event.description.trim());
  }
  const ticket = event.countdown_link?.trim();
  if (ticket && (ticket.startsWith('http://') || ticket.startsWith('https://'))) {
    lines.push('');
    lines.push(`Tickets / info: ${ticket}`);
  }
  lines.push('');
  lines.push(`View on Secret Blogger: ${url}`);
  return lines.join('\n');
}

/**
 * Compact table + inline CSS for pasting into rich email clients (Gmail, Outlook web, etc.).
 */
export function buildEventEmailRichHtml(event: Event): string {
  const url = canonicalEventUrl(event.id);
  const title = escapeHtml(event.name);
  const dateStr = event.date?.trim() ? escapeHtml(formatEventDateDisplay(event.date.trim())) : '';
  const venue = escapeHtml(venueLine(event));
  const imgAbs = eventAbsoluteImageUrl(event.image_url);
  const imgUrl = imgAbs ? escapeHtmlAttr(imgAbs) : '';

  const rows: string[] = [];
  if (imgUrl) {
    rows.push(
      `<tr><td style="padding:0 0 12px 0;"><a href="${escapeHtmlAttr(url)}" style="text-decoration:none;"><img src="${imgUrl}" alt="${title}" width="560" style="max-width:100%;height:auto;border-radius:8px;display:block;border:0;" /></a></td></tr>`
    );
  }
  rows.push(
    `<tr><td style="font-family:Georgia,serif;font-size:22px;font-weight:bold;color:#111827;padding:0 0 8px 0;line-height:1.3;"><a href="${escapeHtmlAttr(url)}" style="color:#111827;text-decoration:none;">${title}</a></td></tr>`
  );
  if (dateStr) {
    rows.push(
      `<tr><td style="font-family:system-ui,-apple-system,sans-serif;font-size:15px;color:#4b5563;padding:0 0 4px 0;">${dateStr}</td></tr>`
    );
  }
  if (venue) {
    rows.push(
      `<tr><td style="font-family:system-ui,-apple-system,sans-serif;font-size:15px;color:#4b5563;padding:0 0 16px 0;">${venue}</td></tr>`
    );
  }
  rows.push(
    `<tr><td style="padding:0;"><a href="${escapeHtmlAttr(url)}" style="display:inline-block;font-family:system-ui,-apple-system,sans-serif;font-size:15px;font-weight:600;color:#ffffff;background:#111827;text-decoration:none;padding:10px 18px;border-radius:6px;">View event</a></td></tr>`
  );

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;border:1px solid #e5e7eb;border-radius:10px;padding:16px;background:#ffffff;">${rows.join('')}</table>`;
}
