import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import Navbar from "./components/Navbar";
import { UserProfile } from "./components/UserProfile";
import { Messages } from "./components/Messages";
import CreatePostPage from "./pages/CreatePostPage";
import { PetProfile } from "./components/PetProfile";
import { PostPage } from "./pages/PostPage";
// import { CreateCommunityPage } from "./pages/CreateCommunityPage";
import { CommunitiesPage } from "./pages/CommunitiesPage";
// import { CommunityPage } from "./pages/CommunityPage";
import { PetSearch } from "./components/PetSearch";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import SignUpPage from "./pages/SignUpPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import AboutPage from "./pages/AboutPage";
import ContactPage from "./pages/ContactPage";
import ChatPage from "./pages/ChatPage";
import { useParams } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import VetDashboard from "./pages/VetDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import Home from "./pages/Home";
import { useAuth } from "./context/AuthContext";
import { supabase } from "./supabase-client";

const PetProfileWrapper = () => {
  const { id } = useParams<{ id: string }>();
  return <PetProfile petId={Number(id)} />;
};

const PublicProfileWrapper = () => {
  const { id } = useParams<{ id: string }>();
  return <UserProfile profileId={id} />;
};

function App() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isPostPage = location.pathname.startsWith("/post/");
  const isCreatePage = location.pathname === "/create";
  const isChatPage = location.pathname.startsWith("/chat");

  useEffect(() => {
    // Force Supabase auth callback links to the verify page so users don't
    // land on app routes like /home with a temporary session.
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const queryParams = new URLSearchParams(window.location.search);

    const hasHashAuthToken = !!hashParams.get("access_token");
    const hasQueryOtpToken = !!queryParams.get("token_hash");
    const callbackType = hashParams.get("type") || queryParams.get("type");
    const isSignupLikeCallback =
      ["signup", "magiclink", "invite", "email"].includes(callbackType || "") ||
      // Fallback: some links omit the type but still carry a token hash/access token.
      (!callbackType && (hasHashAuthToken || hasQueryOtpToken));

    if ((hasHashAuthToken || hasQueryOtpToken) && isSignupLikeCallback && location.pathname !== "/verify-email") {
      navigate(`/verify-email${window.location.search}${window.location.hash}`, {
        replace: true,
      });
    }
  }, [location.pathname, navigate]);

  useEffect(() => {
    const enforcePendingApprovalGate = async () => {
      if (!user) return;

      // Allow email verification callback page to process token before enforcing gates.
      if (location.pathname === "/verify-email") return;

      const { data: userRow, error } = await supabase
        .from("users")
        .select("role, verified")
        .eq("user_id", user.id)
        .maybeSingle();

      // If we cannot find the profile row for a regular user, treat them as pending.
      if (error || !userRow) {
        const metaRole = user.user_metadata?.role || "user";
        if (metaRole === "user") {
          await supabase.auth.signOut();
          localStorage.removeItem("userRole");
          navigate("/verify-email", {
            state: {
              pendingApproval: true,
              message:
                "Thankyou for registering, please wait for the verification so you can log in.",
            },
            replace: true,
          });
        }
        return;
      }

      if (userRow.role === "user" && userRow.verified !== true) {
        await supabase.auth.signOut();
        localStorage.removeItem("userRole");
        navigate("/verify-email", {
          state: {
            pendingApproval: true,
            message:
              "Thankyou for registering, please wait for the verification so you can log in.",
          },
          replace: true,
        });
      }
    };

    enforcePendingApprovalGate();
  }, [user, location.pathname, navigate]);

  const contentWrapperClass = isChatPage
    ? "h-full"
    : isPostPage || isCreatePage
    ? "w-full"
    : "w-full bg-white py-6";

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50 via-blue-50/30 to-white transition-opacity duration-700 text-violet-900 font-['Poppins']">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 5000,
          style: {
            background: "white",
            color: "#4B5563",
            fontFamily: "Poppins, sans-serif",
            boxShadow:
              "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
            borderRadius: "0.75rem",
          },
          success: {
            iconTheme: {
              primary: "#8B5CF6",
              secondary: "white",
            },
            style: {
              border: "1px solid #8B5CF6",
            },
          },
          error: {
            iconTheme: {
              primary: "#EF4444",
              secondary: "white",
            },
            style: {
              border: "1px solid #EF4444",
            },
          },
        }}
      />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="verify-email" element={<VerifyEmailPage />} />
        <Route path="vet-dashboard" element={<VetDashboard />} />
        <Route path="admin-dashboard/*" element={<AdminDashboard />} />

        <Route
          path="*"
          element={
            <div className="flex flex-col h-screen">
              <Navbar />
              <main
                className={`flex-1 ${
                  isChatPage ? "overflow-hidden" : "overflow-y-auto"
                }`}
              >
                <div className={contentWrapperClass}>
                  <Routes>
                    <Route path="home" element={<Home />} />
                    <Route path="search" element={<PetSearch />} />
                    <Route path="profile" element={<UserProfile />} />
                    <Route path="user/:id" element={<PublicProfileWrapper />} />
                    <Route path="messages" element={<Messages />} />
                    <Route path="create" element={<CreatePostPage />} />
                    <Route path="pet/:id" element={<PetProfileWrapper />} />
                    <Route path="post/:id" element={<PostPage />} />
                    <Route path="chat" element={<ChatPage />} />
                    <Route path="chat/:conversationId" element={<ChatPage />} />
                    {/* <Route
                      path="community/create"
                      element={<CreateCommunityPage />}
                    /> */}
                    <Route path="packs" element={<CommunitiesPage />} />
                    {/* <Route path="community/:id" element={<CommunityPage />} /> */}
                  </Routes>
                </div>
              </main>
            </div>
          }
        />
      </Routes>
    </div>
  );
}

export default App;
// DB SUPABASE PASSWORD
// petLuna_523;
