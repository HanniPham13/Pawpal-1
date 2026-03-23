// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface Payload {
  targetUserId: string;
  reason?: string | null;
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
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return json(
        { error: "Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or SUPABASE_ANON_KEY." },
        500
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing Authorization header" }, 401);
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user: callerUser },
      error: callerError,
    } = await callerClient.auth.getUser();

    if (callerError || !callerUser) {
      return json({ error: "Unauthorized" }, 401);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: reviewerRecord, error: reviewerError } = await admin
      .from("users")
      .select("role")
      .eq("user_id", callerUser.id)
      .maybeSingle();

    if (reviewerError || !reviewerRecord || !["vet", "admin"].includes(reviewerRecord.role)) {
      return json({ error: "Forbidden: only vet/admin can decline users" }, 403);
    }

    const body = (await req.json()) as Payload;
    if (!body?.targetUserId || typeof body.targetUserId !== "string") {
      return json({ error: "Invalid payload: targetUserId is required" }, 400);
    }

    const declineReason =
      typeof body.reason === "string" && body.reason.trim().length > 0
        ? body.reason.trim()
        : "No specific reason was provided.";

    const { data: targetUser, error: targetError } = await admin
      .from("users")
      .select("user_id, email, role")
      .eq("user_id", body.targetUserId)
      .maybeSingle();

    if (targetError || !targetUser) {
      return json({ error: "Target user not found" }, 404);
    }

    if (targetUser.role !== "user") {
      return json({ error: "Only regular users can be declined" }, 400);
    }

    if (!targetUser.email) {
      return json({ error: "Target user has no email" }, 400);
    }

    const { error: declineUpdateError } = await admin
      .from("users")
      .update({
        declined: true,
        declined_reason: declineReason,
        verified: false,
      })
      .eq("user_id", targetUser.user_id);

    if (declineUpdateError) {
      return json(
        { error: "Failed to update user decline status", details: declineUpdateError.message },
        500
      );
    }

    // Keep auth metadata in sync so any cached session shows the decline state before deletion.
    const { error: metadataError } = await admin.auth.admin.updateUserById(targetUser.user_id, {
      user_metadata: {
        declined: true,
        declined_reason: declineReason,
      },
    });

    if (metadataError) {
      console.error("Failed to sync decline metadata:", metadataError.message);
    }

    // Delete application data to let the user sign up again cleanly.
    // Service role bypasses RLS, so we can hard-delete here.
    const { error: profileDeleteError } = await admin
      .from("profiles")
      .delete()
      .eq("id", targetUser.user_id);

    if (profileDeleteError) {
      console.warn("Profile cleanup failed (safe to ignore if table absent):", profileDeleteError.message);
    }

    const { error: userDeleteError } = await admin
      .from("users")
      .delete()
      .eq("user_id", targetUser.user_id);

    if (userDeleteError) {
      console.error("Failed to delete user row after decline:", userDeleteError.message);
    }

    // Remove the auth user to fully block access and cascade other FK rows.
    let authDeleted = false;
    const { error: deleteError } = await admin.auth.admin.deleteUser(targetUser.user_id);
    if (deleteError) {
      console.error("Failed to delete auth user after decline:", deleteError.message);
    } else {
      authDeleted = true;
    }

    return json({
      success: true,
      declinedUserId: targetUser.user_id,
      email: targetUser.email,
      authDeleted,
      dbDeleted: !userDeleteError,
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
