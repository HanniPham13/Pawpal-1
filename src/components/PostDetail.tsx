import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase-client";
import { Post } from "./PostList";
import {
  FaMapMarkerAlt,
  FaSyringe,
  FaRuler,
  FaArrowLeft,
  FaHeartbeat,
  FaClock,
  FaHandHoldingHeart,
  FaEnvelope,
} from "react-icons/fa";
import { MdPets } from "react-icons/md";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "react-hot-toast";
import { AdoptionRequestsList } from "./AdoptionRequestsList";
import { MessageButton } from "./MessageButton";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DeleteModalProps extends ModalProps {
  onConfirm: () => void;
}

interface UpdateModalProps extends ModalProps {
  post: Post | null;
  onUpdate: (updates: { name: string; content: string; status?: string; pet_type?: Post["pet_type"] }) => void;
}

const DeleteConfirmationModal: React.FC<DeleteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-lg p-4 sm:p-6 lg:p-8 shadow-2xl max-w-md w-full">
        <h2 className="text-xl font-bold mb-4">Confirm Deletion</h2>
        <p>
          Are you sure you want to delete this post? This action cannot be
          undone.
        </p>
        <div className="flex justify-end gap-4 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

const UpdatePostModal: React.FC<UpdateModalProps> = ({
  isOpen,
  onClose,
  post,
  onUpdate,
}) => {
  const [name, setName] = useState(post?.name ?? "");
  const [content, setContent] = useState(post?.content ?? "");
  const [status, setStatus] = useState(post?.status || "approved");
  const [petType, setPetType] = useState<Post["pet_type"]>(post?.pet_type);

  useEffect(() => {
    if (post) {
      setName(post.name ?? "");
      setContent(post.content ?? "");
      setStatus(post.status || "approved");
      setPetType(post.pet_type);
    }
  }, [post]);

  if (!isOpen || !post) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate({ name, content, status, pet_type: petType });
  };

  const handleSave = () => {
    onUpdate({ name, content, status, pet_type: petType });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-lg p-4 sm:p-6 lg:p-8 shadow-2xl relative max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 text-2xl font-bold p-2"
        >
          &times;
        </button>
        <h2 className="text-xl font-bold mb-4">Update Post</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="name" className="block font-semibold mb-2">
              Name
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-2 border rounded"
            />
          </div>
          <div className="mb-4">
            <label htmlFor="content" className="block font-semibold mb-2">
              Content
            </label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full p-2 border rounded"
              rows={5}
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Pet Type
            </label>
            <select
              value={petType || ""}
              onChange={(e) =>
                setPetType(
                  (e.target.value as Post["pet_type"]) || undefined
                )
              }
              className="w-full px-4 py-2 border rounded-lg"
            >
              <option value="">Not specified</option>
              <option value="Dog">Dog</option>
              <option value="Cat">Cat</option>
              <option value="Rabbit">Rabbit</option>
              <option value="Bird">Bird</option>
              <option value="Guinea Pig">Guinea Pig</option>
              <option value="Hamster">Hamster</option>
            </select>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Adoption Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg"
            >
              <option value="approved">Available for Adoption</option>
              <option value="adopted">Adopted</option>
            </select>
          </div>
          <div className="flex justify-end gap-4 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600"
            >
              Update
            </button>
          </div>
        </form>
        <button
          onClick={handleSave}
          className="mt-6 w-full bg-violet-600 text-white py-2 rounded font-semibold hover:bg-violet-700"
        >
          Save Changes
        </button>
      </div>
    </div>
  );
};

const fetchPostById = async (postId: number): Promise<Post> => {
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("id", postId)
    .single();

  if (error) throw error;
  return data;
};

