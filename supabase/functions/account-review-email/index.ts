// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type ReviewStatus = "verified" | "declined";

interface Payload {
  targetUserId: string;
  status: ReviewStatus;
  reason?: string | null;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const isNonEmpty = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const rawResendApiKey = Deno.env.get("RESEND_API_KEY");
    const resendApiKey = rawResendApiKey
      ? rawResendApiKey.trim().replace(/^['"]|['"]$/g, "")
      : "";
    const rawFromEmail = Deno.env.get("RESEND_FROM_EMAIL");
    const configuredFromEmail = rawFromEmail
      ? rawFromEmail.trim().replace(/^['"]|['"]$/g, "")
      : "";
    const fallbackFromEmail = "Pawpal <knowiev@gmail.com>";
    const fromEmail = isNonEmpty(configuredFromEmail)
      ? configuredFromEmail
      : fallbackFromEmail;

    if (!supabaseUrl || !serviceRoleKey || !resendApiKey) {
      return new Response(
        JSON.stringify({ error: "Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or RESEND_API_KEY." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!resendApiKey.startsWith("re_")) {
      return new Response(
        JSON.stringify({
          error: "RESEND_API_KEY appears invalid. It should start with 're_'.",
          hint: "Set a valid Resend API key in Supabase secrets: RESEND_API_KEY=your_re_key",
          fromEmail,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const body = (await req.json()) as Payload;
    if (!body?.targetUserId || !["verified", "declined"].includes(body.status)) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: targetUser, error: targetUserError } = await admin
      .from("users")
      .select("email, full_name")
      .eq("user_id", body.targetUserId)
      .maybeSingle();

    if (targetUserError || !targetUser || !isNonEmpty(targetUser.email)) {
      return new Response(JSON.stringify({ error: "Target user not found or missing email" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userName = isNonEmpty(targetUser.full_name) ? targetUser.full_name : targetUser.email.split("@")[0];
    const statusText = body.status === "verified" ? "verified" : "declined";

    const subject =
      body.status === "verified"
        ? "Your Pawpal account has been approved"
        : "Your Pawpal account review result";

    const html =
      body.status === "verified"
        ? `<p>Hello ${userName},</p>
           <p>Your account is now verified. You can now sign in to Pawpal.</p>
           <p>Thank you,<br/>Pawpal Team</p>`
        : `<p>Hello ${userName},</p>
           <p>Your account has been declined by our veterinary/admin review team.</p>
           <p><strong>Reason:</strong> ${isNonEmpty(body.reason) ? body.reason : "No specific reason was provided."}</p>
           <p>If you believe this was a mistake, please sign up again with updated details.</p>
           <p>Thank you,<br/>Pawpal Team</p>`;

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [targetUser.email],
        subject,
        html,
      }),
    });

    if (!resendResponse.ok) {
      const resendErrorBody = await resendResponse.text();
      return new Response(
        JSON.stringify({
          error: "Email send failed",
          details: resendErrorBody,
          fromEmail,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, status: statusText, email: targetUser.email }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Unexpected error",
        details: error instanceof Error ? error.message : "unknown",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
