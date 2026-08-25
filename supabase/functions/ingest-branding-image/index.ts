import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { isOurPublicImageUrl, r2Put } from "../_shared/r2.ts";

const MAX_BYTES = 5 * 1024 * 1024;
const SLOTS = new Set(["icon", "logo", "favicon", "misc"]);

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
  if (ct.includes("icon")) return "ico";
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
    return json({ error: "Sign in to save a branding image." }, 401);
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
    return json({ error: "Sign in to save a branding image." }, 401);
  }

  const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin", {
    check_user_id: user.id,
  });
  if (adminError || !isAdmin) {
    return json({ error: "Admin access required." }, 403);
  }

  let sourceUrl: string;
  let slot = "misc";
  try {
    const body = await req.json();
    sourceUrl = String(body?.url ?? "").trim();
    const rawSlot = String(body?.slot ?? "misc").trim().toLowerCase();
    if (SLOTS.has(rawSlot)) slot = rawSlot;
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

  if (isOurPublicImageUrl(sourceUrl)) {
    return json({ url: sourceUrl });
  }

  let upstream: Response;
  try {
    upstream = await fetch(sourceUrl, {
      redirect: "follow",
      headers: {
        Accept: "image/*,*/*;q=0.8",
        "User-Agent": "SecretBloggerBrandingImageIngest/1.0",
      },
    });
  } catch {
    return json({ error: "Could not download that image URL." }, 400);
  }

  if (!upstream.ok) {
    return json({ error: `Image URL returned ${upstream.status}.` }, 400);
  }

  const contentType = (upstream.headers.get("content-type") || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  const allowed = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/x-icon",
    "image/vnd.microsoft.icon",
  ];
  if (!contentType.startsWith("image/") && contentType !== "application/octet-stream") {
    return json({ error: "URL did not return an image." }, 400);
  }

  const bytes = new Uint8Array(await upstream.arrayBuffer());
  if (bytes.byteLength === 0) {
    return json({ error: "Image was empty." }, 400);
  }
  if (bytes.byteLength > MAX_BYTES) {
    return json({ error: "Image is larger than 5 MB." }, 400);
  }

  let finalType = contentType.startsWith("image/") ? contentType : "image/jpeg";
  if (!allowed.includes(finalType) && finalType !== "application/octet-stream") {
    return json({ error: "Unsupported image type." }, 400);
  }
  if (finalType === "application/octet-stream") {
    finalType = "image/png";
  }

  const ext = extForContentType(finalType);
  const key = `brand/${slot}/${crypto.randomUUID()}.${ext}`;

  try {
    const publicUrl = await r2Put(key, bytes, finalType);
    return json({ url: publicUrl });
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : "Upload to CDN failed." },
      500,
    );
  }
});
