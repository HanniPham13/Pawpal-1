import { useState, useEffect } from "react";
import { supabase } from "../supabase-client";
import { useAuth } from "../context/AuthContext";
import {
  FaBell,
  FaUser,
  FaPaw,
  FaEye,
  FaTrash,
  FaCheckSquare,
  FaRegSquare,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { AdoptionRequestDetails } from "./AdoptionRequestDetails";

interface Notification {
  id: number;
  user_id: string;
  type: string;
  message: string;
  read?: boolean;
  is_read?: boolean;
  created_at: string;
  link?: string;
  post_id?: number;
  requester_id?: string;
}

interface EnhancedNotification extends Notification {
  requestId?: number;
  requestStatus?: string;
  requestDate?: string;
  petName?: string;
  petImage?: string;
  petBreed?: string;
  petAge?: number;
  requesterName?: string;
}

const isNotificationRead = (notification: Notification) =>
  notification.read ?? notification.is_read ?? false;

const isMissingColumnError = (
  error: { message?: string | null; details?: string | null } | null,
  column: string
) => {
  if (!error) return false;
  const errorText = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return (
    errorText.includes(`"${column.toLowerCase()}"`) ||
    errorText.includes(`'${column.toLowerCase()}'`) ||
    errorText.includes(` ${column.toLowerCase()} `)
  );
};

export const NotificationBadge: React.FC = () => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [enhancedNotifications, setEnhancedNotifications] = useState<
    EnhancedNotification[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(
    null
  );
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedNotifications, setSelectedNotifications] = useState<number[]>(
    []
  );
  const [selectMode, setSelectMode] = useState(false);
  const navigate = useNavigate();

  const markNotificationAsReadInDb = async (notificationId: number) => {
    const primaryUpdate = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", notificationId);

    if (!isMissingColumnError(primaryUpdate.error, "read")) {
      return primaryUpdate.error;
    }

    const fallbackUpdate = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId);

    return fallbackUpdate.error;
  };

  const markAllNotificationsAsReadInDb = async (userId: string) => {
    const primaryUpdate = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", userId)
      .eq("read", false);

    if (!isMissingColumnError(primaryUpdate.error, "read")) {
      return primaryUpdate.error;
    }

    const fallbackUpdate = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);

    return fallbackUpdate.error;
  };

  // Fetch unread notifications count
  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      setNotifications([]);
      setEnhancedNotifications([]);
      return;
    }

    const fetchNotifications = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("notifications")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error fetching notifications:", error);
          return;
        }

        if (data) {
          setNotifications(data);
          // Count unread ones
          const unread = data.filter((n) => !isNotificationRead(n)).length;
          setUnreadCount(unread);

          // Enhance notifications with additional data
          const enhanced = await Promise.all(
            data.map(async (notification) => {
              const enhancedNotification: EnhancedNotification = {
                ...notification,
              };

              // Get adoption request details if this is a request notification
              if (
                notification.type === "adoption_request" &&
                notification.requester_id
              ) {
                try {
                  // Get request details if available
                  if (notification.post_id) {
                    const { data: requestData } = await supabase
                      .from("adoption_requests")
                      .select("id, status, created_at")
                      .eq("post_id", notification.post_id)
                      .eq("requester_id", notification.requester_id)
                      .order("created_at", { ascending: false })
                      .maybeSingle();

                    if (requestData) {
                      enhancedNotification.requestId = requestData.id;
                      enhancedNotification.requestStatus = requestData.status;
                      enhancedNotification.requestDate = requestData.created_at;
                    }
                  }

                  // Get pet name if available
                  if (notification.post_id) {
                    const { data: postData } = await supabase
                      .from("posts")
                      .select("name, image_url, breed, age")
                      .eq("id", notification.post_id)
                      .maybeSingle();

                    if (postData) {
                      enhancedNotification.petName = postData.name || "a pet";
                      enhancedNotification.petImage = postData.image_url;
                      enhancedNotification.petBreed = postData.breed;
                      enhancedNotification.petAge = postData.age;
                    }
                  }

                  // Try to get requester name
                  if (notification.requester_id) {
                    const requesterName = await getRequesterNameForNotification(
                      notification.requester_id
                    );
                    if (requesterName) {
                      enhancedNotification.requesterName = requesterName;
                    }
                  }
                } catch (err) {
                  console.error("Error enhancing notification:", err);
                }
              }

              return enhancedNotification;
            })
          );

          setEnhancedNotifications(enhanced);
        }
      } catch (err) {
        console.error("Error in notification processing:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();

    // Set up real-time subscription for new notifications
    const subscription = supabase
      .channel(
        `notifications_changes_${user.id}_${Math.random()
          .toString(36)
          .slice(2)}`
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user]);

  const refreshNotifications = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error refreshing notifications:", error);
        return;
      }

      if (data) {
        setNotifications(data);
        // Count unread ones
        const unread = data.filter((n) => !isNotificationRead(n)).length;
        setUnreadCount(unread);

        const enhanced = await Promise.all(
          data.map(async (notification) => {
            const enhancedNotification: EnhancedNotification = {
              ...notification,
            };

            if (
              notification.type === "adoption_request" &&
              notification.requester_id
            ) {
              try {
                if (notification.post_id) {
                  const { data: requestData } = await supabase
                    .from("adoption_requests")
                    .select("id, status, created_at")
                    .eq("post_id", notification.post_id)
                    .eq("requester_id", notification.requester_id)
                    .order("created_at", { ascending: false })
                    .maybeSingle();

                  if (requestData) {
                    enhancedNotification.requestId = requestData.id;
                    enhancedNotification.requestStatus = requestData.status;
                    enhancedNotification.requestDate = requestData.created_at;
                  }
                }

                if (notification.post_id) {
                  const { data: postData } = await supabase
                    .from("posts")
                    .select("name, image_url, breed, age")
                    .eq("id", notification.post_id)
                    .maybeSingle();

                  if (postData) {
                    enhancedNotification.petName = postData.name || "a pet";
                    enhancedNotification.petImage = postData.image_url;
                    enhancedNotification.petBreed = postData.breed;
                    enhancedNotification.petAge = postData.age;
                  }
                }

                if (notification.requester_id) {
                  const requesterName = await getRequesterNameForNotification(
                    notification.requester_id
                  );
                  if (requesterName) {
                    enhancedNotification.requesterName = requesterName;
                  }
                }
              } catch (err) {
                console.error("Error enhancing notification:", err);
              }
            }

            return enhancedNotification;
          })
        );

        setEnhancedNotifications(enhanced);

        // Reset selection when refreshing
        setSelectedNotifications([]);
        setSelectMode(false);
      }
    } catch (err) {
      console.error("Error refreshing notifications:", err);
    } finally {
      setLoading(false);
    }
  };

  // Function to get requester name - with error handling for missing profiles table
  const getRequesterNameForNotification = async (userId: string) => {
    if (!userId) return null;

    try {
      // First try to get from profiles table
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .maybeSingle();

      // If profiles table doesn't exist or other error, try auth.users directly
      if (error && error.code === "42P01") {
        // Relation doesn't exist
        try {
          // Fallback to auth.users if available
          const { data: userData, error: authError } = await supabase.rpc(
            "get_user_name",
            { user_id: userId }
          );

          if (!authError && userData) {
            return userData;
          }
        } catch (e) {
          console.error("Error in fallback user data fetch:", e);
        }
        return "Someone"; // Generic fallback
      }

      if (profile && profile.full_name) {
        return profile.full_name;
      }

      return "Someone"; // Generic fallback
    } catch (error) {
      console.error("Error fetching requester profile:", error);
      return "Someone"; // Generic fallback
    }
  };

  const markAsRead = async (notificationId: number) => {
    const error = await markNotificationAsReadInDb(notificationId);

    if (error) {
      console.error("Error marking notification as read:", error);
      return;
    }

    // Update local state
    setNotifications((prevNotifications) =>
      prevNotifications.map((notification) =>
        notification.id === notificationId
          ? { ...notification, read: true, is_read: true }
          : notification
      )
    );

    setEnhancedNotifications((prevNotifications) =>
      prevNotifications.map((notification) =>
        notification.id === notificationId
          ? { ...notification, read: true, is_read: true }
          : notification
      )
    );

    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const handleNotificationContentClick = async (
    notification: EnhancedNotification
  ) => {
    // Skip if we're in select mode
    if (selectMode) {
      toggleNotificationSelection(notification.id);
      return;
    }

    // Mark as read
    if (!isNotificationRead(notification)) {
      markAsRead(notification.id);
    }

    try {
      // If it's an adoption request notification with requestId, open the modal
      if (notification.type === "adoption_request" && notification.requestId) {
        viewAdoptionRequest(notification.requestId);
        return;
      }

      // For all notifications with post_id, navigate to the post detail page
      if (notification.post_id) {
        // Verify the post exists first
        const { data: postData, error: postError } = await supabase
          .from("posts")
          .select("id")
          .eq("id", notification.post_id)
          .maybeSingle();

        if (postError || !postData) {
          toast.error("The requested post is no longer available");
          navigate("/home");
          setShowDropdown(false);
          return;
        }

        // Navigate to post detail page
        navigate(`/post/${notification.post_id}`);
      } else if (notification.link) {
        // Use the provided link if available
        navigate(notification.link);
      }
    } catch (error) {
      console.error("Error navigating from notification:", error);
      toast.error("Could not open the notification details");
      // As fallback, just go to home
      navigate("/home");
    }

    setShowDropdown(false);
  };

  const viewAdoptionRequest = (requestId: number) => {
    setSelectedRequestId(requestId);
    setShowRequestModal(true);
    // Don't hide the dropdown yet - the modal will appear on top
  };

  const closeRequestModal = () => {
    setShowRequestModal(false);
    setSelectedRequestId(null);
    refreshNotifications();
  };

  const handleQuickAction = async (
    e: React.MouseEvent,
    notification: EnhancedNotification,
    action: "view" | "approve" | "deny"
  ) => {
    e.stopPropagation(); // Prevent parent click events

    if (action === "view" && notification.requestId) {
      viewAdoptionRequest(notification.requestId);
    } else {
      // For approve/deny actions, open the full details modal
      if (notification.requestId) {
        viewAdoptionRequest(notification.requestId);
      } else {
        handleNotificationContentClick(notification);
      }
    }
  };

  const markAllAsRead = async () => {
    if (notifications.length === 0 || !user) return;

    const error = await markAllNotificationsAsReadInDb(user.id);

    if (error) {
      console.error("Error marking all notifications as read:", error);
      return;
    }

    setNotifications((prevNotifications) =>
      prevNotifications.map((notification) => ({
        ...notification,
        read: true,
        is_read: true,
      }))
    );

    setEnhancedNotifications((prevNotifications) =>
      prevNotifications.map((notification) => ({
        ...notification,
        read: true,
        is_read: true,
      }))
    );

    setUnreadCount(0);
  };

  // Format notification message with enhanced data
  const formatNotificationMessage = (notification: EnhancedNotification) => {
    if (notification.type === "adoption_request") {
      const requesterName = notification.requesterName || "Someone";
      const petName = notification.petName || "your pet";
      return `${requesterName} has requested to adopt ${petName}`;
    }

    return notification.message;
  };

  // Get status badge for adoption requests
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs">
            Pending
          </span>
        );
      case "approved":
        return (
          <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">
            Approved
          </span>
        );
      case "rejected":
        return (
          <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs">
            Rejected
          </span>
        );
      default:
        return (
          <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-xs">
            {status}
          </span>
        );
    }
  };

  // Toggle selection mode
  const toggleSelectMode = () => {
    setSelectMode(!selectMode);
    if (!selectMode) {
      // Entering select mode, clear selections
      setSelectedNotifications([]);
    }
  };

  // Toggle selection of a notification
  const toggleNotificationSelection = (notificationId: number) => {
    setSelectedNotifications((prev) => {
      if (prev.includes(notificationId)) {
        return prev.filter((id) => id !== notificationId);
      } else {
        return [...prev, notificationId];
      }
    });
  };

  // Toggle select all notifications
  const toggleSelectAll = () => {
    if (selectedNotifications.length === enhancedNotifications.length) {
      // Deselect all
      setSelectedNotifications([]);
    } else {
      // Select all
      setSelectedNotifications(enhancedNotifications.map((n) => n.id));
    }
  };

  // Delete selected notifications
  const deleteSelectedNotifications = async () => {
    if (selectedNotifications.length === 0) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .in("id", selectedNotifications);

      if (error) {
        console.error("Error deleting notifications:", error);
        toast.error("Failed to delete notifications");
        return;
      }

      toast.success(`Deleted ${selectedNotifications.length} notification(s)`);

      // Refresh notifications
      refreshNotifications();
    } catch (err) {
      console.error("Error deleting notifications:", err);
      toast.error("Failed to delete notifications");
    } finally {
      setLoading(false);
      setSelectMode(false);
    }
  };

  if (!user) return null;

  return (
    <div className="relative">
      <button
        className="relative p-2 rounded-full hover:bg-violet-100 transition-colors"
        onClick={() => {
          const willOpen = !showDropdown;
          setShowDropdown(willOpen);
          if (willOpen) {
            refreshNotifications();
          }
        }}
      >
        <FaBell className="text-violet-800 text-xl" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <div className="absolute right-0 mt-2 w-96 bg-white shadow-lg rounded-lg overflow-hidden z-50 border border-violet-100">
          <div className="p-3 bg-gradient-to-r from-violet-500 to-purple-500 text-white flex justify-between items-center">
            <h3 className="font-semibold font-['Quicksand']">Notifications</h3>
            <div className="flex items-center space-x-2">
              {!selectMode ? (
                <>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-xs bg-white text-violet-800 px-2 py-1 rounded font-['Poppins']"
                    >
                      Mark all read
                    </button>
                  )}
                  <button
                    onClick={toggleSelectMode}
                    className="text-xs bg-white text-violet-800 px-2 py-1 rounded font-['Poppins']"
                    title="Select and delete notifications"
                  >
                    Select
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={toggleSelectAll}
                    className="text-xs bg-white text-violet-800 px-2 py-1 rounded font-['Poppins'] flex items-center gap-1"
                  >
                    {selectedNotifications.length ===
                    enhancedNotifications.length ? (
                      <>
                        <FaCheckSquare className="text-violet-600" />
                        Deselect All
                      </>
                    ) : (
                      <>
                        <FaRegSquare className="text-violet-600" />
                        Select All
                      </>
                    )}
                  </button>
                  {selectedNotifications.length > 0 && (
                    <button
                      onClick={deleteSelectedNotifications}
                      className="text-xs bg-red-500 text-white px-2 py-1 rounded font-['Poppins'] flex items-center gap-1"
                    >
                      <FaTrash />
                      Delete ({selectedNotifications.length})
                    </button>
                  )}
                  <button
                    onClick={toggleSelectMode}
                    className="text-xs bg-gray-200 text-gray-800 px-2 py-1 rounded font-['Poppins']"
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="max-h-[70vh] overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-t-2  border-r-2 border-violet-300 mx-auto"></div>
                <p className="text-sm text-gray-500 mt-2">
                  Loading notifications...
                </p>
              </div>
            ) : enhancedNotifications.length > 0 ? (
              enhancedNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-3 border-b border-gray-100 ${
                    selectMode ? "cursor-pointer" : ""
                   } hover:bg-violet-50 transition-colors ${
                    !isNotificationRead(notification) ? "bg-violet-50" : ""
                  } ${
                    selectedNotifications.includes(notification.id)
                      ? "bg-violet-100"
                      : ""
                  }`}
                  onClick={() =>
                    selectMode && toggleNotificationSelection(notification.id)
                  }
                >
                  <div className="flex items-start gap-3">
                    {selectMode && (
                      <div className="mt-2">
                        {selectedNotifications.includes(notification.id) ? (
                          <FaCheckSquare className="text-violet-600 text-lg" />
                        ) : (
                          <FaRegSquare className="text-violet-300 text-lg" />
                        )}
                      </div>
                    )}

                    {notification.type === "adoption_request" &&
                    notification.petImage ? (
                      <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border-2 border-violet-200">
                        <img
                          src={notification.petImage}
                          alt="Pet"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
                        {notification.type === "adoption_request" ? (
                          <FaPaw className="text-2xl text-violet-600" />
                        ) : (
                          <FaUser className="text-2xl text-violet-600" />
                        )}
                      </div>
                    )}

                    <div
                      className="flex-1 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!selectMode) {
                          handleNotificationContentClick(notification);
                        }
                      }}
                    >
                      <div className="flex justify-between">
                        <p className="text-sm font-medium text-violet-800 font-['Poppins'] capitalize">
                          {notification.type.replace(/_/g, " ")}
                        </p>
                        <span className="text-xs text-gray-500">
                          {new Date(
                            notification.created_at
                          ).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1 font-['Poppins']">
                        {formatNotificationMessage(notification)}
                      </p>

                      {notification.type === "adoption_request" &&
                        notification.petName && (
                          <div className="mt-1 text-xs text-gray-600">
                            <div className="flex items-center mt-1 gap-2">
                              <div className="text-violet-700 font-medium">
                                Pet details:
                              </div>
                              {notification.petBreed && (
                                <div>{notification.petBreed}</div>
                              )}
                              {notification.petAge && (
                                <div>• {notification.petAge}</div>
                              )}
                            </div>

                            {notification.requestStatus && (
                              <div className="mt-2">
                                {getStatusBadge(notification.requestStatus)}
                              </div>
                            )}
                          </div>
                        )}

                      {/* Action buttons for adoption requests - visible only when not in select mode */}
                      {!selectMode &&
                        notification.type === "adoption_request" &&
                        notification.requestId && (
                          <div className="mt-3 flex gap-2 justify-end">
                            <button
                              onClick={(e) =>
                                handleQuickAction(e, notification, "view")
                              }
                              className="px-2 py-1 bg-violet-100 text-violet-700 rounded-lg text-xs flex items-center gap-1 hover:bg-violet-200 transition-colors"
                            >
                              <FaEye className="text-xs" />
                              View Details
                            </button>
                          </div>
                        )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-4 text-center text-gray-500 font-['Poppins']">
                No notifications yet
              </div>
            )}
          </div>
        </div>
      )}

      {/* Adoption Request Modal */}
      {showRequestModal && selectedRequestId && (
        <AdoptionRequestDetails
          requestId={selectedRequestId}
          onClose={closeRequestModal}
          onStatusChange={refreshNotifications}
        />
      )}
    </div>
  );
};
