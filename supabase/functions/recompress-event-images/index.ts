import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const BUCKET = "event-images";
const MARKER = `/storage/v1/object/public/${BUCKET}/`;
const MAX_EDGE_PX = 1200;
const JPEG_QUALITY = 82;
const DEFAULT_LIMIT = 15;
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

async function compressEventPhoto(
  bytes: Uint8Array,
): Promise<{ bytes: Uint8Array; contentType: string; ext: string } | null> {
  try {
    const { Image } = await import("npm:imagescript@1.3.0");
    const image = await Image.decode(bytes);
    const maxEdge = Math.max(image.width, image.height);
    if (maxEdge > MAX_EDGE_PX) {
      if (image.width >= image.height) {
        image.resize(MAX_EDGE_PX, Image.RESIZE_AUTO);
      } else {
        image.resize(Image.RESIZE_AUTO, MAX_EDGE_PX);
      }
    }
    const encoded = await image.encodeJPEG(JPEG_QUALITY);
    if (!encoded.byteLength) return null;
    if (maxEdge <= MAX_EDGE_PX && encoded.byteLength >= bytes.byteLength) {
      return null;
    }
    return { bytes: encoded, contentType: "image/jpeg", ext: "jpg" };
  } catch (err) {
    console.error("compress failed", err);
    return null;
  }
}

function storagePathFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const idx = u.pathname.indexOf(MARKER);
    if (idx === -1) return null;
    const path = decodeURIComponent(u.pathname.slice(idx + MARKER.length));
    return path || null;
  } catch {
    return null;
  }
}

type UrlItem = { url: string; eventIds: string[] };

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
    const runToken = String(body?.token ?? "");
    if (runToken !== RUN_TOKEN) {
      return json({ error: "Unauthorized" }, 401);
    }

    const offset = Math.max(0, Number(body?.offset ?? 0) || 0);
    const limit = Math.max(
      1,
      Math.min(30, Number(body?.limit ?? DEFAULT_LIMIT) || DEFAULT_LIMIT),
    );
    const dryRun = Boolean(body?.dryRun);

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const byUrl = new Map<string, UrlItem>();
    const pageSize = 1000;
    let from = 0;
    for (;;) {
      const { data, error } = await supabase
        .from("events")
        .select("id, image_url")
        .not("image_url", "is", null)
        .neq("image_url", "")
        .order("created_at", { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) return json({ error: error.message }, 500);
      if (!data?.length) break;
      for (const row of data) {
        const url = String(row.image_url || "").trim();
        if (!url.includes(MARKER)) continue;
        const existing = byUrl.get(url);
        if (existing) existing.eventIds.push(row.id);
        else byUrl.set(url, { url, eventIds: [row.id] });
      }
      if (data.length < pageSize) break;
      from += pageSize;
    }

    const all = [...byUrl.values()];
    const batch = all.slice(offset, offset + limit);
    const results: Record<string, unknown>[] = [];

    for (const item of batch) {
      try {
        const path = storagePathFromUrl(item.url);
        if (!path) {
          results.push({ url: item.url, status: "skip", reason: "not-stored" });
          continue;
        }

        const res = await fetch(item.url, { redirect: "follow" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const original = new Uint8Array(await res.arrayBuffer());
        if (!original.byteLength) throw new Error("empty");

        const compressed = await compressEventPhoto(original);
        if (!compressed) {
          results.push({
            url: item.url,
            status: "skip",
            reason: "no-savings",
            bytes: original.byteLength,
          });
          continue;
        }

        if (dryRun) {
          results.push({
            url: item.url,
            status: "dry-run",
            from: original.byteLength,
            to: compressed.bytes.byteLength,
          });
          continue;
        }

        const alreadyJpeg = /\.jpe?g$/i.test(path);
        const nextPath = alreadyJpeg
          ? path
          : `${path.replace(/\.[^./]+$/, "")}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(nextPath, compressed.bytes, {
            contentType: "image/jpeg",
            upsert: true,
            cacheControl: "31536000",
          });
        if (uploadError) {
          throw new Error(uploadError.message || "upload failed");
        }

        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(
          nextPath,
        );
        const publicUrl = pub?.publicUrl;
        if (!publicUrl) throw new Error("no public url");

        if (publicUrl !== item.url) {
          const { error: updateError } = await supabase
            .from("events")
            .update({ image_url: publicUrl })
            .eq("image_url", item.url);
          if (updateError) {
            throw new Error(updateError.message || "db update failed");
          }
        }

        results.push({
          url: item.url,
          status: "ok",
          path: nextPath,
          from: original.byteLength,
          to: compressed.bytes.byteLength,
          events: item.eventIds.length,
        });
      } catch (err) {
        results.push({
          url: item.url,
          status: "error",
          reason: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const ok = results.filter((r) => r.status === "ok");
    const saved = ok.reduce(
      (sum, r) => sum + Math.max(0, Number(r.from || 0) - Number(r.to || 0)),
      0,
    );

    return json({
      total: all.length,
      offset,
      limit,
      processed: batch.length,
      nextOffset: offset + batch.length < all.length
        ? offset + batch.length
        : null,
      dryRun,
      ok: ok.length,
      skip: results.filter((r) =>
        r.status === "skip" || r.status === "dry-run"
      ).length,
      error: results.filter((r) => r.status === "error").length,
      savedBytes: saved,
      results,
    });
  } catch (err) {
    console.error("recompress fatal", err);
    return json(
      { error: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
});
