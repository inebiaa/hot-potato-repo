import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const BUCKET = "event-images";
const RUN_TOKEN = "sb-recompress-augl6-9k2m";

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

function decodeBase64(data: string): Uint8Array {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!serviceKey || !supabaseUrl) {
      return json({ error: "Server misconfigured" }, 500);
    }

    const body = await req.json().catch(() => ({}));
    if (String(body?.token ?? "") !== RUN_TOKEN) {
      return json({ error: "Unauthorized" }, 401);
    }

    const oldUrl = String(body?.oldUrl ?? "").trim();
    const storagePath = String(body?.storagePath ?? "").trim();
    const jpegBase64 = String(body?.jpegBase64 ?? "");
    if (!oldUrl || !storagePath || !jpegBase64) {
      return json({ error: "Missing oldUrl, storagePath, or jpegBase64" }, 400);
    }

    const bytes = decodeBase64(jpegBase64);
    if (!bytes.byteLength) return json({ error: "Empty image" }, 400);

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, bytes, {
        contentType: "image/jpeg",
        upsert: true,
        cacheControl: "31536000",
      });
    if (uploadError) {
      return json({ error: uploadError.message || "upload failed" }, 400);
    }

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    const publicUrl = pub?.publicUrl;
    if (!publicUrl) return json({ error: "no public url" }, 500);

    if (publicUrl !== oldUrl) {
      const { error: updateError } = await supabase
        .from("events")
        .update({ image_url: publicUrl })
        .eq("image_url", oldUrl);
      if (updateError) {
        return json({ error: updateError.message || "db update failed" }, 400);
      }
    }

    return json({
      ok: true,
      oldUrl,
      publicUrl,
      bytes: bytes.byteLength,
      storagePath,
    });
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
});
