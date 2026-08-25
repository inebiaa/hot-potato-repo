import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

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

function profileImagePathFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const marker = "/storage/v1/object/public/profile-images/";
    const idx = u.pathname.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(u.pathname.slice(idx + marker.length)) || null;
  } catch {
    return null;
  }
}

function listCoverPathFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const marker = "/storage/v1/object/public/list-covers/";
    const idx = u.pathname.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(u.pathname.slice(idx + marker.length)) || null;
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

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return json({ error: "Sign in to delete your account." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return json({ error: "Server misconfigured" }, 500);
  }

  let password = "";
  try {
    const body = await req.json();
    password = String(body?.password ?? "");
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }
  if (!password) {
    return json({ error: "Password is required." }, 400);
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();
  if (userError || !user?.id || !user.email) {
    return json({ error: "Sign in to delete your account." }, 401);
  }

  const email = user.email.trim().toLowerCase();
  const { error: signInError } = await userClient.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) {
    return json({ error: "Incorrect password." }, 403);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: profile, error: profileError } = await admin
    .from("user_profiles")
    .select("username, avatar_url, cover_image_url")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profileError) {
    return json({ error: profileError.message || "Could not load profile." }, 500);
  }

  const displayName = (profile?.username || "").trim() || "Unknown User";

  const { error: ratingsError } = await admin
    .from("ratings")
    .update({ author_display_name: displayName })
    .eq("user_id", user.id);
  if (ratingsError) {
    return json({ error: ratingsError.message || "Could not preserve reviews." }, 500);
  }

  const { data: lists, error: listsError } = await admin
    .from("user_lists")
    .select("id, cover_image_url")
    .eq("user_id", user.id);
  if (listsError) {
    return json({ error: listsError.message || "Could not load lists." }, 500);
  }

  const coverPaths: string[] = [];
  for (const row of lists || []) {
    const path = listCoverPathFromUrl(String(row.cover_image_url || ""));
    if (path) coverPaths.push(path);
  }
  if (coverPaths.length > 0) {
    await admin.storage.from("list-covers").remove(coverPaths);
  }

  const profilePaths: string[] = [];
  const avatarPath = profileImagePathFromUrl(String(profile?.avatar_url || ""));
  const coverPath = profileImagePathFromUrl(String(profile?.cover_image_url || ""));
  if (avatarPath) profilePaths.push(avatarPath);
  if (coverPath) profilePaths.push(coverPath);
  if (profilePaths.length > 0) {
    await admin.storage.from("profile-images").remove(profilePaths);
  }

  const { error: deleteListsError } = await admin
    .from("user_lists")
    .delete()
    .eq("user_id", user.id);
  if (deleteListsError) {
    return json({ error: deleteListsError.message || "Could not delete lists." }, 500);
  }

  await admin.from("user_blocks").delete().or(
    `blocker_id.eq.${user.id},blocked_id.eq.${user.id}`,
  );

  const { error: deleteProfileError } = await admin
    .from("user_profiles")
    .delete()
    .eq("user_id", user.id);
  if (deleteProfileError) {
    return json({ error: deleteProfileError.message || "Could not delete profile." }, 500);
  }

  const { error: deleteAuthError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteAuthError) {
    return json({ error: deleteAuthError.message || "Could not delete account." }, 500);
  }

  return json({ ok: true });
});
