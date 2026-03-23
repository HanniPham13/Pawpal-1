import { useQuery } from "@tanstack/react-query";
import { supabase } from "../supabase-client";
import { useAuth } from "../context/AuthContext";
import {
  FaUser,
  FaMapMarkerAlt,
  FaPaw,
  FaHeart,
  FaShieldAlt,
  FaChartPie,
  FaCheckCircle,
  FaHourglassHalf,
  FaTimesCircle,
  FaPlusCircle,
  FaEye,
  FaDownload,
  FaFileImage,
  FaCamera,
} from "react-icons/fa";
import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";

interface UserData {
  id: string;
  full_name?: string;
  bio: string;
  location: string;
  is_shelter: boolean;
  verified: boolean;
  adoption_history: string[];
  favorites: string[];
  avatar_url?: string;
}

interface Badge {
  id: number;
  badge_type: string;
  awarded_at: string;
}

interface Post {
  id: number;
  name: string;
  image_url: string;
  status: string;
  created_at: string;
  breed: string;
  content: string;
  adoption_count?: number;
  request_count?: number;
}

interface UserStats {
  total_posts: number;
  available_pets: number;
  adopted_pets: number;
  pending_pets: number;
  adoption_rate: number;
}

interface UserDocument {
  name: string;
  created_at: string;
  url: string;
  size: number;
  content_type?: string;
  isUserFolder?: boolean;
  bucket?: string;
  fromDatabase?: boolean;
  full_path?: string;
  user_id?: string | null;
}

// Fetch user posts with adoption request counts
const fetchUserPosts = async (userId: string): Promise<Post[]> => {
  // Get all posts by this user
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  // For each post, get adoption request counts
  if (data && data.length > 0) {
    for (const post of data) {
      try {
        // Get adoption request count
        const { count: requestCount } = await supabase
          .from("adoption_requests")
          .select("*", { count: "exact", head: true })
          .eq("post_id", post.id);

        post.request_count = requestCount || 0;

        // Get approved adoption count
        const { count: adoptionCount } = await supabase
          .from("adoption_requests")
          .select("*", { count: "exact", head: true })
          .eq("post_id", post.id)
          .eq("status", "approved");

        post.adoption_count = adoptionCount || 0;
      } catch {
        post.request_count = 0;
        post.adoption_count = 0;
      }
    }
  }

  return data || [];
};

// Calculate user stats based on posts and adoption requests
const calculateUserStats = (posts: Post[]): UserStats => {
  const total_posts = posts.length;
  const available_pets = posts.filter(
    (post) => post.status?.toLowerCase() === "available" || post.status?.toLowerCase() === "approved"
  ).length;
  const adopted_pets = posts.filter(
    (post) => post.status?.toLowerCase() === "adopted"
  ).length;
  const pending_pets = posts.filter(
    (post) => post.status?.toLowerCase() === "pending"
  ).length;

  // Calculate adoption rate (approved adoptions / total posts with requests)
  const postsWithRequests = posts.filter(
    (post) => (post.request_count || 0) > 0
  ).length;
  const adoption_rate =
    postsWithRequests > 0 ? (adopted_pets / postsWithRequests) * 100 : 0;

  return {
    total_posts,
    available_pets,
    adopted_pets,
    pending_pets,
    adoption_rate,
  };
};

const fetchUserData = async (userId: string): Promise<UserData> => {
  // Try to get existing user
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  // If no error but no data, or if error is about no rows, create new user
  if ((!error && !data) || (error && error.message.includes("no rows"))) {
    const defaultUserData = {
      user_id: userId,
      bio: "",
      location: "",
      is_shelter: false,
      verified: false,
      adoption_history: [],
      favorites: [],
      avatar_url: "",
    };

    const { data: newUser, error: createError } = await supabase
      .from("users")
      .insert([defaultUserData])
      .select()
      .single();

    if (createError) {
      throw createError;
    }

    return newUser;
  }

  if (error) {
    throw error;
  }

  return data;
};

const fetchUserBadges = async (userId: string): Promise<Badge[]> => {
  try {
    const { data, error } = await supabase
      .from("user_badges")
      .select("*")
      .eq("user_id", userId);

    if (error) {
      console.log("Badges not available:", error.message);
      return [];
    }
    return data || [];
  } catch (error) {
    console.log("Error fetching badges:", error);
    return [];
  }
};

