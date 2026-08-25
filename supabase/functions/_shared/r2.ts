import { AwsClient } from "npm:aws4fetch@1.0.20";

export const IMAGE_CACHE_CONTROL = "public, max-age=31536000, immutable";

type R2Config = {
  aws: AwsClient;
  endpoint: string;
  publicBase: string;
};

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim() || "";
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

function r2Config(): R2Config {
  const accountId = requiredEnv("R2_ACCOUNT_ID");
  const accessKeyId = requiredEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = requiredEnv("R2_SECRET_ACCESS_KEY");
  const bucket = requiredEnv("R2_BUCKET_NAME");
  const publicBase = requiredEnv("R2_PUBLIC_BASE_URL").replace(/\/$/, "");
  const aws = new AwsClient({
    accessKeyId,
    secretAccessKey,
    region: "auto",
    service: "s3",
  });
  return {
    aws,
    endpoint: `https://${accountId}.r2.cloudflarestorage.com/${bucket}`,
    publicBase,
  };
}

function objectUrl(endpoint: string, key: string): string {
  return `${endpoint}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export function publicUrlForKey(key: string, publicBase?: string): string {
  const base = (publicBase || r2Config().publicBase).replace(/\/$/, "");
  return `${base}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export function isOurPublicImageUrl(url: string): boolean {
  try {
    const base = requiredEnv("R2_PUBLIC_BASE_URL").replace(/\/$/, "");
    return new URL(url).hostname === new URL(base).hostname;
  } catch {
    return false;
  }
}

export function keyFromPublicUrl(url: string): string | null {
  if (!isOurPublicImageUrl(url)) return null;
  try {
    const path = decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));
    return path || null;
  } catch {
    return null;
  }
}

export function pairedCardKey(fullKey: string): string {
  if (/\.card\.[a-z0-9]+$/i.test(fullKey)) return fullKey;
  if (/\.[a-z0-9]+$/i.test(fullKey)) {
    return fullKey.replace(/(\.[a-z0-9]+)$/i, ".card$1");
  }
  return `${fullKey}.card.jpg`;
}

export async function r2Put(
  key: string,
  body: Uint8Array | ArrayBuffer,
  contentType: string,
): Promise<string> {
  const { aws, endpoint, publicBase } = r2Config();
  const res = await aws.fetch(objectUrl(endpoint, key), {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      "Cache-Control": IMAGE_CACHE_CONTROL,
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`R2 put failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return publicUrlForKey(key, publicBase);
}

export async function r2Delete(key: string): Promise<void> {
  const { aws, endpoint } = r2Config();
  const res = await aws.fetch(objectUrl(endpoint, key), { method: "DELETE" });
  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => "");
    throw new Error(`R2 delete failed (${res.status}): ${text.slice(0, 200)}`);
  }
}

export async function r2DeleteKeyAndCard(key: string): Promise<void> {
  const card = pairedCardKey(key);
  await r2Delete(key);
  if (card !== key) await r2Delete(card);
}
