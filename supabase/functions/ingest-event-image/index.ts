import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const BUCKET = "event-images";
const MAX_BYTES = 5 * 1024 * 1024;

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function extForContentType(ct: string): string {
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("gif")) return "gif";
  return "jpg";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return json({ error: "Sign in to save a photo from a URL." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) {
    return json({ error: "Server misconfigured" }, 500);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return json({ error: "Sign in to save a photo from a URL." }, 401);
  }

  let sourceUrl: string;
  try {
    const body = await req.json();
    sourceUrl = String(body?.url ?? "").trim();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  let parsed: URL;
  try {
    parsed = new URL(sourceUrl);
  } catch {
    return json({ error: "Invalid image URL" }, 400);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return json({ error: "Image URL must be http or https" }, 400);
  }

  // Already our public object — nothing to ingest.
  if (parsed.pathname.includes(`/storage/v1/object/public/${BUCKET}/`)) {
    return json({ url: sourceUrl });
  }

  let upstream: Response;
  try {
    upstream = await fetch(sourceUrl, {
      redirect: "follow",
      headers: {
        Accept: "image/*,*/*;q=0.8",
        "User-Agent": "SecretBloggerEventImageIngest/1.0",
      },
    });
  } catch {
    return json({ error: "Could not download that image URL." }, 400);
  }

  if (!upstream.ok) {
    return json(
      { error: `Image URL returned ${upstream.status}.` },
      400,
    );
  }

  const contentType = (upstream.headers.get("content-type") || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (!contentType.startsWith("image/")) {
    return json({ error: "URL did not return an image." }, 400);
  }
  if (
    !["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]
      .includes(contentType)
  ) {
    return json({ error: "Unsupported image type." }, 400);
  }

  const bytes = new Uint8Array(await upstream.arrayBuffer());
  if (bytes.byteLength === 0) {
    return json({ error: "Image was empty." }, 400);
  }
  if (bytes.byteLength > MAX_BYTES) {
    return json({ error: "Image is larger than 5 MB." }, 400);
  }

  const ext = extForContentType(contentType);
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, {
      contentType,
      upsert: false,
      cacheControl: "31536000",
    });

  if (uploadError) {
    return json(
      { error: uploadError.message || "Upload to storage failed." },
      400,
    );
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) {
    return json({ error: "Upload succeeded but no public URL." }, 500);
  }

  return json({ url: data.publicUrl });
});