const fetchUserDocuments = async (userId: string): Promise<UserDocument[]> => {
  try {
    console.log("Fetching documents for user:", userId);

    // List all files in the bucket without filtering by user_id path
    const { data: filesData, error: filesError } = await supabase.storage
      .from("documents")
      .list("", {
        sortBy: { column: "created_at", order: "desc" },
      });

    if (filesError) {
      console.error("Error listing files:", filesError);
      return [];
    }

    if (!filesData || filesData.length === 0) {
      console.log("No files found in storage");
      return [];
    }

    console.log("Files found in storage:", filesData);

    // For each file, get a public URL
    const documents = await Promise.all(
      filesData.map(async (file) => {
        const { data: publicUrlData } = await supabase.storage
          .from("documents")
          .getPublicUrl(file.name);

        console.log(`Generated URL for ${file.name}:`, publicUrlData.publicUrl);

        return {
          name: file.name,
          full_path: file.name,
          created_at: file.created_at || new Date().toISOString(),
          url: publicUrlData.publicUrl,
          size: file.metadata?.size || 0,
          content_type: file.metadata?.mimetype || guessContentType(file.name),
          bucket: "documents",
          user_id: extractUserIdFromFilename(file.name), // Extract user ID from filename
        };
      })
    );

    // Filter to only show files that belong to this user
    const userDocuments = documents.filter((doc) => {
      // Check if filename contains user ID indicators
      const belongsToUser =
        (doc.name.includes(`user_upload_`) &&
          doc.name.includes(`_${userId}_`)) || // New format with user ID
        (doc.name.includes(`user_upload_`) && doc.user_id === userId) || // Extract user ID if possible
        doc.name.includes(`${userId}`); // Direct user ID in filename

      return belongsToUser;
    });

    console.log("Filtered user documents:", userDocuments);

    return userDocuments;
  } catch (error) {
    console.error("Error fetching documents:", error);
    return [];
  }
};

// Helper function to extract user ID from filename if present
const extractUserIdFromFilename = (filename: string): string | null => {
  // Check if filename contains user ID pattern like "user_upload_UID_123456_filename.jpg"
  const userIdMatch = filename.match(/user_upload_([a-zA-Z0-9-]+)_/);
  return userIdMatch ? userIdMatch[1] : null;
};

// Helper function to guess content type from filename
const guessContentType = (filename: string): string => {
  const extension = filename.split(".").pop()?.toLowerCase();

  switch (extension) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "pdf":
      return "application/pdf";
    default:
      return "application/octet-stream";
  }
};

interface UserProfileProps {
  profileId?: string; // Optional profile ID to view someone else's profile
}