const deletePost = async (post: Post) => {
  try {
    // Delete adoption requests first to avoid foreign key violations
    const { error: adoptionRequestsError } = await supabase
      .from("adoption_requests")
      .delete()
      .eq("post_id", post.id);

    if (adoptionRequestsError) throw new Error(adoptionRequestsError.message);

    // First delete all comments for this post
    // The line below is commented out to prevent a crash due to a suspected schema mismatch.
    // The 'comments' table seems to expect a UUID for 'post_id', but the post ID is an integer.
    // const { error: commentsError } = await supabase
    //   .from("comments")
    //   .delete()
    //   .eq("post_id", post.id);

    // if (commentsError) throw new Error(commentsError.message);

    // Delete all votes for this post
    // The line below is commented out to prevent a crash due to a suspected schema mismatch.

    // Delete the main image
    if (post.image_url) {
      const mainImagePath = post.image_url.split("/").pop();
      if (mainImagePath) {
        await supabase.storage.from("post-images").remove([mainImagePath]);
      }
    }

    // Delete additional photos
    if (post.additional_photos) {
      const additionalImagePaths = post.additional_photos.map((url) =>
        url.split("/").pop()
      );
      await supabase.storage
        .from("post-images")
        .remove(additionalImagePaths.filter(Boolean) as string[]);
    }

    // Delete vaccination proof if it exists in health_info
    const vaccinationProofMatch = post.health_info?.match(
      /Vaccination Proof:\s+(https?:\/\/\S+)/i
    );
    if (vaccinationProofMatch) {
      const vaccinationProofPath = vaccinationProofMatch[1].split("/").pop();
      if (vaccinationProofPath) {
        await supabase.storage
          .from("post-images")
          .remove([vaccinationProofPath]);
      }
    }

    // Finally, delete the post record
    const { error: postError } = await supabase
      .from("posts")
      .delete()
      .eq("id", post.id);

    if (postError) throw new Error(postError.message);
  } catch (error) {
    console.error("Error in deletePost:", error);
    throw error;
  }
};

const updatePost = async (postId: number, updates: Partial<Post>) => {
  const { error } = await supabase
    .from("posts")
    .update(updates)
    .eq("id", postId);
  if (error) throw error;
};

// Utility function to create adoption chat (shared between PostDetail and AdoptionRequestDetails)
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
  // Check for existing conversation
  const { data: existing, error: existingError } = await supabase
    .rpc('find_shared_conversation', {
      user_id_1: ownerId,
      user_id_2: adopterId,
      specific_post_id: postId,
    });
  if (!existingError && existing && existing.length > 0) return existing[0].conversation_id;
  
  // Generate UUID client-side so we don't need SELECT after INSERT
  // (the SELECT RLS policy on conversations requires the user to be in user_conversations,
  // but we haven't added them yet — a chicken-and-egg problem)
  const conversationId = crypto.randomUUID();
  
  // Create new conversation without .select() to avoid RLS SELECT policy issue
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
  
  // Add both users to conversation
  await supabase.from("user_conversations").insert([
    { user_id: adopterId, conversation_id: conversationId, joined_at: new Date().toISOString() },
    { user_id: ownerId, conversation_id: conversationId, joined_at: new Date().toISOString() },
  ]);
  return conversationId;
};

