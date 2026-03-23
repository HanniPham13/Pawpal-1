import React, { useEffect, useState, useRef } from "react";
import { supabase } from "../supabase-client";
import { useAuth } from "../context/AuthContext";
import { toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { FaTimes, FaCheck, FaBars } from "react-icons/fa";
import { SignOutConfirmationModal } from "../components/SignOutConfirmationModal";
import { DeclineUserModal } from "../components/DeclineUserModal";

interface Post {
  id: number;
  name: string;
  image_url?: string;
  status: string;
  owner_id: string;
  health_notes?: string;
  health_info?: string;
  content?: string;
  breed?: string;
  age?: string;
  location?: string;
  size?: string;
  temperament?: string | string[];
  vaccination_status?: boolean;
  additional_photos?: string[];
  created_at?: string;
  vet_id?: string;
}

interface User {
  user_id: string;
  full_name: string;
  email: string;
  role: string;
  verified: boolean;
  created_at: string;
  adoption_validation?: { [key: string]: string };
  declined?: boolean;
  declined_reason?: string | null;
}

const VetSidebar = ({ 
  activeSection, 
  isOpen, 
  onClose 
}: { 
  activeSection: string;
  isOpen: boolean;
  onClose: () => void;
}) => {
  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <aside
        className={`fixed top-16 left-0 w-64 h-[calc(100vh-4rem)] bg-white shadow-lg z-50 flex flex-col pt-8 transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <nav className="flex flex-col gap-2 px-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-violet-700 font-semibold text-lg">
              Vet Menu
            </span>
            <button
              onClick={onClose}
              className="md:hidden text-violet-700 hover:text-violet-900 p-2"
              aria-label="Close menu"
            >
              <FaTimes />
            </button>
          </div>
          <a
            href="#pending-users"
            onClick={() => {
              // Close on mobile when link is clicked
              if (window.innerWidth < 768) {
                onClose();
              }
            }}
            className={`px-3 py-2 rounded-lg font-medium transition-colors ${
              activeSection === "pending-users"
                ? "bg-violet-200 text-violet-900"
                : "hover:bg-violet-50 text-violet-800"
            }`}
          >
            Pending Users
          </a>
          <a
            href="#pending"
            onClick={() => {
              if (window.innerWidth < 768) {
                onClose();
              }
            }}
            className={`px-3 py-2 rounded-lg font-medium transition-colors ${
              activeSection === "pending"
                ? "bg-violet-200 text-violet-900"
                : "hover:bg-violet-50 text-violet-800"
            }`}
          >
            Pending Listings
          </a>
          <a
            href="#history"
            onClick={() => {
              if (window.innerWidth < 768) {
                onClose();
              }
            }}
            className={`px-3 py-2 rounded-lg font-medium transition-colors ${
              activeSection === "history"
                ? "bg-violet-200 text-violet-900"
                : "hover:bg-violet-50 text-violet-800"
            }`}
          >
            Adoption History
          </a>
        </nav>
      </aside>
    </>
  );
};

const VetNavbar = ({ onMenuClick }: { onMenuClick: () => void }) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [showSignOutModal, setShowSignOutModal] = useState(false);

  const handleSignOutClick = () => {
    setShowSignOutModal(true);
  };

  const handleSignOutConfirm = () => {
    signOut();
    navigate("/login");
  };

  return (
    <>
      <nav className="fixed top-0 left-0 w-full h-16 bg-violet-700 text-white flex items-center justify-between px-4 md:px-8 shadow z-50">
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="md:hidden text-white hover:text-violet-200 p-2"
            aria-label="Toggle menu"
          >
            <FaBars className="text-xl" />
          </button>
          <div className="font-bold text-lg tracking-wide">Pawpal Vet</div>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
          <span className="font-medium text-sm md:text-base hidden sm:inline">
            {user?.user_metadata?.full_name || user?.email || "Vet"}
          </span>
          <button
            onClick={handleSignOutClick}
            className="bg-white text-violet-700 px-3 md:px-4 py-2 rounded font-semibold hover:bg-violet-100 transition-colors text-sm md:text-base"
          >
            Sign Out
          </button>
        </div>
      </nav>

      {/* Sign Out Confirmation Modal */}
      <SignOutConfirmationModal
        isOpen={showSignOutModal}
        onClose={() => setShowSignOutModal(false)}
        onConfirm={handleSignOutConfirm}
        userName={user?.user_metadata?.full_name || user?.email?.split("@")[0]}
      />
    </>
  );
};

export default function VetDashboard() {
  const { user, role } = useAuth();
  const [pendingPosts, setPendingPosts] = useState<Post[]>([]);
  const [history, setHistory] = useState<Post[]>([]);
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState<{ [key: number]: string }>({});
  const [activeSection, setActiveSection] = useState("pending-users");
  const pendingUsersRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [viewedAssessments, setViewedAssessments] = useState<Record<string, boolean>>({});
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [userToDecline, setUserToDecline] = useState<User | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const recentlyProcessedUsersRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (role !== "vet") return;
    fetchPendingUsers();
    fetchPendingPosts();
    fetchHistory();
    // eslint-disable-next-line
  }, [user, role]);

  // Scroll section highlight logic
  useEffect(() => {
    const handleScroll = () => {
      const pendingUsersTop = pendingUsersRef.current?.getBoundingClientRect().top ?? 0;
      const pendingTop = pendingRef.current?.getBoundingClientRect().top ?? 0;
      const historyTop = historyRef.current?.getBoundingClientRect().top ?? 0;
      if (pendingUsersTop <= 100 && pendingTop > 200) {
        setActiveSection("pending-users");
      } else if (pendingTop <= 100 && historyTop > 200) {
        setActiveSection("pending");
      } else if (historyTop <= 100) {
        setActiveSection("history");
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const getVetId = (user: { user_id?: string; id?: string }) =>
    user?.user_id || user?.id;

  const fetchPendingUsers = async () => {
    setLoading(true);
    try {
      // Fetch all users with role 'user' that are not verified
      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("*")
        .eq("role", "user")
        .eq("verified", false)
        .or("declined.is.null,declined.eq.false")
        .order("created_at", { ascending: false });

      if (usersError) {
        console.error("Error fetching pending users:", usersError);
        toast.error("Failed to fetch pending users");
        return;
      }

      if (!usersData || usersData.length === 0) {
        setPendingUsers([]);
        setLoading(false);
        return;
      }

      // Get user profiles for additional information
      const userIds = usersData.map((user) => user.user_id);
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);

      // Create a map of user profiles
      const profileMap = new Map(
        profilesData?.map((profile) => [profile.id, profile]) || []
      );

      // Combine user data with profile data
      const combinedUsers = usersData
        .filter((user) => !recentlyProcessedUsersRef.current.has(user.user_id))
        .map((user) => {
        const profile = profileMap.get(user.user_id);
        return {
          ...user,
          full_name: profile?.full_name || user.full_name || "Unknown",
          email: profile?.email || user.email || "N/A",
          adoption_validation: user.adoption_validation || null,
        };
      });

      setPendingUsers(combinedUsers);
    } catch (error) {
      console.error("Error in fetchPendingUsers:", error);
      toast.error("Failed to fetch pending users");
    } finally {
      setLoading(false);
    }
  };

  const handleDeclineUserClick = (user: User) => {
    setUserToDecline(user);
    setShowDeclineModal(true);
  };

  const handleDeclineUser = async (reason: string) => {
    if (!userToDecline) return;

    const declineReason = reason.trim() || "No specific reason was provided.";

    try {
      const { error } = await supabase.functions.invoke("vet-decline-user", {
        body: {
          targetUserId: userToDecline.user_id,
          reason: declineReason,
        },
      });

      if (error) throw error;

      recentlyProcessedUsersRef.current.add(userToDecline.user_id);

      toast.success("User declined successfully.");
      setPendingUsers((prev) =>
        prev.filter((pendingUser) => pendingUser.user_id !== userToDecline.user_id)
      );
      setTimeout(() => {
        fetchPendingUsers();
      }, 1200);
      setShowDeclineModal(false);
      setUserToDecline(null);
    } catch (error) {
      console.error("Error declining user:", error);
      toast.error("Failed to decline user");
    }
  };

  const handleVerifyUser = async (userId: string) => {
    const targetUser = pendingUsers.find((pendingUser) => pendingUser.user_id === userId);

    if (!targetUser) {
      toast.error("Unable to find the user to verify.");
      return;
    }

    if (!targetUser.adoption_validation) {
      toast.error("This user has not completed the adoption assessment yet.");
      return;
    }

    if (!viewedAssessments[userId]) {
      toast.error("Please review the user's assessment answers before verifying.");
      return;
    }

    try {
      const { error } = await supabase
        .from("users")
        .update({ verified: true, declined: false, declined_reason: null })
        .eq("user_id", userId);

      if (error) throw error;

      recentlyProcessedUsersRef.current.add(userId);

      toast.success("User verified successfully!");
      setPendingUsers((prev) =>
        prev.filter((pendingUser) => pendingUser.user_id !== userId)
      );
      setTimeout(() => {
        fetchPendingUsers();
      }, 1200);
    } catch (error) {
      console.error("Error verifying user:", error);
      toast.error("Failed to verify user");
    }
  };

  const fetchPendingPosts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .eq("status", "pending");
    if (error) toast.error("Failed to fetch posts");
    else setPendingPosts(data || []);
    setLoading(false);
  };

  const fetchHistory = async () => {
    if (!user) return;
    const vetId = getVetId(user);
    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .eq("vet_id", vetId)
      .in("status", ["approved", "Adopted"]); // FIX: fetch both
    if (!error) setHistory(data || []);
  };

  const handleApprove = async (postId: number) => {
    if (!user) return;
    const healthNote = note[postId] !== undefined ? note[postId] : "";
    // Preserve existing health_info (which may include vaccination proof)
    const { data: existingPost } = await supabase
      .from("posts")
      .select("health_info")
      .eq("id", postId)
      .single();

    let newHealthInfo: string | undefined = existingPost?.health_info ?? undefined;
    if (healthNote && healthNote.trim().length > 0) {
      newHealthInfo = newHealthInfo
        ? `${healthNote}\n\n${newHealthInfo}`
        : healthNote;
    }

    const updatePayload: Record<string, unknown> = {
      status: "approved",
      vet_id: getVetId(user),
    };
    if (typeof newHealthInfo === "string") {
      updatePayload.health_info = newHealthInfo;
    }

    const { data, error } = await supabase
      .from("posts")
      .update(updatePayload)
      .eq("id", postId);

    console.log("Update result:", { data, error });

    if (!error) {
      toast.success("Post approved!");
      setPendingPosts((prev) => prev.filter((post) => post.id !== postId));
      setLoading(true);
      await fetchPendingPosts();
      await fetchHistory();
      setLoading(false);
    } else {
      console.error(error);
      toast.error("Failed to approve");
    }
  };

  const handleReject = async (postId: number) => {
    if (!user) return;
    const healthNote = note[postId] !== undefined ? note[postId] : "";
    // Preserve existing health_info (which may include vaccination proof)
    const { data: existingPost } = await supabase
      .from("posts")
      .select("health_info")
      .eq("id", postId)
      .single();

    let newHealthInfo: string | undefined = existingPost?.health_info ?? undefined;
    if (healthNote && healthNote.trim().length > 0) {
      newHealthInfo = newHealthInfo
        ? `${healthNote}\n\n${newHealthInfo}`
        : healthNote;
    }

    const updatePayload: Record<string, unknown> = {
      status: "rejected",
      vet_id: getVetId(user),
    };
    if (typeof newHealthInfo === "string") {
      updatePayload.health_info = newHealthInfo;
    }

    const { error } = await supabase
      .from("posts")
      .update(updatePayload)
      .eq("id", postId);
    if (!error) {
      toast.success("Post rejected.");
      setPendingPosts((prev) => prev.filter((post) => post.id !== postId));
      setLoading(true);
      await fetchPendingPosts();
      await fetchHistory();
      setLoading(false);
    } else toast.error("Failed to reject");
  };

  // Modal component
  const PostPreviewModal = ({
    post,
    onClose,
  }: {
    post: Post;
    onClose: () => void;
  }) => {
    // Extract image URLs from health_info (simple regex for http(s) links ending in .jpg/.jpeg/.png/.webp)
    let proofImages: string[] = [];
    if (post.health_info) {
      const urlRegex = /(https?:\/\/[^\s]+\.(?:jpg|jpeg|png|webp))/gi;
      proofImages = [...post.health_info.matchAll(urlRegex)].map((m) => m[0]);
    }
    return (
      <>
        {/* Animation style for modal */}
        <style>{`
          @keyframes fadeInScale {
            0% { opacity: 0; transform: scale(0.95); }
            100% { opacity: 1; transform: scale(1); }
          }
          .fade-in-scale {
            animation: fadeInScale 0.3s ease;
          }
        `}</style>
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Blurred, semi-transparent background */}
          <div
            className="absolute inset-0 bg-white/50 backdrop-blur-sm transition-opacity duration-300"
            onClick={onClose}
          />
          {/* Modal content with animation */}
          <div className="relative bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto overflow-x-hidden shadow-lg fade-in-scale">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
            >
              <FaTimes className="text-xl" />
            </button>
            <h2 className="text-2xl font-bold mb-4 text-violet-800">
              {post.name}
            </h2>
            <div className="flex flex-col md:flex-row gap-6 mb-4">
              <div className="flex-shrink-0 flex justify-center items-center">
                {post.image_url ? (
                  <img
                    src={post.image_url}
                    alt={post.name}
                    className="w-40 h-40 object-cover rounded-lg"
                  />
                ) : (
                  <div className="w-40 h-40 flex items-center justify-center bg-gray-200 rounded text-gray-500">
                    No image
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-2 min-w-0 break-words">
                <div>
                  <span className="font-medium">Content:</span>{" "}
                  <span className="text-gray-700">{post.content || "-"}</span>
                </div>
                <div>
                  <span className="font-medium">Breed:</span>{" "}
                  <span className="text-gray-700">{post.breed || "-"}</span>
                </div>
                <div>
                  <span className="font-medium">Age:</span>{" "}
                  <span className="text-gray-700">{post.age || "-"}</span>
                </div>
                <div>
                  <span className="font-medium">Location:</span>{" "}
                  <span className="text-gray-700">{post.location || "-"}</span>
                </div>
                <div>
                  <span className="font-medium">Size:</span>{" "}
                  <span className="text-gray-700">{post.size || "-"}</span>
                </div>
                <div>
                  <span className="font-medium">Temperament:</span>{" "}
                  <span className="text-gray-700">
                    {Array.isArray(post.temperament)
                      ? post.temperament.join(", ")
                      : post.temperament || "-"}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Vaccination Status:</span>{" "}
                  <span className="text-gray-700">
                    {post.vaccination_status ? "Vaccinated" : "Not Vaccinated"}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Health Info:</span>{" "}
                  <span className="text-gray-700">
                    {post.health_info
                      ? post.health_info
                          .replace(
                            /https?:\/\/[^\s]+\.(jpg|jpeg|png|webp)/gi,
                            ""
                          )
                          .replace(/\s+/g, " ")
                          .trim()
                      : "-"}
                  </span>
                </div>
                {proofImages.length > 0 && (
                  <div className="mt-2">
                    {/* <span className="font-medium">Vaccination Proof:</span> */}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {proofImages.map((url, idx) => (
                        <img
                          key={idx}
                          src={url}
                          alt={`Vaccination Proof ${idx + 1}`}
                          className="w-32 h-32 object-cover rounded border"
                        />
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <span className="font-medium">Status:</span>{" "}
                  <span className="text-gray-700">{post.status}</span>
                </div>
                <div>
                  <span className="font-medium">Created At:</span>{" "}
                  <span className="text-gray-700">
                    {post.created_at
                      ? new Date(post.created_at).toLocaleString()
                      : "-"}
                  </span>
                </div>
              </div>
            </div>
            {post.additional_photos && post.additional_photos.length > 0 && (
              <div className="mb-2">
                <span className="font-medium">Additional Photos:</span>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {post.additional_photos.map((url: string, idx: number) => (
                    <img
                      key={idx}
                      src={url}
                      alt={`Additional ${idx + 1}`}
                      className="w-20 h-20 object-cover rounded"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </>
    );
  };

  const handleAssessmentToggle = (userId: string, hasAssessment: boolean) => {
    if (!hasAssessment) return;
    setExpandedUser((prev) => (prev === userId ? null : userId));
    setViewedAssessments((prev) =>
      prev[userId] ? prev : { ...prev, [userId]: true }
    );
  };

  if (role !== "vet")
    return <div className="p-8 text-center text-red-500">Access denied.</div>;

  return (
    <>
      <VetNavbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex min-h-screen bg-gray-50 pt-16">
        <VetSidebar 
          activeSection={activeSection} 
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <main className="flex-1 md:ml-64 p-4 md:p-8">
          {/* Pending Users Section */}
          <div
            ref={pendingUsersRef}
            id="pending-users"
            className="bg-white rounded-lg shadow-md p-8 mb-8 w-full"
          >
            <h1 className="text-2xl font-bold mb-6 text-violet-800">
              Pending User Approvals
            </h1>
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-violet-600"></div>
              </div>
            ) : pendingUsers.length === 0 ? (
              <div className="text-gray-500">No pending user approvals.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Joined
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Assessment
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {pendingUsers.map((user) => (
                      <React.Fragment key={user.user_id}>
                        <tr>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {user.full_name || "Unknown"}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500">
                              {user.email || "N/A"}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(user.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            {user.adoption_validation ? (
                              <button
                                onClick={() =>
                                  handleAssessmentToggle(
                                    user.user_id,
                                    !!user.adoption_validation
                                  )
                                }
                                className="text-blue-600 hover:text-blue-900 underline"
                              >
                                {expandedUser === user.user_id ? "Hide" : "View"} Assessment
                              </button>
                            ) : (
                              <span className="text-gray-400 text-xs">N/A</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            {!user.adoption_validation && (
                              <div className="text-xs text-gray-400 mb-1">
                                Awaiting assessment
                              </div>
                            )}
                            <div className="flex flex-col sm:flex-row gap-2">
                              <button
                                disabled={
                                  !user.adoption_validation ||
                                  !viewedAssessments[user.user_id]
                                }
                                onClick={() => handleVerifyUser(user.user_id)}
                                className={`flex-1 bg-green-500 text-white px-4 py-2 rounded transition-colors ${
                                  !user.adoption_validation || !viewedAssessments[user.user_id]
                                    ? "opacity-50 cursor-not-allowed"
                                    : "hover:bg-green-600"
                                }`}
                              >
                                Verify
                              </button>
                              <button
                                onClick={() => handleDeclineUserClick(user)}
                                className="flex-1 bg-red-500 text-white px-4 py-2 rounded transition-colors hover:bg-red-600"
                              >
                                Decline
                              </button>
                            </div>
                            {!viewedAssessments[user.user_id] &&
                              user.adoption_validation && (
                                <div className="text-xs text-yellow-600 mt-1">
                                  Review assessment to enable verification
                                </div>
                              )}
                          </td>
                        </tr>
                        {expandedUser === user.user_id && user.adoption_validation && (
                          <tr>
                            <td colSpan={5} className="bg-gray-50 px-6 py-4">
                              <h4 className="font-semibold mb-2">Assessment Answers</h4>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {(() => {
                                  try {
                                    // Handle both object and string JSONB
                                    const validation = typeof user.adoption_validation === 'string' 
                                      ? JSON.parse(user.adoption_validation) 
                                      : user.adoption_validation;
                                    
                                    if (!validation || typeof validation !== 'object') {
                                      return <div className="text-gray-500">No assessment data available</div>;
                                    }
                                    
                                    return Object.entries(validation).map(([question, answer]) => (
                                      <div key={question} className="py-1">
                                        <span className="font-medium text-gray-700">
                                          {question.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:
                                        </span>{" "}
                                        <span className="text-gray-600">{String(answer)}</span>
                                      </div>
                                    ));
                                  } catch (error) {
                                    console.error("Error parsing assessment data:", error);
                                    return <div className="text-red-500">Error displaying assessment data</div>;
                                  }
                                })()}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pending Pet Listings Section */}
          <div
            ref={pendingRef}
            id="pending"
            className="bg-white rounded-lg shadow-md p-8 mb-8 w-full"
          >
            <h1 className="text-2xl font-bold mb-6 text-violet-800">
              Vet Dashboard
            </h1>
            <h2 className="text-xl font-semibold mb-4 text-violet-700">
              Pending Pet Listings
            </h2>
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-violet-600"></div>
              </div>
            ) : pendingPosts.length === 0 ? (
              <div className="text-gray-500">No pending posts.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 mb-8">
                {pendingPosts.map((post) => (
                  <div
                    key={post.id}
                    className="bg-violet-50 rounded-lg shadow p-4 flex flex-col"
                  >
                    <div className="flex justify-center mb-2">
                      {post.image_url ? (
                        <img
                          src={post.image_url}
                          alt={post.name}
                          className="w-28 h-28 object-cover rounded"
                        />
                      ) : (
                        <div className="w-28 h-28 flex items-center justify-center bg-gray-200 rounded text-gray-500">
                          No image
                        </div>
                      )}
                    </div>
                    <div className="font-semibold text-lg text-violet-900 text-center mb-2">
                      {post.name}
                    </div>
                    <textarea
                      className="border rounded p-2 w-full mb-3"
                      value={note[post.id] || ""}
                      onChange={(e) =>
                        setNote((n) => ({ ...n, [post.id]: e.target.value }))
                      }
                      placeholder="Add health notes..."
                    />
                    <div className="flex gap-2 mt-auto mb-2">
                      <button
                        onClick={() => handleApprove(post.id)}
                        className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600 w-1/2 flex items-center justify-center"
                        aria-label="Approve"
                      >
                        <FaCheck className="text-lg" />
                      </button>
                      <button
                        onClick={() => handleReject(post.id)}
                        className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 w-1/2 flex items-center justify-center"
                        aria-label="Reject"
                      >
                        <FaTimes className="text-lg" />
                      </button>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedPost(post);
                        setShowModal(true);
                      }}
                      className="mt-2 bg-violet-600 text-white px-3 py-1 rounded hover:bg-violet-700 transition-colors"
                    >
                      Preview
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div
            ref={historyRef}
            id="history"
            className="bg-white rounded-lg shadow-md p-8 w-full"
          >
            <h2 className="text-xl font-semibold mb-4 text-violet-700">
              Adoption History
            </h2>
            {history.length === 0 ? (
              <div className="text-gray-500">No adoption history.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {history.map((post) => (
                  <div
                    key={post.id}
                    className="bg-violet-50 rounded-lg shadow p-4 flex flex-col"
                  >
                    <div className="flex justify-center mb-2">
                      {post.image_url ? (
                        <img
                          src={post.image_url}
                          alt={post.name}
                          className="w-28 h-28 object-cover rounded"
                        />
                      ) : (
                        <div className="w-28 h-28 flex items-center justify-center bg-gray-200 rounded text-gray-500">
                          No image
                        </div>
                      )}
                    </div>
                    <div className="font-semibold text-lg text-violet-900 text-center mb-2">
                      {post.name}
                    </div>
                    <div className="mb-2">
                      <span className="font-medium">Health Notes: </span>
                      <span className="text-gray-700">
                        {post.health_info || "-"}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">Status: </span>
                      <span className="text-violet-700">{post.status}</span>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedPost(post);
                        setShowModal(true);
                      }}
                      className="mt-2 bg-violet-600 text-white px-3 py-1 rounded hover:bg-violet-700 transition-colors"
                    >
                      Preview
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          {showModal && selectedPost && (
            <PostPreviewModal
              post={selectedPost}
              onClose={() => setShowModal(false)}
            />
          )}
          {showDeclineModal && userToDecline && (
            <DeclineUserModal
              isOpen={showDeclineModal}
              onClose={() => {
                setShowDeclineModal(false);
                setUserToDecline(null);
              }}
              onConfirm={handleDeclineUser}
              userName={userToDecline.full_name}
            />
          )}
        </main>
      </div>
    </>
  );
}
