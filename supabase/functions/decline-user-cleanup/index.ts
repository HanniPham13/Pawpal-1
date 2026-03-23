// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface Payload {
  email?: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY." }, 500);
    }

    const body = (await req.json()) as Payload;
    const cleanedEmail = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!cleanedEmail) {
      return json({ error: "Invalid payload: email is required." }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: declinedUsers, error: findError } = await admin
      .from("users")
      .select("user_id, email, declined, role")
      .ilike("email", cleanedEmail)
      .eq("role", "user")
      .eq("declined", true);

    if (findError) {
      return json({ error: "Failed to find declined user", details: findError.message }, 500);
    }

    if (!declinedUsers || declinedUsers.length === 0) {
      return json({ success: true, cleaned: 0, message: "No declined user record found for that email." });
    }

    const userIds = declinedUsers
      .map((record) => record.user_id)
      .filter((value) => typeof value === "string" && value.length > 0);

    let profilesDeleted = 0;
    let usersDeleted = 0;
    let authDeleted = 0;

    for (const userId of userIds) {
      const { error: profileDeleteError } = await admin.from("profiles").delete().eq("id", userId);
      if (!profileDeleteError) {
        profilesDeleted += 1;
      }

      const { error: userDeleteError } = await admin.from("users").delete().eq("user_id", userId);
      if (!userDeleteError) {
        usersDeleted += 1;
      }

      const { error: authDeleteError } = await admin.auth.admin.deleteUser(userId);
      if (!authDeleteError) {
        authDeleted += 1;
      }
    }

    return json({
      success: true,
      cleaned: userIds.length,
      profilesDeleted,
      usersDeleted,
      authDeleted,
    });
  } catch (error) {
    return json(
      {
        error: "Unexpected error",
        details: error instanceof Error ? error.message : "unknown",
      },
      500
    );
  }
});