// Add adoption request function
const sendAdoptionRequest = async (
  postId: number,
  requesterId: string,
  ownerId: string,
  petName: string,
  reason?: string
) => {
  try {
    // First check if there's already a pending request
    const { data: existingRequests, error: checkError } = await supabase
      .from("adoption_requests")
      .select("*")
      .eq("post_id", postId)
      .eq("requester_id", requesterId);

    if (checkError) {
      console.error("Error checking existing requests:", checkError);
      throw new Error(checkError.message || "Failed to check existing requests");
    }

    if (existingRequests && existingRequests.length > 0) {
      throw new Error("You already have a pending request for this pet");
    }

    // If no existing request, create a new one (send minimal required fields)
    const insertData: Record<string, unknown> = {
      post_id: postId,
      requester_id: requesterId,
      owner_id: ownerId,
      status: "pending",
    };
    if (reason) {
      insertData.adoption_reason = reason;
    }

    const { data, error } = await supabase
      .from("adoption_requests")
      .insert([insertData])
      .select("*");

    if (error) {
      console.error("Error creating adoption request:", error);
      throw new Error(error.message || "Failed to create adoption request");
    }

    // Also create a notification for the pet owner
    try {
      await supabase
        .from("notifications")
        .insert([{
          user_id: ownerId,
          type: "adoption_request",
          message: `New adoption request for ${petName}${reason ? ` - Reason: ${reason}` : ""}`,
          created_at: new Date().toISOString(),
          is_read: false,
          link: `/post/${postId}`,
          post_id: postId,
        }]);
    } catch (notifErr) {
      console.error("Error creating notification:", notifErr);
    }

    // Create chat immediately after submitting adoption request
    try {
      // Get adopter name - try profiles, users table, then RPC
      let requesterName = "User";
      try {
        const { data: profile } = await supabase
          .from("profiles").select("full_name").eq("id", requesterId).maybeSingle();
        if (profile?.full_name && profile.full_name !== "Unknown") {
          requesterName = profile.full_name;
        } else {
          const { data: userData } = await supabase
            .from("users").select("full_name").eq("user_id", requesterId).maybeSingle();
          if (userData?.full_name && userData.full_name !== "Unknown") {
            requesterName = userData.full_name;
          } else {
            try {
              const { data: nameData } = await supabase.rpc("get_user_display_name", {
                target_user_id: requesterId,
              });
              if (nameData) requesterName = nameData;
            } catch { /* RPC may not exist */ }
          }
        }
      } catch { /* ignore */ }

      // Get owner name - try profiles, users table, then RPC
      let ownerDisplayName = "";
      try {
        const { data: profile } = await supabase
          .from("profiles").select("full_name").eq("id", ownerId).maybeSingle();
        if (profile?.full_name && profile.full_name !== "Unknown") {
          ownerDisplayName = profile.full_name;
        } else {
          const { data: userData } = await supabase
            .from("users").select("full_name").eq("user_id", ownerId).maybeSingle();
          if (userData?.full_name && userData.full_name !== "Unknown") {
            ownerDisplayName = userData.full_name;
          } else {
            try {
              const { data: nameData } = await supabase.rpc("get_user_display_name", {
                target_user_id: ownerId,
              });
              if (nameData) ownerDisplayName = nameData;
            } catch { /* RPC may not exist */ }
          }
        }
      } catch { /* ignore */ }

      const conversationId = await createAdoptionChat({
        adopterId: requesterId,
        ownerId: ownerId,
        postId: postId,
        adopterName: requesterName,
        ownerName: ownerDisplayName,
        petName: petName,
      });
      
      return { conversationId };
    } catch (chatError) {
      console.error("Error creating chat:", chatError);
      // Don't throw - adoption request was successful, chat creation is optional
    }

    return data;
  } catch (error) {
    console.error("Error sending adoption request:", error);
    throw error;
  }
};

// Add function to cancel adoption request
const cancelAdoptionRequest = async (postId: number, requesterId: string) => {
  try {
    // Find the request to delete
    const { data: existingRequests, error: findError } = await supabase
      .from("adoption_requests")
      .select("*")
      .eq("post_id", postId)
      .eq("requester_id", requesterId);

    if (findError) {
      console.error("Error finding adoption request to cancel:", findError);
      throw new Error(findError.message || "Failed to find adoption request");
    }

    if (!existingRequests || existingRequests.length === 0) {
      throw new Error("No adoption request found to cancel");
    }

    // Delete the request
    const { error: deleteError } = await supabase
      .from("adoption_requests")
      .delete()
      .eq("post_id", postId)
      .eq("requester_id", requesterId);

    if (deleteError) {
      console.error("Error canceling adoption request:", deleteError);
      throw new Error(deleteError.message || "Failed to cancel adoption request");
    }

    // Create a notification for the owner
    try {
      await supabase
        .from("notifications")
        .insert([{
          user_id: existingRequests[0].owner_id,
          type: "adoption_cancelled",
          message: `An adoption request for your pet has been cancelled`,
          created_at: new Date().toISOString(),
          is_read: false,
          link: `/post/${postId}`,
        }]);
    } catch (notifErr) {
      console.error("Error creating cancellation notification:", notifErr);
    }

    return true;
  } catch (error) {
    console.error("Error in cancelAdoptionRequest:", error);
    throw error;
  }
};

const VaccinationProofModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
}> = ({ isOpen, onClose, imageUrl }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-lg p-4 sm:p-6 shadow-2xl relative max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 text-3xl sm:text-5xl font-bold p-2"
          style={{ lineHeight: "1", width: "2rem", height: "2rem" }}
        >
          &times;
        </button>
        <h2 className="text-xl font-bold mb-4">Vaccination Proof</h2>
        <img
          src={imageUrl}
          alt="Vaccination Proof"
          className="w-full h-auto rounded-lg"
        />
      </div>
    </div>
  );
};

// Inline adoption reason modal component
const AdoptionReasonModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  isSubmitting: boolean;
  onSubmit: (reason: string) => void;
}> = ({ isOpen, onClose, isSubmitting, onSubmit }) => {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!isOpen) setReason("");
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(reason.trim());
  };

  return (
    <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-lg p-4 sm:p-6 shadow-2xl relative max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 text-2xl font-bold p-2"
        >
          &times;
        </button>
        <h2 className="text-xl font-bold mb-4">Reason for Adoption</h2>
        <form onSubmit={handleSubmit}>
          <label className="block font-semibold mb-2">
            Tell the owner why you want to adopt this pet
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full p-3 border rounded-lg min-h-28"
            placeholder="e.g., I have experience caring for similar pets and can provide a loving home."
          />
          <div className="flex justify-end gap-3 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || reason.trim().length === 0}
              className="px-4 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {isSubmitting ? "Sending..." : "Send Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const PostDetail = ({ postId }: { postId: string }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isRequesting, setIsRequesting] = useState(false);
  const [hasRequested, setHasRequested] = useState(false);
  const [requestStatus, setRequestStatus] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isVaccinationModalOpen, setIsVaccinationModalOpen] = useState(false);
  const [isAdoptionReasonModalOpen, setIsAdoptionReasonModalOpen] = useState(false);

  // Create refs for sections we want to scroll to
  const adoptionRequestsRef = useRef<HTMLDivElement>(null);

  // Convert postId to number for database queries
  const numericPostId = parseInt(postId, 10);

  // Check if the user has already requested this pet
  const checkExistingRequest = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("adoption_requests")
        .select("*, status")
        .eq("post_id", numericPostId)
        .eq("requester_id", user?.id);

      if (error) {
        console.error("Error checking adoption request:", error);
        return;
      }

      if (data && data.length > 0) {
        setHasRequested(true);
        setRequestStatus(data[0].status);
      } else {
        setHasRequested(false);
        setRequestStatus(null);
      }
    } catch (error) {
      console.error("Error in checkExistingRequest:", error);
    }
  }, [numericPostId, user?.id]);

  useEffect(() => {
    if (user) {
      checkExistingRequest();
    }
  }, [user, checkExistingRequest]);

  const {
    data: post,
    isLoading,
    isError,
  } = useQuery<Post>({
    queryKey: ["post", postId],
    queryFn: () => fetchPostById(numericPostId),
  });

  const [ownerFirstName, setOwnerFirstName] = useState<string | null>(null);
  const [ownerLastName, setOwnerLastName] = useState<string | null>(null);
  const [ownerFullName, setOwnerFullName] = useState<string | null>(null);

  useEffect(() => {
    const fetchOwner = async () => {
      if (!post?.user_id) return;
      // If owner_name is already stored on post, use that
      if (post.owner_name) {
        const fullName = post.owner_name;
        const parts = String(fullName).trim().split(/\s+/);
        const f = parts.shift() || null;
        const l = parts.length > 0 ? parts.join(" ") : null;
        setOwnerFirstName(f);
        setOwnerLastName(l);
        setOwnerFullName(fullName);
        return;
      }
      try {
        const { data: userData, error } = await supabase
          .from("users")
          .select("full_name, avatar_url, user_id")
          .eq("user_id", post.user_id)
          .maybeSingle();

        if (error) {
          console.warn("Error fetching owner by user_id:", error);
        }

        if (userData?.full_name) {
          const fullName = userData.full_name;
          const parts = String(fullName).trim().split(/\s+/);
          const f = parts.shift() || null;
          const l = parts.length > 0 ? parts.join(" ") : null;
          setOwnerFirstName(f);
          setOwnerLastName(l);
          setOwnerFullName(fullName);
        }
      } catch (err) {
        console.error("Unexpected error fetching owner info:", err);
      }
    };

    fetchOwner();
  }, [post?.user_id, post?.owner_name]);

  // Scroll to adoption requests if hash is present in URL
  useEffect(() => {
    if (location.hash === "#adoption-requests" && adoptionRequestsRef.current) {
      adoptionRequestsRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [location.hash, post]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        Loading...
      </div>
    );
  }

  if (isError || !post) {
    return <div>Error loading post.</div>;
  }

  const isOwner = user && (user.id === post.user_id || user.id === post.auth_users_id);

  const handleDelete = async () => {
    if (!post) return;
    try {
      await deletePost(post);
      toast.success("Post deleted successfully");
      navigate("/home");
    } catch (error) {
      toast.error("Failed to delete post");
      console.error(error);
    } finally {
      setIsDeleteModalOpen(false);
    }
  };

  const handleUpdate = async (updates: { name: string; content: string; status?: string; pet_type?: Post["pet_type"] }) => {
    if (!post) return;
    try {
      // Ensure status is of correct type
      const safeUpdates: Partial<Post> = {
        ...updates,
        status: updates.status as Post["status"] | undefined,
      };
      await updatePost(post.id, safeUpdates);
      toast.success("Post updated successfully");
      queryClient.invalidateQueries({ queryKey: ["post", postId] });
    } catch (error) {
      toast.error("Failed to update post");
      console.error(error);
    } finally {
      setIsUpdateModalOpen(false);
    }
  };

  

  const handleCancelRequest = async () => {
    if (!user) return;

    setIsRequesting(true);
    try {
      await cancelAdoptionRequest(post.id, user.id);
      toast.success("Adoption request cancelled.");
      checkExistingRequest(); // Re-check status after cancelling
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "object" && error !== null && "message" in error
            ? String((error as { message: unknown }).message)
            : "Failed to cancel request.";
      toast.error(message);
    } finally {
      setIsRequesting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "text-green-600";
      case "rejected":
        return "text-red-600";
      default:
        return "text-violet-700";
    }
  };

  const extractVaccinationProof = (healthInfo: string | undefined) => {
    if (!healthInfo) return null;
    const match = healthInfo.match(/Vaccination Proof:\s+(https?:\/\/\S+)/i);
    return match ? match[1] : null;
  };

  const getCleanHealthInfo = (healthInfo: string | undefined) => {
    if (!healthInfo) return "";
    return healthInfo.replace(/Vaccination Proof:\s+https?:\/\/\S+/i, "").trim();
  };

  const vaccinationProof = extractVaccinationProof(post.health_info);
  const cleanHealthInfo = getCleanHealthInfo(post.health_info);

  return (
    <>
      <VaccinationProofModal
        isOpen={isVaccinationModalOpen}
        onClose={() => setIsVaccinationModalOpen(false)}
        imageUrl={vaccinationProof || ""}
      />
      {/* Adoption Reason Modal */}
      <AdoptionReasonModal
        isOpen={isAdoptionReasonModalOpen}
        onClose={() => setIsAdoptionReasonModalOpen(false)}
        isSubmitting={isRequesting}
        onSubmit={async (reason: string) => {
          const ownerId = post?.user_id || post?.auth_users_id;
          if (!user || !ownerId || !post?.name) {
            toast.error(
              "You must be logged in to make an adoption request, or post data is incomplete."
            );
            return;
          }
          setIsRequesting(true);
          try {
            const result = await sendAdoptionRequest(post.id, user.id, ownerId, post.name, reason);
            toast.success("Adoption request sent! Redirecting to chat...");
            setIsAdoptionReasonModalOpen(false);
            checkExistingRequest();
            
            // Navigate to chat if conversation was created
            if (result && (result as any).conversationId) {
              setTimeout(() => {
                navigate(`/chat/${(result as any).conversationId}`);
              }, 1000);
            } else {
              // Fallback: try to find existing conversation
              try {
                const { data: existingConv } = await supabase
                  .rpc('find_shared_conversation', {
                    user_id_1: ownerId,
                    user_id_2: user.id,
                    specific_post_id: post.id,
                  });
                if (existingConv && existingConv.length > 0) {
                  setTimeout(() => {
                    navigate(`/chat/${existingConv[0].conversation_id}`);
                  }, 1000);
                }
              } catch {
                // Chat navigation is optional
              }
            }
          } catch (error: unknown) {
            const message =
              error instanceof Error
                ? error.message
                : typeof error === "object" && error !== null && "message" in error
                  ? String((error as { message: unknown }).message)
                  : "Failed to send adoption request.";
            toast.error(message);
          } finally {
            setIsRequesting(false);
          }
        }}
      />
      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
      />
      <UpdatePostModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        post={post}
        onUpdate={handleUpdate}
      />
      <div className="w-full bg-gradient-to-br from-violet-50 via-white to-pink-50">
        <div className="pt-24">
          {/* Back Button */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
            <button
              onClick={() => navigate(-1)}
              className="group flex items-center gap-2 text-violet-700 font-semibold hover:text-violet-900 transition-colors duration-200"
            >
              <FaArrowLeft className="group-hover:-translate-x-1 transition-transform duration-200" />
              Back to listings
            </button>
          </div>

          {/* Main content */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 sm:pb-16">
            <div className="lg:grid lg:grid-cols-12 lg:gap-12 items-start">
              {/* Left Column (Images & Actions) */}
              <div className="lg:col-span-5 space-y-6 sm:space-y-8 lg:sticky lg:top-28">
                <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl border border-violet-100 overflow-hidden">
                  <img
                    src={post.image_url}
                    alt={post.name}
                    className="w-full h-[300px] sm:h-[400px] lg:h-[500px] object-cover"
                  />
                </div>

                {/* Owner controls */}
                {isOwner && (
                  <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl border border-violet-100 p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                      <button
                        onClick={() => setIsUpdateModalOpen(true)}
                        className="flex-1 bg-gradient-to-r from-blue-500 to-sky-500 text-white px-4 sm:px-6 py-3 sm:py-3 rounded-xl font-semibold transform hover:scale-105 transition-all duration-300 shadow-lg text-sm sm:text-base"
                      >
                        Update Post
                      </button>
                      <button
                        onClick={() => setIsDeleteModalOpen(true)}
                        className="flex-1 bg-gradient-to-r from-red-500 to-pink-500 text-white px-4 sm:px-6 py-3 sm:py-3 rounded-xl font-semibold transform hover:scale-105 transition-all duration-300 shadow-lg text-sm sm:text-base"
                      >
                        Delete Post
                      </button>
                    </div>
                  </div>
                )}

                {/* Adoption Request Button */}
                {!isOwner && user && (
                  <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl border border-violet-100 p-4 sm:p-6">
                    {requestStatus === "approved" ? (
                      <div className="text-center">
                        <p className="font-semibold text-green-600">
                          Your adoption request has been approved!
                        </p>
                        <p className="text-sm text-gray-500">
                          The owner will be in touch shortly to coordinate.
                        </p>
                        <button
                          onClick={() =>
                            navigate("/chat", {
                              state: {
                                otherUserId: post.user_id,
                                postId: post.id,
                                petName: post.name,
                              },
                            })
                          }
                          className="mt-4 w-full flex items-center justify-center gap-3 px-4 sm:px-5 py-3 bg-gradient-to-br from-indigo-500 to-purple-500 text-white rounded-full hover:from-indigo-600 hover:to-purple-600 transition-all shadow-lg text-sm sm:text-base"
                        >
                          <FaEnvelope />
                          Chat with Owner
                        </button>
                      </div>
                    ) : hasRequested ? (
                      <div className="text-center">
                        <p
                          className={`font-semibold ${getStatusColor(
                            requestStatus || "pending"
                          )}`}
                        >
                          Adoption request {requestStatus || "sent"}!
                        </p>
                        <p className="text-sm text-gray-500">
                          You will be notified when the owner responds.
                        </p>
                        <button
                          onClick={handleCancelRequest}
                          disabled={isRequesting}
                          className="mt-4 w-full flex items-center justify-center gap-3 px-4 sm:px-5 py-3 bg-gradient-to-br from-red-500 to-pink-500 text-white rounded-full hover:from-red-600 hover:to-pink-600 transition-all shadow-lg disabled:opacity-50 text-sm sm:text-base"
                        >
                          {isRequesting ? "Cancelling..." : "Cancel Request"}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setIsAdoptionReasonModalOpen(true)}
                        disabled={isRequesting}
                        className="w-full flex items-center justify-center gap-3 px-4 sm:px-5 py-3 bg-gradient-to-br from-indigo-500 to-purple-500 text-white rounded-full hover:from-indigo-600 hover:to-purple-600 transition-all shadow-lg disabled:opacity-50"
                      >
                        <FaHandHoldingHeart className="text-lg sm:text-xl" />
                        <span className="font-semibold text-sm sm:text-lg">
                          {isRequesting
                            ? "Sending Request..."
                            : "Request to Adopt"}
                        </span>
                      </button>
                    )}
                  </div>
                )}

                {/* Message Button */}
                {!isOwner && user && post.user_id && requestStatus === "approved" && (
                  <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl border border-violet-100 p-4 sm:p-6">
                    <div className="text-center">
                      <p className="text-sm text-gray-500 mb-4">
                        Have questions about this pet?
                      </p>
                      <MessageButton
                        receiverId={post.user_id}
                        postId={post.id}
                        petName={post.name}
                      />
                    </div>
                  </div>
                )}
                {/* Additional Photos */}
                {post.additional_photos &&
                  post.additional_photos.length > 0 && (
                    <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl border border-violet-100 p-4 sm:p-6">
                      <h3 className="font-bold text-xl text-violet-800 font-['Quicksand'] mb-4">
                        More Photos
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        {post.additional_photos.map((photo, index) => (
                          <img
                            key={index}
                            src={photo}
                            alt={`${post.name} additional ${index + 1}`}
                            className="w-full h-40 object-cover rounded-xl"
                          />
                        ))}
                      </div>
                    </div>
                  )}
              </div>
              {/* Right Column (Details) */}
              <div className="lg:col-span-7 space-y-6 sm:space-y-8 mt-6 sm:mt-8 lg:mt-0">
                <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl border border-violet-100 p-4 sm:p-6 lg:p-8">
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold bg-gradient-to-r from-violet-600 via-purple-600 to-pink-600 text-transparent bg-clip-text font-['Quicksand'] mb-2">
                    {post.name}
                  </h1>
                  {/* Owner name under pet title */}
                  {(ownerFirstName || ownerFullName) && (
                    <div className="text-sm text-violet-600 font-['Poppins'] mb-3">
                      <span className="text-xs text-gray-500">Posted by</span>
                      <Link
                        to={`/user/${post.user_id}`}
                        className="ml-2 font-medium text-violet-700 hover:text-violet-900 hover:underline"
                      >
                        {ownerFirstName ? `${ownerFirstName}${ownerLastName ? ' ' + ownerLastName : ''}` : ownerFullName}
                      </Link>
                    </div>
                  )}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-gray-500 mb-4 sm:mb-6">
                    <div className="flex items-center gap-2">
                      <FaMapMarkerAlt />
                      <span>{post.location}</span>
                    </div>
                    {post.breed && (
                      <div className="flex items-center gap-2">
                        <MdPets />
                        <span>
                          {post.pet_type ? `${post.pet_type} • ${post.breed}` : post.breed}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <FaClock />
                      <span>
                        Posted on{" "}
                        {new Date(post.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <p className="text-gray-700 font-['Poppins'] text-lg leading-relaxed">
                    {post.content}
                  </p>

                  <div className="h-px bg-violet-200 my-8"></div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 text-center">
                    <div className="bg-violet-50 p-4 rounded-2xl">
                      <p className="text-sm text-violet-500 font-semibold">
                        Age
                      </p>
                      <p className="text-xl font-bold text-violet-800">
                        {post.age} years
                      </p>
                    </div>
                    <div className="bg-violet-50 p-4 rounded-2xl">
                      <p className="text-sm text-violet-500 font-semibold">
                        Breed
                      </p>
                      <p className="text-xl font-bold text-violet-800">
                        {post.breed}
                      </p>
                    </div>
                    <div className="bg-violet-50 p-4 rounded-2xl">
                      <p className="text-sm text-violet-500 font-semibold">
                        Size
                      </p>
                      <p className="text-xl font-bold text-violet-800">
                        {post.size === 'Small'
                          ? 'Small: 1 – 10 kg'
                          : post.size === 'Medium'
                          ? 'Medium: 11 – 25 kg'
                          : post.size === 'Large'
                          ? 'Large: 26 – 44 kg'
                          : post.size === 'Extra Large'
                          ? 'Extra Large (XL): 45+ kg'
                          : post.size}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl border border-violet-100 p-4 sm:p-6 lg:p-8">
                  <h3 className="font-bold text-xl sm:text-2xl text-violet-800 font-['Quicksand'] mb-4 sm:mb-6 flex items-center gap-3">
                    <FaHeartbeat className="text-pink-500" />
                    Health & Temperament
                  </h3>

                  <div className="space-y-4 sm:space-y-6">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-green-100 rounded-full">
                        <FaSyringe className="text-green-500" />
                      </div>
                      <div>
                        <p className="font-semibold text-violet-800">
                          Vaccination
                        </p>
                        <p
                          className={`font-bold ${
                            post.vaccination_status
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {post.vaccination_status
                            ? "Vaccinated"
                            : "Not Vaccinated"}
                        </p>
                        {vaccinationProof && (
                          <button
                            type="button"
                            onClick={() => setIsVaccinationModalOpen(true)}
                            className="text-sm text-blue-500 hover:underline"
                          >
                            View Proof
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-blue-100 rounded-full">
                        <MdPets className="text-blue-500" />
                      </div>
                      <div>
                        <p className="font-semibold text-violet-800">
                          Temperament
                        </p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {post.temperament?.map((t, index) => (
                            <span
                              key={index}
                              className="px-3 py-1 bg-blue-50 text-blue-800 rounded-full text-sm font-medium"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    {cleanHealthInfo && (
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-purple-100 rounded-full">
                          <FaRuler className="text-purple-500" />
                        </div>
                        <div>
                          <p className="font-semibold text-violet-800">
                            Additional Health Info
                          </p>
                          <p className="text-gray-600">{cleanHealthInfo}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                {isOwner && (
                  <div
                    ref={adoptionRequestsRef}
                    className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl border border-violet-100 p-4 sm:p-6 lg:p-8"
                  >
                    <h3 className="font-bold text-xl sm:text-2xl text-violet-800 font-['Quicksand'] mb-4 sm:mb-6">
                      Adoption Requests
                    </h3>
                    {post.user_id && (
                      <AdoptionRequestsList
                        postId={numericPostId}
                        ownerId={post.user_id}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
