// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface Payload {
  targetUserId: string;
  reason?: string | null;
}

/**
 * Delete public rows that reference auth.users(id) without ON DELETE CASCADE.
 * If any remain, GoTrue's admin.deleteUser() fails with a database error.
 */
async function scrubPublicReferencesToUser(admin: any, uid: string) {
  const warn = (step: string, err: { message?: string } | null) => {
    if (err?.message) console.warn(`[vet-decline-user scrub] ${step}: ${err.message}`);
  };

  const del = async (step: string, fn: () => any) => {
    const { error } = await fn();
    warn(step, error);
  };

  await del("messages.sender_id", () => admin.from("messages").delete().eq("sender_id", uid));
  await del("messages.receiver_id", () => admin.from("messages").delete().eq("receiver_id", uid));

  await del("user_conversations", () => admin.from("user_conversations").delete().eq("user_id", uid));

  await del("adoption_requests", () =>
    admin.from("adoption_requests").delete().or(`requester_id.eq.${uid},owner_id.eq.${uid}`)
  );

  await del("adoption_applications", () =>
    admin.from("adoption_applications").delete().eq("applicant_id", uid)
  );

  await del("notifications", () => admin.from("notifications").delete().eq("user_id", uid));
  await del("likes", () => admin.from("likes").delete().eq("user_id", uid));
  await del("comments", () => admin.from("comments").delete().eq("user_id", uid));
  await del("votes", () => admin.from("votes").delete().eq("user_id", uid));
  await del("user_badges", () => admin.from("user_badges").delete().eq("user_id", uid));

  await del("posts.user_id", () => admin.from("posts").delete().eq("user_id", uid));
  await del("posts.owner_id", () => admin.from("posts").delete().eq("owner_id", uid));
  await del("post.user_id", () => admin.from("post").delete().eq("user_id", uid));
  await del("post.auth_users_id", () => admin.from("post").delete().eq("auth_users_id", uid));
}

async function deleteAuthUserWithRetries(
  admin: any,
  uid: string
): Promise<{ ok: boolean; lastError: string | null }> {
  let lastError: string | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
    const { error } = await admin.auth.admin.deleteUser(uid);
    if (!error) {
      return { ok: true, lastError: null };
    }
    lastError = error.message || String(error);
    console.error(`[vet-decline-user] deleteUser attempt ${attempt + 1} failed:`, lastError);
  }
  return { ok: false, lastError };
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

    // Break FKs that do not use ON DELETE CASCADE (common with messages, legacy tables).
    await scrubPublicReferencesToUser(admin, targetUser.user_id);

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

    const { ok: authDeleted, lastError: authDeleteError } = await deleteAuthUserWithRetries(
      admin,
      targetUser.user_id
    );

    return json({
      success: true,
      declinedUserId: targetUser.user_id,
      email: targetUser.email,
      authDeleted,
      dbDeleted: !userDeleteError,
      ...(authDeleteError ? { authDeleteError } : {}),
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
