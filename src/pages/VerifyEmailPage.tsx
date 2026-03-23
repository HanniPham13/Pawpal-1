import { useState, useEffect } from "react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import { FaPaw, FaEnvelope } from "react-icons/fa";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../supabase-client";

const VerifyEmailPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { resendVerificationEmail } = useAuth();
  const { email, message, pendingApproval } = location.state || {
    email: "",
    message: "Please check your email to verify your account before signing in.",
    pendingApproval: false,
  };
  
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isVerified, setIsVerified] = useState(false);
  const [isProcessingVerification, setIsProcessingVerification] = useState(false);

  const successMessage =
    "Thank you for confirming your email. Please wait for an admin to verify your account (up to 24 hours).";

  const waitingApprovalMessage =
    message ||
    "Thankyou for verifying, please wait for the admin to process your account.";

  const upsertVerifiedUser = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      setResendMessage("Verification failed. Please try again or resend the email.");
      return;
    }

    // Get adoption validation from localStorage
    let adoptionValidation = null;
    const cached = localStorage.getItem("pendingAdoptionValidation");
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) {
          adoptionValidation = Object.fromEntries(
            Object.entries(parsed).filter(
              ([_, value]) =>
                value &&
                (typeof value === "string"
                  ? value.trim() !== ""
                  : value !== null && value !== undefined)
            )
          );
          if (Object.keys(adoptionValidation).length === 0) {
            adoptionValidation = null;
          }
        }
      } catch (parseError) {
        console.error("Failed to parse adoption validation:", parseError);
      }
    }

    const { data: existingUser } = await supabase
      .from("users")
      .select("adoption_validation")
      .eq("user_id", session.user.id)
      .maybeSingle();

    const finalAdoptionValidation =
      adoptionValidation || existingUser?.adoption_validation || null;

    const userData = {
      user_id: session.user.id,
      email: session.user.email || "",
      full_name:
        session.user.user_metadata?.full_name ||
        (session.user.user_metadata?.first_name
          ? `${session.user.user_metadata.first_name}${
              session.user.user_metadata?.last_name
                ? " " + session.user.user_metadata.last_name
                : ""
            }`
          : null) ||
        session.user.email?.split("@")[0] ||
        null,
      role: session.user.user_metadata?.role || "user",
      adoption_validation: finalAdoptionValidation,
      created_at: new Date().toISOString(),
    };

    const { error: upsertError } = await supabase
      .from("users")
      .upsert([userData], { onConflict: "user_id" });

    if (upsertError) {
      console.error("Failed to upsert user after email verification:", upsertError);
      const { error: insertError } = await supabase.from("users").insert([userData]);
      if (insertError) {
        console.error("Insert fallback also failed:", insertError);
      }
    }

    if (cached) {
      localStorage.removeItem("pendingAdoptionValidation");
    }

    setIsVerified(true);
    setResendMessage(successMessage);

    // Prevent automatic login redirect after verification by ending the session here.
    await supabase.auth.signOut();

    navigate("/login", {
      replace: true,
      state: {
        verifiedThankYou: true,
        message: successMessage,
      },
    });
  };

  // Handle email verification callback from Supabase
  useEffect(() => {
    const handleVerification = async () => {
      // Support both legacy hash callbacks and query-token callbacks.
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const queryParams = new URLSearchParams(window.location.search);

      const accessToken = hashParams.get("access_token");
      const hashType = hashParams.get("type");
      const tokenHash = queryParams.get("token_hash");
      const queryType = queryParams.get("type");

      // Some Supabase emails might omit the type query param; default to signup when a token is present.
      const normalizedType = queryType || hashType || "signup";

      const isHashSignupVerification = !!accessToken && normalizedType === "signup";
      const isQuerySignupVerification = !!tokenHash && normalizedType === "signup";

      if (!isHashSignupVerification && !isQuerySignupVerification) {
        return;
      }

      setIsProcessingVerification(true);

      try {
        if (isQuerySignupVerification && tokenHash) {
          const { error } = await supabase.auth.verifyOtp({
            type: "signup",
            token_hash: tokenHash,
          });
          if (error) throw error;
        } else {
          // Legacy flow: wait for session from hash callback.
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        await upsertVerifiedUser();
      } catch (error) {
        console.error("Verification error:", error);
        setResendMessage("Verification failed. Please try again or resend the email.");
      } finally {
        setIsProcessingVerification(false);
      }
    };

    handleVerification();
  }, [navigate]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  const handleResend = async () => {
    if (resendCooldown > 0) {
      setResendMessage(
        `Please wait ${resendCooldown}s before requesting another email.`
      );
      return;
    }

    if (!email) {
      setResendMessage("Email address is required to resend verification.");
      return;
    }

    setResending(true);
    setResendMessage("");
    
    const { success, error } = await resendVerificationEmail(email);
    
    if (success) {
      setResendMessage("Verification email sent! Please check your inbox.");
      setResendCooldown(60);
    } else {
      setResendMessage(error || "Failed to resend email. Please try again.");
    }
    
    setResending(false);
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-50">
      {/* Left column (mobile-first stacked) */}
      <div className="w-full md:w-1/2 p-4 md:p-10 flex flex-col justify-between bg-white border-b border-gray-200 md:border-b-0 md:border-r">
        <div>
          <div className="mb-4 md:mb-8 flex justify-center md:justify-start">
            <FaPaw className="text-violet-600 text-2xl md:text-4xl" />
          </div>
          <h1 className="text-3xl md:text-5xl font-bold mb-3 md:mb-6 text-gray-900 text-center md:text-left">
            Almost there!
          </h1>
          <p className="text-base md:text-xl text-gray-600 mb-6 md:mb-12 text-center md:text-left">
            We're excited to have you join our community.
          </p>
        </div>

        <div className="w-full max-w-lg mx-auto bg-gray-900 text-white p-4 md:p-8 rounded-2xl text-center md:text-left space-y-4 md:space-y-6">
          <p className="text-sm md:text-lg">
            "Your account security is important to us. Please verify your email to ensure the safety of your account and pets."
          </p>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-start gap-3">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-violet-600 rounded-full flex items-center justify-center text-lg md:text-xl mx-auto sm:mx-0">
              <FaPaw />
            </div>
            <div className="text-center sm:text-left">
              <p className="font-semibold">Pawpal Team</p>
              <p className="text-gray-400 text-sm">Security Notice</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right column */}
      <div className="w-full md:w-1/2 p-4 md:p-10 flex items-start md:items-center justify-center">
        <div className="w-full max-w-md text-center space-y-4 md:space-y-6">
          <div>
            <div className="bg-violet-100 w-12 h-12 md:w-20 md:h-20 rounded-full mx-auto flex items-center justify-center mb-3 md:mb-6">
              <FaEnvelope className="text-violet-600 text-xl md:text-3xl" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold mb-2 text-gray-900">
              {isVerified || pendingApproval ? "Registration Received" : "Check your email"}
            </h2>

            {isProcessingVerification && (
              <p className="text-gray-600 mb-2 md:mb-6 break-words">
                Verifying your account...
              </p>
            )}

            {!isVerified && !pendingApproval && !isProcessingVerification && email && (
              <p className="text-gray-600 mb-3 md:mb-4 break-words">
                We've sent a verification link to:
                <br />
                <span className="font-semibold text-gray-800">{email}</span>
              </p>
            )}

            {!isVerified && !pendingApproval && !isProcessingVerification && (
              <p className="text-gray-600 mb-2 md:mb-6 break-words">{message}</p>
            )}

            {pendingApproval && !isProcessingVerification && (
              <p className="text-gray-700 mb-2 md:mb-6 break-words font-medium">
                {waitingApprovalMessage}
              </p>
            )}

            {isVerified && (
              <p className="text-gray-700 mb-2 md:mb-6 break-words font-medium">
                {successMessage}
              </p>
            )}
          </div>

          <div className="space-y-3 md:space-y-4">
            {!isVerified && !pendingApproval && !isProcessingVerification && (
              <p className="text-gray-600 text-sm md:text-base">
                Didn't receive the email? Check your spam folder.
              </p>
            )}

            {!isVerified && !pendingApproval && !isProcessingVerification && email && (
              <button
                onClick={handleResend}
                disabled={resending || resendCooldown > 0}
                className="w-full bg-violet-600 text-white py-2.5 md:py-3 px-4 md:px-6 rounded-lg font-semibold hover:bg-violet-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resending
                  ? "Sending..."
                  : resendCooldown > 0
                  ? `Resend available in ${resendCooldown}s`
                  : "Resend Verification Email"}
              </button>
            )}

            {resendMessage && (
              <div
                className={`p-3 rounded-lg ${
                  isVerified || resendMessage.toLowerCase().includes("sent")
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-red-50 text-red-700 border border-red-200"
                }`}
              >
                {resendMessage}
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2 md:pt-4">
              {!isVerified && !pendingApproval && (
                <Link
                  to="/signup"
                  className="text-violet-600 hover:text-violet-800 font-semibold"
                >
                  Try using a different email address
                </Link>
              )}
              {!isVerified && !pendingApproval && (
                <Link
                  to="/login"
                  className="text-violet-600 hover:text-violet-800 font-semibold"
                >
                  Return to login
                </Link>
              )}
            </div>
          </div>

          <div className="w-full max-w-lg mx-auto p-3 md:p-4 bg-violet-50 rounded-lg text-center">
            <p className="text-xs md:text-sm text-gray-600">
              Note: The verification link will expire in 24 hours. If you don't verify your email within this time, you'll need to sign up again.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmailPage; 