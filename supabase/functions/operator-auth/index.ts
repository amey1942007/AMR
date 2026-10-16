/**
 * Invite-only operator auth helper. The website no longer calls this function.
 *
 * Username claim is disabled: passwords are set from the invite/recovery email
 * on /set-password, then mark_password_set(). This source matches the deployed
 * claim response (403 claim_disabled) and does not read or write authority_rank.
 * Do not redeploy from this change unless Review & Debugger asks.
 *
 * POST JSON:
 *   { action: "status", username }
 *   { action: "email", username }
 *   { action: "claim", ... }  → 403, no database write
 *
 * verify_jwt=false — status/email are still gated by the allowlist.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function normUser(u: unknown): string {
  return String(u ?? "").trim().toLowerCase();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ status: "invalid" }, 405);

  let body: { action?: string; username?: string };
  try {
    body = await req.json();
  } catch {
    return json({ status: "invalid" }, 400);
  }

  if ((body.action ?? "status") === "claim") {
    return json({ status: "invalid", reason: "claim_disabled" }, 403);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !service) return json({ status: "unavailable" }, 503);

  const username = normUser(body.username);
  if (!username || !/^[a-z][a-z0-9_]{1,31}$/.test(username)) {
    return json({ status: "invalid" });
  }

  const admin = createClient(url, service, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: row, error } = await admin
    .from("permitted_operators")
    .select("username, auth_email, user_id, password_set")
    .eq("username", username)
    .maybeSingle();

  if (error) return json({ status: "network" }, 500);
  if (!row) return json({ status: "invalid" });

  const action = body.action ?? "status";

  if (action === "status") {
    return json({
      status: "ok",
      username: row.username,
      needsPassword: !row.password_set,
    });
  }

  if (action === "email") {
    return json({ status: "ok", email: row.auth_email, needsPassword: !row.password_set });
  }

  return json({ status: "invalid" }, 400);
});