export const UserProfile = ({ profileId }: UserProfileProps) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"profile" | "posts" | "analytics">(
    "profile"
  );
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [newBio, setNewBio] = useState("");
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [showDocumentModal, setShowDocumentModal] = useState(false);

  // Edit Profile Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [address, setAddress] = useState("");
  const [modalUsername, setModalUsername] = useState("");
  const [saving, setSaving] = useState(false);
  const [profileError, setProfileError] = useState("");

  // File input references
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // Determine which user profile to show - current user or requested profile
  const targetUserId = profileId || user?.id || "";

  // Check if viewing own profile
  const isOwnProfile = !profileId || (user && profileId === user.id);

  useEffect(() => {
    // Make all reveal elements visible immediately on load
    const elements = document.querySelectorAll(".reveal");
    elements.forEach((el) => {
      el.classList.add("visible");
    });
  }, [activeTab]);

  const {
    data: userData,
    isLoading: userLoading,
    error: userError,
    refetch: refetchUser,
  } = useQuery<UserData, Error>({
    queryKey: ["userData", targetUserId],
    queryFn: () => fetchUserData(targetUserId),
    enabled: targetUserId !== "",
    retry: 1,
  });

  // Initialize bio from userData when it loads
  useEffect(() => {
    if (userData) {
      setNewBio(userData.bio || "");
    }
  }, [userData]);

  // Handle avatar upload
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !isOwnProfile) return;

    if (!file.type.startsWith('image/')) {
      setUploadMessage("Please select an image file");
      setTimeout(() => setUploadMessage(""), 3000);
      return;
    }

    setIsUploadingAvatar(true);
    try {
      // Use post-images bucket which has working RLS policies
      const filePath = `avatar-${user.id}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const { error: uploadError } = await supabase.storage
        .from("post-images")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("post-images").getPublicUrl(filePath);
      const avatarUrl = urlData.publicUrl;

      // Update users table so avatar persists across refreshes
      const { error: dbError } = await supabase
        .from("users")
        .update({ avatar_url: avatarUrl })
        .eq("user_id", user.id);

      if (dbError) {
        console.error("Error updating users table:", dbError);
      }

      // Update auth metadata as backup
      await supabase.auth.updateUser({ data: { avatar_url: avatarUrl } });

      refetchUser();
      setUploadMessage("Profile picture updated!");
      setTimeout(() => setUploadMessage(""), 3000);
    } catch (error) {
      console.error("Error uploading avatar:", error);
      setUploadMessage("Failed to upload profile picture");
      setTimeout(() => setUploadMessage(""), 5000);
    } finally {
      setIsUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  // Function to update bio
  const updateBio = async () => {
    if (!user || !isOwnProfile) return;

    try {
      const { error } = await supabase
        .from("users")
        .update({ bio: newBio })
        .eq("user_id", user.id);

      if (error) throw error;

      // Refresh user data
      refetchUser();
      setIsEditingBio(false);
      setUploadMessage("Bio updated successfully!");
      setTimeout(() => setUploadMessage(""), 3000);
    } catch (error: unknown) {
      console.error("Error updating bio:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      setUploadMessage("Failed to update bio: " + errorMessage);
    }
  };

  // Function to handle document upload
  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !isOwnProfile) return;

    try {
      setIsUploading(true);
      setUploadMessage("Uploading image...");

      // Check if the file is an image
      if (!file.type.includes("image/")) {
        setUploadMessage("Please select an image file (JPG, PNG, GIF, etc.)");
        setIsUploading(false);
        return;
      }

      // Create a unique filename WITH USER ID to ensure proper filtering
      const fileName = `user_upload_${
        user.id
      }_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      // Using a generic path that doesn't require user_id in path for RLS
      const filePath = fileName;

      console.log(`Uploading image: ${filePath}, type: ${file.type}`);

      // Upload to the documents bucket that exists in your project
      // without relying on user_id in the path (which might be causing RLS issues)
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, file, {
          contentType: file.type,
          upsert: true,
          cacheControl: "3600",
        });

      if (uploadError) {
        // Check if it's an RLS error and provide specific guidance
        if (
          uploadError.message?.includes("row-level security") ||
          uploadError.message?.includes("Unauthorized") ||
          uploadError.message?.includes("403")
        ) {
          console.error("RLS policy violation during upload:", uploadError);
          setUploadMessage(
            "Upload failed due to permission settings. Please check Supabase RLS policies."
          );
          return;
        }

        console.error("Upload error:", uploadError);
        throw uploadError;
      }

      // Get the public URL of the uploaded file
      const { data: publicURLData } = supabase.storage
        .from("documents")
        .getPublicUrl(filePath);

      console.log(
        "Upload successful:",
        uploadData,
        "Public URL:",
        publicURLData
      );

      // Skip inserting to the database entirely - this avoids RLS issues
      // We'll just rely on storage for files

      setUploadMessage("Image uploaded successfully!");

      // Close the upload panel after a short delay and refresh files
      setTimeout(() => {
        setIsUploadingDoc(false);
        refetchFilesDirectly();
      }, 1500);
    } catch (error: unknown) {
      console.error("Error uploading image:", error);

      // Provide specific guidance for RLS errors
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      if (
        errorMessage.includes("row-level security") ||
        errorMessage.includes("Unauthorized") ||
        errorMessage.includes("403")
      ) {
        setUploadMessage(
          "Permission error: The application doesn't have rights to upload files."
        );
      } else {
        setUploadMessage(`Upload failed: ${errorMessage}`);
      }
    } finally {
      setIsUploading(false);

      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      // Clear message after a delay (unless it's an error)
      if (
        !uploadMessage.includes("failed") &&
        !uploadMessage.includes("error")
      ) {
        setTimeout(() => setUploadMessage(""), 5000);
      }
    }
  };

  // Add a new function to directly fetch and display files from storage
  const refetchFilesDirectly = async () => {
    if (!user) return;

    try {
      // Just list all files in the documents bucket without filtering by user
      const { data: allFiles, error } = await supabase.storage
        .from("documents")
        .list("", {
          sortBy: { column: "created_at", order: "desc" },
        });

      if (error) {
        console.error("Error listing files:", error);
        return;
      }

      // Process files and update UI directly without going through the query system
      if (allFiles && allFiles.length > 0) {
        await Promise.all(
          allFiles.map(async (file) => {
            const { data: urlData } = await supabase.storage
              .from("documents")
              .getPublicUrl(file.name);

            return {
              name: file.name,
              created_at: file.created_at || new Date().toISOString(),
              url: urlData.publicUrl,
              size: file.metadata?.size || 0,
              content_type:
                file.metadata?.mimetype || guessContentType(file.name),
            };
          })
        );

        // Force a refresh of the documents query
        refetchDocuments();
      }
    } catch (err) {
      console.error("Error refreshing files:", err);
    }
  };

  // Function to delete a document - simplified to avoid RLS issues
  const handleDeleteDocument = async (fileName: string, fullPath?: string) => {
    if (!user || !isOwnProfile) return;

    try {
      setUploadMessage("Deleting document...");
      // Just use the filename directly - no user path
      const filePath = fullPath || fileName;
      console.log(`Attempting to delete file: ${filePath}`);

      const { error } = await supabase.storage
        .from("documents")
        .remove([filePath]);

      if (error) {
        console.error("Error deleting file:", error);
        throw error;
      }

      setUploadMessage("Document deleted successfully!");

      // Refresh files
      refetchFilesDirectly();

      // Close the modal if it's open
      if (showDocumentModal) {
        setShowDocumentModal(false);
      }
    } catch (error: unknown) {
      console.error("Error deleting document:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      setUploadMessage(`Delete failed: ${errorMessage}`);
    } finally {
      // Clear success message after 5 seconds
      if (uploadMessage.includes("success")) {
        setTimeout(() => setUploadMessage(""), 5000);
      }
    }
  };

  // Query for user documents - only fetch for own profile
  const {
    data: userDocuments,
    isLoading: documentsLoading,
    refetch: refetchDocuments,
  } = useQuery<UserDocument[], Error>({
    queryKey: ["userDocuments", targetUserId],
    queryFn: () => fetchUserDocuments(targetUserId),
    enabled: targetUserId !== "" && isOwnProfile === true,
    refetchOnWindowFocus: false,
    staleTime: 60000,
  });

  // Filter documents to only show images with proper typing
  const imageDocuments = (userDocuments || []).filter((doc: UserDocument) => {
    const isImage = doc.content_type?.includes("image");
    console.log(
      `File ${doc.name}: content_type=${doc.content_type}, isImage=${isImage}`
    );
    return isImage;
  });

  useEffect(() => {
    // Debug output whenever image documents change
    console.log("Image documents:", imageDocuments);
  }, [imageDocuments]);

  // Query for user posts
  const { data: userPosts, isLoading: postsLoading } = useQuery<Post[], Error>({
    queryKey: ["userPosts", targetUserId],
    queryFn: () => fetchUserPosts(targetUserId),
    enabled: !!targetUserId,
  });

  // Calculate user stats from posts
  const userStats: UserStats | undefined = userPosts
    ? calculateUserStats(userPosts)
    : undefined;

  const { data: badges, isLoading: badgesLoading } = useQuery<Badge[], Error>({
    queryKey: ["userBadges", targetUserId],
    queryFn: () => fetchUserBadges(targetUserId),
    enabled: !!targetUserId,
  });

  // Open Edit Profile Modal
  const openEditModal = async () => {
    setProfileError("");
    if (!user) return;
    
    // Get current profile data
    const { data: profile } = await supabase
      .from("users")
      .select("full_name, location")
      .eq("user_id", user.id)
      .maybeSingle();
    
    let fName = "";
    let lName = "";
    let uName = "";
    
    if (profile?.full_name) {
      const parts = profile.full_name.split(" ");
      fName = parts[0] || "";
      lName = parts.slice(1).join(" ") || "";
      uName = profile.full_name;
    } else if (user.user_metadata?.full_name) {
      const parts = user.user_metadata.full_name.split(" ");
      fName = parts[0] || "";
      lName = parts.slice(1).join(" ") || "";
      uName = user.user_metadata.full_name;
    }
    
    setFirstName(fName);
    setLastName(lName);
    setAddress(profile?.location || "");
    setModalUsername(uName);
    setShowEditModal(true);
  };

  // Save Profile Changes
  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    setProfileError("");
    
    const fullName = `${firstName} ${lastName}`.trim();
    
    try {
      // Update users table
      const { error } = await supabase
        .from("users")
        .update({ full_name: fullName, location: address })
        .eq("user_id", user.id);
      
      if (error) throw error;
      
      // Update auth metadata
      const { error: authError } = await supabase.auth.updateUser({
        data: { full_name: fullName },
      });
      
      if (authError) throw authError;
      
      setShowEditModal(false);
      refetchUser(); // Refresh the user data
      setUploadMessage("Profile updated successfully!");
      setTimeout(() => setUploadMessage(""), 3000);
    } catch (error: any) {
      setProfileError(error?.message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="text-center text-violet-600 py-10 font-['Poppins'] bg-white/80 backdrop-blur-md rounded-xl p-8 shadow-md max-w-md mx-auto">
        <FaUser className="text-5xl mx-auto mb-4 text-violet-300" />
        <p className="text-xl mb-2">Please log in to view your profile</p>
        <a
          href="/login"
          className="bg-gradient-to-r from-violet-500 to-blue-500 text-white px-6 py-3 rounded-xl font-medium hover:from-violet-600 hover:to-blue-600 transform hover:scale-105 transition-all duration-300 shadow-md inline-flex items-center gap-2 mt-4"
        >
          Sign In
        </a>
      </div>
    );
  }

  if (userError) {
    return (
      <div className="text-center text-red-500 py-4 bg-red-50 rounded-xl p-6 shadow-md font-['Poppins'] max-w-md mx-auto">
        <p className="text-xl font-medium mb-2">Oops! Something went wrong</p>
        <p>Error loading profile: {userError.message}</p>
      </div>
    );
  }

  if (userLoading || badgesLoading || postsLoading || documentsLoading) {
    return (
      <div className="flex justify-center items-center py-10 min-h-[80vh]">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-violet-500 border-opacity-100 border-r-4  border-opacity-50"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 w-full">
      <div className="w-full max-w-6xl mx-auto px-4 py-6 sm:py-8">
        {/* Animated Background Elements */}
        <div className="fixed inset-0 pointer-events-none z-0 opacity-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-gradient-to-r from-indigo-400 to-purple-500 animate-pulse"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                width: `${Math.random() * 200 + 100}px`,
                height: `${Math.random() * 200 + 100}px`,
                animationDelay: `${Math.random() * 5}s`,
                animationDuration: `${Math.random() * 10 + 10}s`,
              }}
            />
          ))}
        </div>

        {/* Profile Header */}
        <div className="relative z-10 mb-8">
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 p-8 sm:p-10">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-8">
              {/* Avatar Section */}
              <div className="relative">
                <div
                  className={`w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-2xl border-4 border-white overflow-hidden ${isOwnProfile ? 'cursor-pointer group/avatar' : ''}`}
                  onClick={() => isOwnProfile && avatarInputRef.current?.click()}
                >
                  {userData?.avatar_url ? (
                    <img
                      src={userData.avatar_url}
                      alt="User Avatar"
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : user?.user_metadata?.avatar_url && isOwnProfile ? (
                    <img
                      src={user.user_metadata.avatar_url}
                      alt="User Avatar"
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <FaUser className="text-4xl sm:text-5xl text-white" />
                  )}
                  {isOwnProfile && (
                    <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center">
                      {isUploadingAvatar ? (
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent"></div>
                      ) : (
                        <FaCamera className="text-white text-xl" />
                      )}
                    </div>
                  )}
                </div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                />
                {userData?.verified && (
                  <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white rounded-full p-2 shadow-lg border-2 border-white">
                    <FaShieldAlt className="w-4 h-4" />
                  </div>
                )}
              </div>

              {/* User Info Section */}
              <div className="flex-1 text-center sm:text-left">
                <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-3 mb-2">
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-800">
                    {isOwnProfile
                      ? user?.user_metadata?.full_name || user?.email
                      : userData?.full_name || "User"}
                  </h1>
                  {isOwnProfile && (
                    <button
                      onClick={openEditModal}
                      className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded-lg font-medium transition-colors"
                    >
                      Edit Profile
                    </button>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3 sm:gap-6 mb-4">
                  <div className="flex items-center gap-2 text-slate-600">
                    <FaMapMarkerAlt className="text-indigo-500" />
                    <span className="font-medium">
                      {userData?.location || "Location not set"}
                    </span>
                  </div>

                  {userData?.is_shelter && (
                    <span className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-full text-sm font-semibold shadow-lg flex items-center gap-2">
                      <FaShieldAlt className="w-4 h-4" />
                      Shelter Account
                    </span>
                  )}
                </div>

                {/* Bio Section */}
                <div className="bg-slate-50/80 rounded-2xl p-4 sm:p-6 border border-slate-200/50">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-semibold text-slate-800">
                      About Me
                    </h3>
                    {isOwnProfile && (
                      <button
                        onClick={() => setIsEditingBio(!isEditingBio)}
                        className="text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
                      >
                        {isEditingBio ? "Cancel" : "Edit"}
                      </button>
                    )}
                  </div>

                  {isOwnProfile && isEditingBio ? (
                    <div className="space-y-3">
                      <textarea
                        value={newBio}
                        onChange={(e) => setNewBio(e.target.value)}
                        className="w-full p-4 rounded-xl bg-white border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all resize-none"
                        placeholder="Tell others about yourself..."
                        rows={4}
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setIsEditingBio(false);
                            setNewBio(userData?.bio || "");
                          }}
                          className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={updateBio}
                          className="px-6 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl font-semibold hover:from-indigo-600 hover:to-purple-600 transition-all shadow-lg"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-slate-700 leading-relaxed">
                      {userData?.bio || "No bio provided yet."}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-8 flex justify-center">
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-2">
            <div className="flex gap-1">
              <button
                onClick={() => setActiveTab("profile")}
                className={`px-6 py-3 rounded-xl font-semibold transition-all duration-200 text-sm sm:text-base ${
                  activeTab === "profile"
                    ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg"
                    : "text-slate-600 hover:text-slate-800 hover:bg-slate-100"
                }`}
              >
                <FaUser className="inline mr-2" />
                Profile
              </button>
              <button
                onClick={() => setActiveTab("posts")}
                className={`px-6 py-3 rounded-xl font-semibold transition-all duration-200 text-sm sm:text-base ${
                  activeTab === "posts"
                    ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg"
                    : "text-slate-600 hover:text-slate-800 hover:bg-slate-100"
                }`}
              >
                <FaPaw className="inline mr-2" />
                Posts
              </button>
              <button
                onClick={() => setActiveTab("analytics")}
                className={`px-6 py-3 rounded-xl font-semibold transition-all duration-200 text-sm sm:text-base ${
                  activeTab === "analytics"
                    ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg"
                    : "text-slate-600 hover:text-slate-800 hover:bg-slate-100"
                }`}
              >
                <FaChartPie className="inline mr-2" />
                Analytics
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="space-y-6">
          {/* Profile Tab */}
          {activeTab === "profile" && (
            <div className="space-y-6">
              {/* Image Gallery Section */}
              {isOwnProfile && (
                <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 p-6 sm:p-8">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl">
                        <FaFileImage className="text-white w-5 h-5" />
                      </div>
                      My Images
                      {imageDocuments && (
                        <span className="text-sm font-normal text-slate-500">
                          ({imageDocuments.length})
                        </span>
                      )}
                    </h2>
                    <button
                      onClick={() => setIsUploadingDoc(true)}
                      className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl font-semibold hover:from-indigo-600 hover:to-purple-600 transition-all shadow-lg flex items-center gap-2"
                    >
                      <FaPlusCircle className="w-4 h-4" />
                      Upload Image
                    </button>
                  </div>

                  {uploadMessage && (
                    <div
                      className={`p-4 rounded-xl mb-6 text-center font-medium ${
                        uploadMessage.includes("success")
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : uploadMessage.includes("failed") ||
                            uploadMessage.includes("Error")
                          ? "bg-red-50 text-red-700 border border-red-200"
                          : "bg-blue-50 text-blue-700 border border-blue-200"
                      }`}
                    >
                      {uploadMessage}
                    </div>
                  )}

                  {isUploadingDoc && (
                    <div className="mb-6 p-6 bg-slate-50/80 rounded-2xl border border-slate-200/50">
                      <h3 className="text-lg font-semibold text-slate-800 mb-3">
                        Upload New Image
                      </h3>
                      <p className="text-slate-600 mb-4">
                        Supported formats: JPG, PNG, GIF, WebP
                      </p>

                      <input
                        type="file"
                        id="imageUpload"
                        ref={fileInputRef}
                        onChange={handleDocUpload}
                        accept="image/*"
                        className="hidden"
                      />
                      <label
                        htmlFor="imageUpload"
                        className="block w-full p-8 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 transition-all text-center"
                      >
                        <FaFileImage className="text-4xl text-slate-400 mx-auto mb-3" />
                        <span className="text-slate-600 font-medium">
                          Click to select an image
                        </span>
                        {isUploading && (
                          <div className="mt-4 flex items-center justify-center gap-2">
                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-indigo-500 border-t-transparent"></div>
                            <span className="text-indigo-600">
                              Uploading...
                            </span>
                          </div>
                        )}
                      </label>
                    </div>
                  )}

                  {imageDocuments && imageDocuments.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {imageDocuments.map(
                        (image: UserDocument, index: number) => (
                          <div
                            key={index}
                            className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 border border-slate-200/50 group"
                          >
                            <div className="relative aspect-square">
                              <img
                                src={image.url}
                                alt=""
                                className="w-full h-full object-cover cursor-pointer group-hover:scale-105 transition-transform duration-300"
                                onClick={() => setShowDocumentModal(true)}
                                onError={(e) => {
                                  console.error(
                                    `Error loading image: ${image.url}`
                                  );
                                  e.currentTarget.src =
                                    "https://via.placeholder.com/300x300?text=Image+Error";
                                }}
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                            </div>
                            <div className="p-4">
                              <div className="flex justify-between items-center">
                                <p className="text-sm text-slate-500">
                                  {new Date(
                                    image.created_at
                                  ).toLocaleDateString()}
                                </p>
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => setShowDocumentModal(true)}
                                    className="p-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                                    title="View image"
                                  >
                                    <FaEye className="w-3 h-3" />
                                  </button>
                                  <a
                                    href={image.url}
                                    download
                                    className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                                    title="Download image"
                                  >
                                    <FaDownload className="w-3 h-3" />
                                  </a>
                                  <button
                                    onClick={() =>
                                      handleDeleteDocument(
                                        image.name,
                                        image.full_path
                                      )
                                    }
                                    className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                                    title="Delete image"
                                  >
                                    <FaTimesCircle className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-slate-50/80 rounded-2xl border border-slate-200/50">
                      <FaFileImage className="text-6xl mx-auto mb-4 text-slate-300" />
                      <p className="text-xl mb-2 text-slate-700 font-semibold">
                        No images uploaded yet
                      </p>
                      <p className="text-slate-500 mb-6">
                        Start building your image collection
                      </p>
                      <button
                        onClick={() => setIsUploadingDoc(true)}
                        className="px-8 py-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl font-semibold hover:from-indigo-600 hover:to-purple-600 transition-all shadow-lg flex items-center gap-2 mx-auto"
                      >
                        <FaPlusCircle className="w-5 h-5" />
                        Upload Your First Image
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Badges Section */}
              {badges && badges.length > 0 && (
                <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 p-6 sm:p-8">
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-6 flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl">
                      <FaShieldAlt className="text-white w-5 h-5" />
                    </div>
                    Badges & Achievements
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {badges.map((badge) => (
                      <div
                        key={badge.id}
                        className="bg-gradient-to-br from-emerald-50 to-teal-50 p-4 rounded-2xl border border-emerald-200/50 hover:shadow-lg transition-all duration-300"
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <div className="p-2 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-lg">
                            <FaShieldAlt className="text-white w-4 h-4" />
                          </div>
                          <span className="font-semibold text-emerald-800 capitalize">
                            {badge.badge_type}
                          </span>
                        </div>
                        <p className="text-sm text-emerald-600">
                          Awarded:{" "}
                          {new Date(badge.awarded_at).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Posts Tab */}
          {activeTab === "posts" && (
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl">
                    <FaPaw className="text-white w-5 h-5" />
                  </div>
                  {isOwnProfile ? "Your Pet Listings" : "Pet Listings"}
                </h2>
                {isOwnProfile && (
                  <Link
                    to="/create"
                    className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-semibold hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg flex items-center gap-2"
                  >
                    <FaPlusCircle className="w-4 h-4" />
                    New Post
                  </Link>
                )}
              </div>

              {userPosts && userPosts.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {userPosts.map((post) => (
                    <Link
                      to={`/post/${post.id}`}
                      key={post.id}
                      className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 border border-slate-200/50 group"
                    >
                      <div className="relative h-48">
                        <img
                          src={
                            post.image_url ||
                            "https://via.placeholder.com/400x300?text=No+Image"
                          }
                          alt={post.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            e.currentTarget.src =
                              "https://via.placeholder.com/400x300?text=Image+Unavailable";
                          }}
                        />
                        <div className="absolute top-3 right-3">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold shadow-lg ${
                              post.status?.toLowerCase() === "available" || post.status?.toLowerCase() === "approved"
                                ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                                : post.status?.toLowerCase() === "pending"
                                ? "bg-amber-100 text-amber-700 border border-amber-200"
                                : "bg-blue-100 text-blue-700 border border-blue-200"
                            }`}
                          >
                            {post.status}
                          </span>
                        </div>
                        {(post.request_count || 0) > 0 && (
                          <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1 text-xs font-semibold text-slate-800 border border-slate-200">
                            {post.request_count}{" "}
                            {post.request_count === 1 ? "Request" : "Requests"}
                          </div>
                        )}
                      </div>
                      <div className="p-5">
                        <h3 className="font-bold text-slate-800 text-lg mb-2 truncate">
                          {post.name}
                        </h3>
                        <p className="text-sm text-slate-500 mb-3">
                          {new Date(post.created_at).toLocaleDateString()}
                        </p>
                        <p className="text-slate-600 line-clamp-2 leading-relaxed">
                          {post.content}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 bg-slate-50/80 rounded-2xl border border-slate-200/50">
                  <FaPaw className="text-6xl mx-auto mb-4 text-slate-300" />
                  <p className="text-xl mb-2 text-slate-700 font-semibold">
                    No pet listings yet
                  </p>
                  <p className="text-slate-500 mb-8">
                    {isOwnProfile ? "Start sharing your pets with the community" : "No pet listings yet"}
                  </p>
                  {isOwnProfile && (
                    <Link
                      to="/create"
                      className="px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-semibold hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg flex items-center gap-2 mx-auto w-fit"
                    >
                      <FaPlusCircle className="w-5 h-5" />
                      Create Your First Post
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Analytics Tab */}
          {activeTab === "analytics" && userStats && (
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 p-6 sm:p-8">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-8 flex items-center gap-3">
                <div className="p-2 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl">
                  <FaChartPie className="text-white w-5 h-5" />
                </div>
                Pet Adoption Analytics
              </h2>

              {/* Stats Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-2xl border border-indigo-200/50 text-center">
                  <h3 className="text-sm font-semibold text-indigo-700 mb-2">
                    Total Pets
                  </h3>
                  <p className="text-3xl font-bold text-indigo-800">
                    {userStats.total_posts}
                  </p>
                </div>
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-6 rounded-2xl border border-emerald-200/50 text-center">
                  <h3 className="text-sm font-semibold text-emerald-700 mb-2">
                    Available
                  </h3>
                  <p className="text-3xl font-bold text-emerald-800">
                    {userStats.available_pets}
                  </p>
                </div>
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-6 rounded-2xl border border-amber-200/50 text-center">
                  <h3 className="text-sm font-semibold text-amber-700 mb-2">
                    Pending
                  </h3>
                  <p className="text-3xl font-bold text-amber-800">
                    {userStats.pending_pets}
                  </p>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-6 rounded-2xl border border-blue-200/50 text-center">
                  <h3 className="text-sm font-semibold text-blue-700 mb-2">
                    Adopted
                  </h3>
                  <p className="text-3xl font-bold text-blue-800">
                    {userStats.adopted_pets}
                  </p>
                </div>
              </div>

              {/* Adoption Success Rate */}
              <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-200/50 mb-8">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">
                  Adoption Success Rate
                </h3>
                <div className="relative h-6 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="absolute h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-1000"
                    style={{ width: `${userStats.adoption_rate}%` }}
                  ></div>
                </div>
                <div className="flex justify-between mt-3 text-sm text-slate-600">
                  <span>0%</span>
                  <span className="font-semibold text-indigo-800">
                    {userStats.adoption_rate.toFixed(1)}%
                  </span>
                  <span>100%</span>
                </div>
              </div>

              {/* Posts by Status Chart */}
              <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-200/50">
                <h3 className="text-lg font-semibold text-slate-800 mb-6">
                  Posts by Status
                </h3>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-8">
                  <div className="flex h-64 items-end gap-6">
                    <div className="flex flex-col items-center">
                      <div
                        className="w-16 bg-emerald-400 rounded-t-lg relative hover:opacity-90 transition-opacity cursor-pointer shadow-lg"
                        style={{
                          height: `${
                            (userStats.available_pets /
                              Math.max(userStats.total_posts, 1)) *
                            200
                          }px`,
                        }}
                      >
                        <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 font-bold text-emerald-700">
                          {userStats.available_pets}
                        </span>
                      </div>
                      <span className="mt-3 text-sm font-semibold flex items-center gap-1 text-emerald-700">
                        <FaCheckCircle className="w-4 h-4" />
                        Available
                      </span>
                    </div>
                    <div className="flex flex-col items-center">
                      <div
                        className="w-16 bg-amber-400 rounded-t-lg relative hover:opacity-90 transition-opacity cursor-pointer shadow-lg"
                        style={{
                          height: `${
                            (userStats.pending_pets /
                              Math.max(userStats.total_posts, 1)) *
                            200
                          }px`,
                        }}
                      >
                        <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 font-bold text-amber-700">
                          {userStats.pending_pets}
                        </span>
                      </div>
                      <span className="mt-3 text-sm font-semibold flex items-center gap-1 text-amber-700">
                        <FaHourglassHalf className="w-4 h-4" />
                        Pending
                      </span>
                    </div>
                    <div className="flex flex-col items-center">
                      <div
                        className="w-16 bg-blue-400 rounded-t-lg relative hover:opacity-90 transition-opacity cursor-pointer shadow-lg"
                        style={{
                          height: `${
                            (userStats.adopted_pets /
                              Math.max(userStats.total_posts, 1)) *
                            200
                          }px`,
                        }}
                      >
                        <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 font-bold text-blue-700">
                          {userStats.adopted_pets}
                        </span>
                      </div>
                      <span className="mt-3 text-sm font-semibold flex items-center gap-1 text-blue-700">
                        <FaHeart className="w-4 h-4" />
                        Adopted
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Edit Profile Modal */}
        {showEditModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl p-8 w-full max-w-md mx-4 relative">
              <button
                className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 text-2xl"
                onClick={() => setShowEditModal(false)}
              >
                &times;
              </button>
              
              <h3 className="text-2xl font-bold text-slate-800 mb-6">Edit Profile</h3>
              
              {profileError && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-200">
                  {profileError}
                </div>
              )}
              
              <div className="space-y-4">
                <div>
                  <label className="block font-medium text-slate-700 mb-2">First Name</label>
                  <input
                    type="text"
                    className="w-full p-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Enter your first name"
                  />
                </div>
                
                <div>
                  <label className="block font-medium text-slate-700 mb-2">Last Name</label>
                  <input
                    type="text"
                    className="w-full p-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Enter your last name"
                  />
                </div>
                
                <div>
                  <label className="block font-medium text-slate-700 mb-2">Address</label>
                  <input
                    type="text"
                    className="w-full p-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Enter your address"
                  />
                </div>
                
                <div>
                  <label className="block font-medium text-slate-700 mb-2">Username</label>
                  <input
                    type="text"
                    className="w-full p-3 border border-slate-300 rounded-xl bg-slate-50 text-slate-500"
                    value={modalUsername}
                    disabled
                  />
                  <div className="text-xs text-slate-500 mt-1">
                    Username is automatically generated from your full name
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-8">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="px-6 py-3 bg-slate-200 text-slate-800 rounded-xl font-semibold hover:bg-slate-300 transition-all"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  onClick={saveProfile}
                  className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl font-semibold hover:from-indigo-600 hover:to-purple-600 transition-all shadow-lg"
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Custom Styles */}
        <style>
          {`
            .line-clamp-2 {
              display: -webkit-box;
              -webkit-line-clamp: 2;
              -webkit-box-orient: vertical;
              overflow: hidden;
            }
            
            @keyframes float {
              0%, 100% { transform: translateY(0) rotate(var(--rotation)); }
              50% { transform: translateY(-20px) rotate(var(--rotation)); }
            }
            
            .animate-float {
              --rotation: 0deg;
              animation: float 8s ease-in-out infinite;
            }
          `}
        </style>
      </div>
    </div>
  );
};
