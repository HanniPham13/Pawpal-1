// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface Payload {
  email?: string;
  /** When true, remove decline_log rows for this email (use after the user has seen the decline reason, or on re-signup). */
  purgeDeclineLog?: boolean;
  /** Optional; each id must belong to the same email (verified server-side). */
  userIds?: string[];
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
    const purgeDeclineLog = body?.purgeDeclineLog === true;
    const rawUserIds = Array.isArray(body?.userIds) ? body.userIds : [];

    if (!cleanedEmail) {
      return json({ error: "Invalid payload: email is required." }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const findAuthUserIdsByEmail = async (email: string): Promise<string[]> => {
      const { data: rpcIds, error: rpcError } = await admin.rpc("get_auth_user_ids_by_email", {
        target_email: email,
      });

      if (!rpcError && rpcIds != null) {
        const asArray = Array.isArray(rpcIds) ? rpcIds : [rpcIds];
        return asArray.filter((id): id is string => typeof id === "string" && id.length > 0);
      }

      if (rpcError) {
        console.warn("get_auth_user_ids_by_email failed, falling back to listUsers:", rpcError.message);
      }

      const matches: string[] = [];
      const perPage = 200;
      let page = 1;

      while (page <= 500) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
        if (error) {
          console.warn("auth.admin.listUsers failed", error.message);
          break;
        }

        const users = data?.users ?? [];
        for (const authUser of users) {
          if (authUser?.email?.toLowerCase() === email) {
            matches.push(authUser.id);
          }
        }

        if (matches.length > 0 || users.length < perPage) {
          break;
        }

        page += 1;
      }

      return matches;
    };

    const verifiedClientUserIds: string[] = [];
    for (const id of rawUserIds) {
      if (typeof id !== "string" || id.length === 0) continue;
      const { data: authData, error: getUserError } = await admin.auth.admin.getUserById(id);
      if (getUserError || !authData?.user?.email) continue;
      if (authData.user.email.trim().toLowerCase() === cleanedEmail) {
        verifiedClientUserIds.push(id);
      }
    }

    const { data: declinedUsers, error: findError } = await admin
      .from("users")
      .select("user_id, email, declined, role")
      .ilike("email", cleanedEmail)
      .eq("declined", true);

    if (findError) {
      return json({ error: "Failed to find declined user", details: findError.message }, 500);
    }

    const declinedUserIds =
      declinedUsers
        ?.map((record) => record.user_id)
        .filter((value): value is string => typeof value === "string" && value.length > 0) || [];

    const { data: declineLogRows } = await admin
      .from("decline_log")
      .select("id")
      .ilike("email", cleanedEmail)
      .limit(1);

    const hasDeclineLog = (declineLogRows?.length ?? 0) > 0;

    const authUserIds = await findAuthUserIdsByEmail(cleanedEmail);

    // Never delete auth for a normal active email: only when decline is evidenced.
    const shouldTouchAuth =
      verifiedClientUserIds.length > 0 ||
      declinedUserIds.length > 0 ||
      hasDeclineLog;

    const idsToClean = Array.from(
      new Set([
        ...verifiedClientUserIds,
        ...declinedUserIds,
        ...(shouldTouchAuth ? authUserIds : []),
      ])
    );

    if (idsToClean.length === 0) {
      if (purgeDeclineLog) {
        await admin.from("decline_log").delete().ilike("email", cleanedEmail);
      }
      return json({
        success: true,
        cleaned: 0,
        message: "No declined user or auth record found for that email.",
      });
    }

    let profilesDeleted = 0;
    let usersDeleted = 0;
    let authDeleted = 0;

    for (const userId of idsToClean) {
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

    const remainingAuthUsers = await findAuthUserIdsByEmail(cleanedEmail);

    if (purgeDeclineLog) {
      await admin.from("decline_log").delete().ilike("email", cleanedEmail);
    }

    return json({
      success: true,
      cleaned: idsToClean.length,
      profilesDeleted,
      usersDeleted,
      authDeleted,
      remainingAuthUsers: remainingAuthUsers.length,
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
