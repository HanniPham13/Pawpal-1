import { useState, useEffect } from "react";
import { supabase } from "../supabase-client";
import {
  FaCheck,
  FaTimes,
  FaUser,
  FaCalendarAlt,
  FaMapMarkerAlt,
} from "react-icons/fa";
import { toast } from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

interface AdoptionRequestDetailsProps {
  requestId: number;
  onClose: () => void;
  onStatusChange: () => void;
}

interface PostData {
  name: string;
  image_url: string;
}

interface RequesterData {
  id: string;
  full_name: string;
  avatar_url?: string;
  location?: string;
  email: string;
}

interface AdoptionRequest {
  id: number;
  post_id: number;
  requester_id: string;
  owner_id: string;
  status: string;
  created_at: string;
  updated_at?: string;
  adoption_reason?: string;
  post?: PostData;
}

// Utility function to create adoption chat
const createAdoptionChat = async ({
  adopterId,
  ownerId,
  postId,
  adopterName,
  ownerName,
  petName,
}: {
  adopterId: string;
  ownerId: string;
  postId: number;
  adopterName: string;
  ownerName?: string;
  petName?: string;
}) => {
  const { data: existing, error: existingError } = await supabase
    .rpc('find_shared_conversation', {
      user_id_1: ownerId,
      user_id_2: adopterId,
      specific_post_id: postId,
    });
  if (!existingError && existing && existing.length > 0) return existing[0].conversation_id;
  
  // Generate UUID client-side to avoid SELECT RLS issue after INSERT
  const conversationId = crypto.randomUUID();
  const { error } = await supabase
    .from("conversations")
    .insert([
      {
        id: conversationId,
        title: adopterName,
        post_id: postId,
        adopter_name: adopterName,
        owner_name: ownerName || "",
        pet_name: petName,
        is_group: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);
  if (error) throw error;
  await supabase.from("user_conversations").insert([
    { user_id: adopterId, conversation_id: conversationId, joined_at: new Date().toISOString() },
    { user_id: ownerId, conversation_id: conversationId, joined_at: new Date().toISOString() },
  ]);
  return conversationId;
};

export const AdoptionRequestDetails: React.FC<AdoptionRequestDetailsProps> = ({
  requestId,
  onClose,
  onStatusChange,
}) => {
  const [request, setRequest] = useState<AdoptionRequest | null>(null);
  const [requester, setRequester] = useState<RequesterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchRequestDetails = async () => {
      setLoading(true);
      try {
        // Fetch the adoption request without using relationship shorthand
        // Use maybeSingle() instead of single() to avoid errors when no record is found
        const { data: requestData, error: requestError } = await supabase
          .from("adoption_requests")
          .select("*")
          .eq("id", requestId)
          .maybeSingle();

        if (requestError) throw requestError;

        // If no request data found, throw a user-friendly error
        if (!requestData) {
          throw new Error("Adoption request not found or has been deleted");
        }

        // Fetch post details separately
        if (requestData.post_id) {
          const { data: postData, error: postError } = await supabase
            .from("posts")
            .select("name, image_url")
            .eq("id", requestData.post_id)
            .maybeSingle();

          if (!postError && postData) {
            requestData.post = postData;
          }
        }

        setRequest(requestData);

        // Fetch requester details
        if (requestData.requester_id) {
          try {
            // First try to get user profile from the profiles table
            const { data: profileData, error: profileError } = await supabase
              .from("profiles")
              .select("id, full_name, avatar_url, location")
              .eq("id", requestData.requester_id)
              .maybeSingle();

            if (!profileError && profileData) {
              // Use profile data
              setRequester({
                id: profileData.id,
                full_name: profileData.full_name || "Name not provided",
                avatar_url: profileData.avatar_url,
                location: profileData.location,
                // We don't include email for privacy
                email: "Contact via app messaging",
              });
            } else if (profileError && profileError.code === "42P01") {
              // If profiles table doesn't exist, try to get user data directly
              const { data: userData, error: userError } = await supabase.rpc(
                "get_user_name",
                { user_id: requestData.requester_id }
              );

              if (!userError && userData) {
                // Use data from auth.users
                setRequester({
                  id: requestData.requester_id,
                  full_name: userData || "User",
                  email: "Contact via app messaging",
                });
              } else {
                // Fallback to minimal info
                setRequester({
                  id: requestData.requester_id,
                  full_name: "User",
                  email: "Contact information not available",
                });
              }
            } else {
              // Fallback to minimal info
              setRequester({
                id: requestData.requester_id,
                full_name: "User",
                email: "Contact information not available",
              });
            }
          } catch (userError) {
            console.error("Error fetching user details:", userError);
            // Fallback to minimal info
            setRequester({
              id: requestData.requester_id,
              full_name: "User",
              email: "Contact information not available",
            });
          }
        }
      } catch (error: unknown) {
        console.error("Error fetching request details:", error);
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Failed to load request details";
        toast.error(errorMessage);
        // Close the modal after showing error
        setTimeout(() => {
          onClose();
        }, 3000);
      } finally {
        setLoading(false);
      }
    };

    if (requestId) {
      fetchRequestDetails();
    }
  }, [requestId, onClose]);

  const handleStatusUpdate = async (status: "approved" | "rejected") => {
    if (!request || !user) return;

    setProcessing(true);
    try {
      // Update request status
      const { error: updateError } = await supabase
        .from("adoption_requests")
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      if (updateError) throw updateError;

      // If approved, also update post status to 'adopted'
      if (status === "approved") {
        // Change pet status to adopted
        const { error: postError } = await supabase
          .from("posts")
          .update({ status: "adopted" })
          .eq("id", request?.post_id);
        if (postError) throw postError;

        // Get owner (current user) name - try profiles, users table, then RPC
        let currentOwnerName = "";
        try {
          const { data: profile } = await supabase
            .from("profiles").select("full_name").eq("id", user.id).maybeSingle();
          if (profile?.full_name && profile.full_name !== "Unknown") {
            currentOwnerName = profile.full_name;
          } else {
            const { data: userData } = await supabase
              .from("users").select("full_name").eq("user_id", user.id).maybeSingle();
            if (userData?.full_name && userData.full_name !== "Unknown") {
              currentOwnerName = userData.full_name;
            } else {
              try {
                const { data: nameData } = await supabase.rpc("get_user_display_name", {
                  target_user_id: user.id,
                });
                if (nameData) currentOwnerName = nameData;
              } catch { /* RPC may not exist */ }
            }
          }
        } catch { /* ignore */ }

        // Get adopter name - try provided name, profiles, users table, then RPC
        let adopterDisplayName = requester?.full_name || "";
        if (!adopterDisplayName || adopterDisplayName === "User" || adopterDisplayName === "Name not provided" || adopterDisplayName === "Unknown") {
          try {
            const { data: profile } = await supabase
              .from("profiles").select("full_name").eq("id", request.requester_id).maybeSingle();
            if (profile?.full_name && profile.full_name !== "Unknown") {
              adopterDisplayName = profile.full_name;
            } else {
              const { data: userData } = await supabase
                .from("users").select("full_name").eq("user_id", request.requester_id).maybeSingle();
              if (userData?.full_name && userData.full_name !== "Unknown") {
                adopterDisplayName = userData.full_name;
              } else {
                try {
                  const { data: nameData } = await supabase.rpc("get_user_display_name", {
                    target_user_id: request.requester_id,
                  });
                  if (nameData) adopterDisplayName = nameData;
                } catch { /* RPC may not exist */ }
              }
            }
          } catch { /* ignore */ }
        }

        const conversationId = await createAdoptionChat({
          adopterId: request.requester_id,
          ownerId: request.owner_id,
          postId: request.post_id,
          adopterName: adopterDisplayName || "User",
          ownerName: currentOwnerName,
          petName: request.post?.name,
        });
        toast.success("Adoption approved! Redirecting to chat...");
        onStatusChange();
        onClose();
        // Navigate to chat after a short delay
        setTimeout(() => {
          navigate(`/chat/${conversationId}`);
        }, 500);
        return; // Exit early to prevent double navigation
      }

      // Create notification for requester (status is "rejected" at this point)
      const message = `Your adoption request for ${
        request.post?.name || "the pet"
      } has been rejected.`;

      const { error: notificationError } = await supabase
        .from("notifications")
        .insert([
          {
            user_id: request.requester_id,
            type: `adoption_${status}`,
            message,
            read: false,
            created_at: new Date().toISOString(),
            link: `/post/${request.post_id}`,
            post_id: request.post_id,
          },
        ]);

      if (notificationError) {
        console.error("Error creating notification:", notificationError);
      }

      toast.success("Adoption request rejected successfully");
      onStatusChange();
      onClose();
    } catch (error: unknown) {
      const action = status === "approved" ? "approving" : "rejecting";
      console.error(`Error ${action} request:`, error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : `Failed to ${status === "approved" ? "approve" : "reject"} request. Please try again.`;
      toast.error(errorMessage);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 shadow-xl">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-4  border-r-4 border-violet-300"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!request || !requester) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 shadow-xl">
          <h2 className="text-xl font-semibold text-red-500 font-['Quicksand']">
            Error
          </h2>
          <p className="text-gray-600 font-['Poppins']">
            Failed to load request details. Please try again.
          </p>
          <div className="mt-6 text-right">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 rounded-lg text-gray-800 font-medium font-['Poppins']"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 shadow-xl border border-violet-100">
        {/* Header */}
        <div className="border-b border-violet-100 pb-4 mb-4">
          <h2 className="text-2xl font-bold text-violet-800 font-['Quicksand']">
            Adoption Request
          </h2>
          <p className="text-gray-600 font-['Poppins']">
            {request.post?.name
              ? `For ${request.post.name}`
              : "Pet adoption request"}
          </p>
        </div>

        {/* Pet Info */}
        {request.post?.image_url && (
          <div className="flex items-center gap-4 mb-6 bg-violet-50 p-3 rounded-xl">
            <img
              src={request.post.image_url}
              alt={request.post.name || "Pet"}
              className="w-20 h-20 object-cover rounded-lg border border-violet-200"
            />
            <div>
              <h3 className="text-lg font-semibold text-violet-800 font-['Quicksand']">
                {request.post.name || "Unnamed Pet"}
              </h3>
              <div className="text-sm text-violet-600 font-['Poppins']">
                <span
                  className={`inline-block px-2 py-1 rounded-full text-xs ${
                    request.status === "pending"
                      ? "bg-yellow-100 text-yellow-800"
                      : request.status === "approved" || status === "rejected"
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  Status:{" "}
                  {request.status.charAt(0).toUpperCase() +
                    request.status.slice(1)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Requester Info */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-violet-800 mb-3 font-['Quicksand'] flex items-center">
            <FaUser className="mr-2 text-violet-500" />
            Requester Information
          </h3>
          <div className="bg-violet-50 p-4 rounded-xl space-y-2 font-['Poppins']">
            <div className="flex items-center mb-3">
              {requester.avatar_url ? (
                <img
                  src={requester.avatar_url}
                  alt="Requester"
                  className="w-14 h-14 rounded-full object-cover border-2 border-violet-300 mr-3"
                />
              ) : (
                <div className="w-14 h-14 bg-violet-200 rounded-full flex items-center justify-center mr-3">
                  <FaUser className="text-violet-600 text-xl" />
                </div>
              )}
              <div>
                <p className="font-medium text-lg text-violet-700">
                  {requester.full_name || "Anonymous User"}
                </p>
                {requester.location && (
                  <p className="text-sm text-violet-500 flex items-center">
                    <FaMapMarkerAlt className="mr-1" />
                    {requester.location}
                  </p>
                )}
              </div>
            </div>

            <p className="text-violet-700">
              <span className="font-medium">Contact:</span>
              <span className="ml-2">{requester.email || "Not available"}</span>
            </p>

            <p className="flex items-center text-violet-700">
              <FaCalendarAlt className="mr-2 text-violet-500" />
              <span className="font-medium">Request Date:</span>
              <span className="ml-2">
                {new Date(request.created_at).toLocaleDateString()}
              </span>
            </p>
          </div>
        </div>

        {/* Adoption Reason */}
        {request.adoption_reason && request.adoption_reason.trim().length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-violet-800 mb-3 font-['Quicksand']">
              Adoption Reason
            </h3>
            <div className="bg-violet-50 p-4 rounded-xl font-['Poppins'] text-gray-700 whitespace-pre-wrap">
              {request.adoption_reason}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="border-t border-violet-100 pt-4 flex justify-between items-center">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 rounded-lg text-gray-800 font-medium hover:bg-gray-300 transition-colors font-['Poppins']"
          >
            Close
          </button>

          {request.status === "pending" && (
            <div className="flex gap-3">
              <button
                onClick={() => handleStatusUpdate("rejected")}
                disabled={processing}
                className="px-4 py-2 bg-gradient-to-r from-red-500 to-pink-500 rounded-lg text-white font-medium hover:from-red-600 hover:to-pink-600 transition-colors flex items-center gap-2 font-['Poppins'] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FaTimes />
                Deny
              </button>
              <button
                onClick={() => handleStatusUpdate("approved")}
                disabled={processing}
                className="px-4 py-2 bg-gradient-to-r from-green-500 to-teal-500 rounded-lg text-white font-medium hover:from-green-600 hover:to-teal-600 transition-colors flex items-center gap-2 font-['Poppins'] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FaCheck />
                Approve
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
