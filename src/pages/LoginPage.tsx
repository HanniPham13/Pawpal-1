import { useState, useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { FaPaw, FaLock, FaEnvelope, FaEye, FaEyeSlash } from "react-icons/fa";
import { useAuth } from "../context/AuthContext";
import { LoginErrorModal } from "../components/LoginErrorModal";
import { supabase } from "../supabase-client";

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signInWithEmail, user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [declinedReason, setDeclinedReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showVerifiedModal, setShowVerifiedModal] = useState(false);
  const [verifiedMessage, setVerifiedMessage] = useState<string | null>(null);
  const [declineCleanupLoading, setDeclineCleanupLoading] = useState(false);
  const [declineAction, setDeclineAction] = useState<"got-it" | "register-again" | null>(null);

  const withTimeout = async <T,>(promise: Promise<T>, ms: number, message: string): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error(message)), ms);
      promise
        .then((value) => {
          window.clearTimeout(timer);
          resolve(value);
        })
        .catch((timeoutError) => {
          window.clearTimeout(timer);
          reject(timeoutError);
        });
    });

  const cleanupDeclinedAccountByEmail = async () => {
    const cleanedEmail = email.trim().toLowerCase();
    if (!cleanedEmail) {
      return { success: false, error: "Email is required to clean up declined account data." };
    }

    setDeclineCleanupLoading(true);
    try {
      const { data, error } = await withTimeout(
        supabase.functions.invoke("decline-user-cleanup", {
          body: { email: cleanedEmail },
        }),
        12000,
        "Cleanup request timed out."
      );

      if (error) {
        console.error("decline-user-cleanup invoke error:", error);
        return {
          success: false,
          error: "Unable to clean up declined account right now. Please try again.",
        };
      }

      if (data?.success === false) {
        return {
          success: false,
          error: data?.error || "Unable to clean up declined account right now.",
        };
      }

      return { success: true };
    } catch (cleanupError) {
      console.error("decline-user-cleanup unexpected error:", cleanupError);
      return {
        success: false,
        error: "Unexpected cleanup error. Please try again.",
      };
    } finally {
      setDeclineCleanupLoading(false);
    }
  };

  const handleDeclinedGotIt = async () => {
    setDeclineAction("got-it");
    await cleanupDeclinedAccountByEmail();

    setShowErrorModal(false);
    setDeclinedReason(null);
    setDeclineAction(null);
  };

  const handleDeclinedRegisterAgain = async () => {
    setDeclineAction("register-again");
    await cleanupDeclinedAccountByEmail();

    setShowErrorModal(false);
    setDeclinedReason(null);
    navigate("/signup", {
      state: {
        prefillEmail: email,
      },
    });
    setDeclineAction(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setDeclinedReason(null);

    try {
      const { success, error, declinedReason } = await signInWithEmail(email, password);

      if (!success) {
        setError(error || "Failed to sign in");
        setDeclinedReason(declinedReason || null);
        setShowErrorModal(true);
        return;
      }

      // Navigate based on role
      const userRole = localStorage.getItem("userRole");
      if (userRole === "admin") {
        navigate("/admin-dashboard");
      } else if (userRole === "vet") {
        navigate("/vet-dashboard");
      } else {
        navigate("/home");
      }
    } catch (err) {
      console.error("Login attempt failed:", err);
      setError("Something went wrong while signing in. Please try again.");
      setShowErrorModal(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      // If a session already exists, send the user to the correct area.
      const userRole = localStorage.getItem("userRole");
      if (userRole === "admin") {
        navigate("/admin-dashboard", { replace: true });
      } else if (userRole === "vet") {
        navigate("/vet-dashboard", { replace: true });
      } else {
        navigate("/home", { replace: true });
      }
    }
  }, [user, navigate]);

  useEffect(() => {
    const state = location.state as { verifiedThankYou?: boolean; message?: string } | null;
    if (state?.verifiedThankYou) {
      setVerifiedMessage(
        state.message ||
          "Thank you for confirming your email. Please wait for an admin to verify your account (up to 24 hours)."
      );
      setShowVerifiedModal(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-50">
      {/* Left Section */}
      <div className="hidden md:flex w-full md:w-1/2 p-6 sm:p-12 flex-col justify-between bg-white">
        <div>
          <div className="mb-8">
            <FaPaw className="text-violet-600 text-3xl sm:text-4xl" />
          </div>
          <h1 className="text-2xl sm:text-5xl font-bold mb-6 text-gray-900">
            Let us help you take care of your pets.
          </h1>
          <p className="text-base sm:text-xl text-gray-600 mb-8 sm:mb-12">
            Our platform connects pet owners with qualified veterinarians for
            the best possible care.
          </p>
        </div>

        {/* Testimonial Card */}
        <div className="bg-gray-900 text-white p-4 sm:p-8 rounded-2xl mt-8 md:mt-0">
          <p className="text-base sm:text-lg mb-4 sm:mb-6">
            "I'm impressed with the care and attention my pets receive through
            this platform. The veterinarians are professional and caring."
          </p>
          <div className="flex items-center">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-violet-600 rounded-full flex items-center justify-center text-lg sm:text-xl font-bold">
              JP
            </div>
            <div className="ml-4">
              <p className="font-semibold">John Peterson</p>
              <p className="text-gray-400">Pet Owner</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center justify-center w-full md:w-1/2 p-6 md:p-12 min-h-screen">
        <div className=" w-full max-w-md">
          <h2 className="text-2xl sm:text-3xl font-bold mb-2 text-gray-900">
            Get started
          </h2>
          <p className="text-gray-600 mb-4 sm:mb-8">
            Sign in to continue to Pawpal
          </p>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FaEnvelope className="text-gray-400" />
                </div>
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FaLock className="text-gray-400" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  required
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 focus:outline-none"
                  tabIndex={-1}
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>


            <button
              type="submit"
              className="w-full bg-violet-600 text-white py-3 rounded-lg font-semibold hover:bg-violet-700 transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <svg
                    className="animate-spin h-5 w-5 mr-3 text-white"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Signing in...
                </div>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-gray-600 mb-4">Create an account?</p>
            <div className="flex justify-center space-x-6">
              <Link
                to="/signup"
                className="text-violet-600 hover:text-violet-800 font-semibold"
              >
                as a Pet Owner
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Login Error Modal */}
      <LoginErrorModal
        isOpen={showErrorModal}
        onClose={() => {
          if (declineCleanupLoading) return;
          setShowErrorModal(false);
          setError("");
          setDeclinedReason(null);
          setDeclineAction(null);
        }}
        errorMessage={error}
        declinedReason={declinedReason}
        onDeclinedGotIt={declinedReason ? handleDeclinedGotIt : undefined}
        onDeclinedRegisterAgain={declinedReason ? handleDeclinedRegisterAgain : undefined}
        isDeclinedActionLoading={declineCleanupLoading}
        declinedAction={declineAction}
      />

      {showVerifiedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md text-left">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-xl">
                <FaEnvelope />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-semibold">Email confirmed</p>
                <h3 className="text-xl font-bold text-gray-900">Thank you!</h3>
              </div>
            </div>
            <p className="text-gray-700 mb-6 leading-relaxed">
              {verifiedMessage ||
                "Please wait for an admin to verify your account. This review can take up to 24 hours."}
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowVerifiedModal(false)}
                className="bg-violet-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-violet-700 transition"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;
