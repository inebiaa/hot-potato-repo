import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const BUCKET = "event-images";
const MARKER = `/storage/v1/object/public/${BUCKET}/`;
const RUN_TOKEN = Deno.env.get("RECOMPRESS_TOKEN") ?? "sb-recompress-augl6-9k2m";

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

function pathFromImageUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const idx = u.pathname.indexOf(MARKER);
    if (idx === -1) return null;
    return decodeURIComponent(u.pathname.slice(idx + MARKER.length)) || null;
  } catch {
    return null;
  }
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
    const dryRun = Boolean(body?.dryRun);
    const requested = Array.isArray(body?.paths)
      ? body.paths.map((p: unknown) => String(p || "").trim()).filter(Boolean)
      : [];

    if (!requested.length) {
      return json({ error: "Missing paths array" }, 400);
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const referenced = new Set<string>();
    const pageSize = 1000;
    let from = 0;
    for (;;) {
      const { data, error } = await supabase
        .from("events")
        .select("image_url")
        .not("image_url", "is", null)
        .neq("image_url", "")
        .range(from, from + pageSize - 1);
      if (error) return json({ error: error.message }, 500);
      if (!data?.length) break;
      for (const row of data) {
        const path = pathFromImageUrl(String(row.image_url || "").trim());
        if (path) referenced.add(path);
      }
      if (data.length < pageSize) break;
      from += pageSize;
    }

    const orphans = requested.filter((path) => !referenced.has(path));
    const skipped = requested.filter((path) => referenced.has(path));

    if (!orphans.length) {
      return json({ deleted: 0, skipped: skipped.length, orphans: [], dryRun });
    }

    if (dryRun) {
      return json({
        deleted: 0,
        wouldDelete: orphans.length,
        skipped: skipped.length,
        orphans,
        dryRun: true,
      });
    }

    const deleted: string[] = [];
    const errors: { path: string; reason: string }[] = [];
    for (let i = 0; i < orphans.length; i += 100) {
      const chunk = orphans.slice(i, i + 100);
      const { error: removeError } = await supabase.storage.from(BUCKET).remove(
        chunk,
      );
      if (removeError) {
        for (const path of chunk) {
          errors.push({ path, reason: removeError.message });
        }
      } else {
        deleted.push(...chunk);
      }
    }

    return json({
      referenced: referenced.size,
      deleted: deleted.length,
      skipped: skipped.length,
      errors: errors.length,
      deletedPaths: deleted,
      errorDetails: errors.slice(0, 20),
      dryRun: false,
    });
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
});
