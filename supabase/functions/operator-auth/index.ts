/**
 * Invite-only operator auth (no public signup).
 *
 * POST JSON:
 *   { action: "status", username }
 *   { action: "claim", username, password }   // first-time set password
 *   { action: "email", username }             // resolve auth email for sign-in
 *
 * verify_jwt=false — gated by permitted_operators allowlist + rate-friendly responses.
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

function validPassword(p: unknown): p is string {
  return typeof p === "string" && p.length >= 8 && p.length <= 128;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ status: "invalid" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !service) return json({ status: "unavailable" }, 503);

  let body: { action?: string; username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return json({ status: "invalid" }, 400);
  }

  const username = normUser(body.username);
  if (!username || !/^[a-z][a-z0-9_]{1,31}$/.test(username)) {
    return json({ status: "invalid" });
  }

  const admin = createClient(url, service, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: row, error } = await admin
    .from("permitted_operators")
    .select("username, auth_email, authority_rank, user_id, password_set")
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
    // Only useful after password is set — still ok to return email for sign-in attempts.
    return json({ status: "ok", email: row.auth_email, needsPassword: !row.password_set });
  }

  if (action === "claim") {
    if (row.password_set) return json({ status: "invalid" });
    if (!validPassword(body.password)) {
      return json({ status: "invalid", reason: "password" });
    }

    let userId = row.user_id as string | null;

    if (!userId) {
      const created = await admin.auth.admin.createUser({
        email: row.auth_email,
        password: body.password,
        email_confirm: true,
        app_metadata: {
          username: row.username,
          authority_rank: row.authority_rank,
          provider: "operator",
        },
        user_metadata: { username: row.username },
      });
      if (created.error || !created.data.user) {
        // Maybe user already exists from a partial attempt — try update by email list
        const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const existing = listed.data?.users?.find((u) => u.email === row.auth_email);
        if (!existing) return json({ status: "network" }, 500);
        userId = existing.id;
        const upd = await admin.auth.admin.updateUserById(userId, {
          password: body.password,
          email_confirm: true,
          app_metadata: {
            username: row.username,
            authority_rank: row.authority_rank,
            provider: "operator",
          },
        });
        if (upd.error) return json({ status: "network" }, 500);
      } else {
        userId = created.data.user.id;
      }
    } else {
      const upd = await admin.auth.admin.updateUserById(userId, {
        password: body.password,
        email_confirm: true,
      });
      if (upd.error) return json({ status: "network" }, 500);
    }

    await admin.from("permitted_operators").update({
      user_id: userId,
      password_set: true,
      updated_at: new Date().toISOString(),
    }).eq("username", username);

    await admin.from("operator_profiles").upsert({
      user_id: userId,
      email: row.auth_email,
      display_name: row.username,
      authority_rank: row.authority_rank,
      updated_at: new Date().toISOString(),
    });

    return json({ status: "ok", email: row.auth_email });
  }

  return json({ status: "invalid" }, 400);
});
