import { AwsClient } from 'aws4fetch';

export const IMAGE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

function requiredEnv(name) {
  const value = (process.env[name] || '').trim();
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export function r2PublicBase() {
  return requiredEnv('R2_PUBLIC_BASE_URL').replace(/\/$/, '');
}

export function isCdnUrl(url) {
  try {
    return new URL(url).hostname === new URL(r2PublicBase()).hostname;
  } catch {
    return false;
  }
}

function r2Client() {
  const accountId = requiredEnv('R2_ACCOUNT_ID');
  const bucket = requiredEnv('R2_BUCKET_NAME');
  const aws = new AwsClient({
    accessKeyId: requiredEnv('R2_ACCESS_KEY_ID'),
    secretAccessKey: requiredEnv('R2_SECRET_ACCESS_KEY'),
    region: 'auto',
    service: 's3',
  });
  return {
    aws,
    endpoint: `https://${accountId}.r2.cloudflarestorage.com/${bucket}`,
    publicBase: r2PublicBase(),
  };
}

function objectUrl(endpoint, key) {
  return `${endpoint}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

export function publicUrlForKey(key) {
  return `${r2PublicBase()}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

export function pairedCardKey(fullKey) {
  if (/\.card\.[a-z0-9]+$/i.test(fullKey)) return fullKey;
  if (/\.[a-z0-9]+$/i.test(fullKey)) return fullKey.replace(/(\.[a-z0-9]+)$/i, '.card$1');
  return `${fullKey}.card.jpg`;
}

export async function r2Put(key, body, contentType) {
  const { aws, endpoint, publicBase } = r2Client();
  const res = await aws.fetch(objectUrl(endpoint, key), {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'Cache-Control': IMAGE_CACHE_CONTROL,
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`R2 put failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return `${publicBase}/${key.split('/').map(encodeURIComponent).join('/')}`;
}
