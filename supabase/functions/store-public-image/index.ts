import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { encodeEventCardJpeg } from "../_shared/compressImage.ts";
import {
  isOurPublicImageUrl,
  keyFromPublicUrl,
  pairedCardKey,
  r2DeleteKeyAndCard,
  r2Put,
} from "../_shared/r2.ts";

const MAX_BYTES = 5 * 1024 * 1024;
const KINDS = new Set([
  "event",
  "profile",
  "profile-cover",
  "list-cover",
  "branding",
]);
const BRAND_SLOTS = new Set(["icon", "logo", "favicon", "misc"]);

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-image-kind, x-brand-slot",
  "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
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

function ownerCanDelete(key: string, userId: string): boolean {
  return (
    key.startsWith(`event/${userId}/`) ||
    key.startsWith(`profile/${userId}/`) ||
    key.startsWith(`list/${userId}/`)
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return json({ error: "Sign in to manage photos." }, 401);
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
    return json({ error: "Sign in to manage photos." }, 401);
  }

  if (req.method === "DELETE") {
    let url = "";
    try {
      const body = await req.json();
      url = String(body?.url ?? "").trim();
    } catch {
      return json({ error: "Invalid request body" }, 400);
    }
    if (!url || !isOurPublicImageUrl(url)) {
      return json({ ok: true });
    }
    const key = keyFromPublicUrl(url);
    if (!key) return json({ ok: true });

    const { data: isAdmin } = await supabase.rpc("is_admin", {
      check_user_id: user.id,
    });
    if (!isAdmin && !ownerCanDelete(key, user.id)) {
      return json({ error: "Not allowed to delete that image." }, 403);
    }
    try {
      await r2DeleteKeyAndCard(key);
    } catch (err) {
      return json(
        { error: err instanceof Error ? err.message : "Delete failed." },
        500,
      );
    }
    return json({ ok: true });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const kind = (req.headers.get("x-image-kind") || "").trim().toLowerCase();
  if (!KINDS.has(kind)) {
    return json({ error: "Missing or invalid x-image-kind." }, 400);
  }

  if (kind === "branding") {
    const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin", {
      check_user_id: user.id,
    });
    if (adminError || !isAdmin) {
      return json({ error: "Admin access required." }, 403);
    }
  }

  const contentType = (req.headers.get("content-type") || "image/jpeg")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (!contentType.startsWith("image/") && !contentType.includes("icon")) {
    return json({ error: "Choose an image file." }, 400);
  }

  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.byteLength === 0) return json({ error: "Image was empty." }, 400);
  if (bytes.byteLength > MAX_BYTES) {
    return json({ error: "Image is larger than 5 MB." }, 400);
  }

  const ext = extForContentType(contentType);
  const id = crypto.randomUUID();
  let key: string;
  if (kind === "event") {
    key = `event/${user.id}/${id}.jpg`;
  } else if (kind === "profile") {
    key = `profile/${user.id}/${id}.jpg`;
  } else if (kind === "profile-cover") {
    key = `profile/${user.id}/cover-${id}.jpg`;
  } else if (kind === "list-cover") {
    key = `list/${user.id}/${id}.jpg`;
  } else {
    const slotRaw = (req.headers.get("x-brand-slot") || "misc").trim().toLowerCase();
    const slot = BRAND_SLOTS.has(slotRaw) ? slotRaw : "misc";
    key = `brand/${slot}/${id}.${ext}`;
  }

  try {
    const uploadType = kind === "branding" ? contentType : "image/jpeg";
    const publicUrl = await r2Put(key, bytes, uploadType);
    if (kind === "event") {
      const card = await encodeEventCardJpeg(bytes);
      const cardBytes = card?.bytes ?? bytes;
      const cardType = card?.contentType ?? uploadType;
      await r2Put(pairedCardKey(key), cardBytes, cardType);
    }
    return json({ url: publicUrl });
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : "Upload to CDN failed." },
      500,
    );
  }
});
