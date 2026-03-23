import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { FaBars, FaComments, FaPaperPlane, FaChevronLeft, FaChevronRight, FaCheckCircle, FaHeart } from "react-icons/fa";
import { supabase } from "../supabase-client";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

// Interface for chat messages
interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
  sender_name?: string;
  sender_avatar?: string | null;
  image_url?: string; // <-- add this line
}

// Interface for conversation participants
interface Conversation {
  conversation_id: string;
  title: string;
  is_group: boolean;
  created_at: string;
  updated_at: string;
  last_message?: string;
  last_message_time?: string | null;
  last_message_sender?: string | null;
  other_user_id?: string | null;
  other_user_name?: string;
  other_user_avatar?: string | null;
  unread_count: number;
  pet_name?: string;
  post_id?: number | null;
  adopter_name?: string;
  owner_name?: string;
}

// Add this interface near the top with other interfaces
interface ConversationDetails {
  id: string;
  title: string;
  pet_name?: string;
  post_id?: number;
  created_at: string;
  updated_at: string;
}

const ChatPage: React.FC = () => {
  // Get the conversation ID from URL params, or null if on main chat page
  const { conversationId } = useParams<{ conversationId?: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCreatingConversation, setIsCreatingConversation] =
    useState<boolean>(false);
  const [hasRunCleanup, setHasRunCleanup] = useState<boolean>(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  // Add state for sidebar collapse
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Add state for delete dialog
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Add state for image upload
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isGenericChatName = useCallback((value?: string | null) => {
    if (!value) return true;
    const normalized = value.trim();
    if (!normalized) return true;
    const lower = normalized.toLowerCase();
    if (lower === "user" || lower === "unknown" || lower === "unknown user" || lower === "other user" || lower === "chat") {
      return true;
    }
    if (/^user\s+[a-f0-9]{3,}$/i.test(normalized)) {
      return true;
    }
    return false;
  }, []);

  const updateDocumentTitle = useCallback((userName: string | undefined) => {
    if (userName) {
      document.title = `Chat with ${userName}`;
    } else {
      document.title = "Pawpal Chat";
    }
  }, []);

  // Resolve display names consistently so chat shows real names (e.g., "Joey De Guzman")
  const getUserInfo = useCallback(
    async (userId: string) => {
      if (!userId) return { name: "User", email: "", avatar: null };

      try {
        const [{ data: profileData }, { data: userData }] = await Promise.all([
          supabase
            .from("profiles")
            .select("full_name, avatar_url")
            .eq("id", userId)
            .maybeSingle(),
          supabase
            .from("users")
            .select("full_name, email")
            .eq("user_id", userId)
            .maybeSingle(),
        ]);

        const cleanName = (value?: string | null) => {
          if (!value) return "";
          const normalized = value.trim();
          if (!normalized) return "";
          if (normalized.toLowerCase() === "unknown") return "";
          return normalized;
        };

        let displayName =
          cleanName(profileData?.full_name) || cleanName(userData?.full_name);

        // RPC has stronger fallbacks (profiles -> users -> auth.users metadata)
        if (!displayName) {
          const { data: rpcName } = await supabase.rpc("get_user_display_name", {
            target_user_id: userId,
          });
          displayName = cleanName(Array.isArray(rpcName) ? rpcName[0] : rpcName);
        }

        // Some DB versions use user_uuid instead of target_user_id.
        if (!displayName) {
          const { data: rpcNameLegacy } = await supabase.rpc("get_user_display_name", {
            user_uuid: userId,
          });
          displayName = cleanName(
            Array.isArray(rpcNameLegacy) ? rpcNameLegacy[0] : rpcNameLegacy
          );
        }

        if (!displayName && userId === user?.id) {
          displayName =
            cleanName(user?.user_metadata?.full_name) ||
            cleanName(user?.email?.split("@")[0]);
        }

        if (!displayName) {
          displayName = cleanName(userData?.email?.split("@")[0]);
        }

        const resolvedEmail = userData?.email || (userId === user?.id ? user?.email || "" : "");

        return {
          name: displayName || `User ${userId.substring(0, 6)}`,
          email: resolvedEmail,
          avatar: profileData?.avatar_url || null,
        };
      } catch (error) {
        console.error("Error getting user info:", error);
        return {
          name: `User ${userId.substring(0, 6)}`,
          email: "",
          avatar: null,
        };
      }
    },
    [user]
  );

  // Fetch all conversations for the current user
  const fetchConversations = useCallback(
    async (showLoading: boolean = true) => {
      if (showLoading) setIsLoading(true);
      const start = Date.now();
      if (!user) return;

      try {
        console.log("Starting to fetch conversations...");

        // Get all conversations this user is part of
        const { data: userConvos, error: userConvosError } = await supabase
          .from("user_conversations")
          .select("conversation_id")
          .eq("user_id", user.id);

        if (userConvosError) {
          console.error("Error fetching user conversations:", userConvosError);
          setIsLoading(false);
          return;
        }

        console.log("User conversations:", userConvos);

        if (!userConvos || userConvos.length === 0) {
          console.log("No conversations found");
          setConversations([]);
          setIsLoading(false);
          return;
        }

        // Get unique conversation IDs
        const uniqueConvoIds = [
          ...new Set(userConvos.map((uc) => uc.conversation_id)),
        ];
        console.log(`Found ${uniqueConvoIds.length} unique conversation IDs`);

        // Get details of those conversations
        const { data: convosData, error: convosError } = await supabase
          .from("conversations")
          .select("*")
          .in("id", uniqueConvoIds);

        if (convosError) {
          console.error("Error fetching conversation details:", convosError);
          setIsLoading(false);
          return;
        }

        console.log("Conversation details:", convosData);

        try {
          // Process each conversation to get additional details
          const processedConvos = await Promise.all(
            convosData.map(async (convo) => {
              console.log(`Processing conversation ${convo.id}...`);
              try {
                // Get the other user in this conversation
                const { data: members, error: membersError } = await supabase
                  .from("user_conversations")
                  .select("user_id")
                  .eq("conversation_id", convo.id)
                  .neq("user_id", user.id);

                console.log(`Members for conversation ${convo.id}:`, members);

                if (membersError) {
                  console.error(
                    `Error fetching members for conversation ${convo.id}:`,
                    membersError
                  );
                }

                let otherUserId = null;
                let otherUserInfo = {
                  name: "User",
                  email: "",
                  avatar: null as string | null,
                };

                // Get the other user's username (email prefix)
                if (members && members.length > 0) {
                  otherUserId = members[0].user_id;
                  otherUserInfo = await getUserInfo(otherUserId);
                }

                // Get last message
                const { data: lastMessage, error: lastMessageError } =
                  await supabase
                    .from("messages")
                    .select("content, created_at, sender_id")
                    .eq("conversation_id", convo.id)
                    .order("created_at", { ascending: false })
                    .limit(1);

                if (lastMessageError) {
                  console.error(
                    `Error fetching last message for conversation ${convo.id}:`,
                    lastMessageError
                  );
                }

                // Get unread count
                const { data: userConvo, error: userConvoError } =
                  await supabase
                    .from("user_conversations")
                    .select("last_read")
                    .eq("conversation_id", convo.id)
                    .eq("user_id", user.id)
                    .single();

                if (userConvoError) {
                  console.error(
                    `Error fetching user_conversation for ${convo.id}:`,
                    userConvoError
                  );
                }

                const lastReadTime = userConvo?.last_read;

                let unreadCount = 0;
                try {
                  const { count, error: countError } = await supabase
                    .from("messages")
                    .select("id", { count: "exact", head: true })
                    .eq("conversation_id", convo.id)
                    .neq("sender_id", user.id)
                    .gt("created_at", lastReadTime || "1970-01-01");

                  if (!countError && count !== null) {
                    unreadCount = count;
                  }
                } catch (countError) {
                  console.error(
                    `Error getting unread count for conversation ${convo.id}:`,
                    countError
                  );
                }

                const currentUserCandidates = [
                  user?.user_metadata?.full_name,
                  user?.email,
                  user?.email?.split("@")[0],
                ]
                  .filter(Boolean)
                  .map((name) => String(name).trim().toLowerCase());

                const displayNameCandidates = [
                  otherUserInfo.name,
                  convo.title,
                  convo.owner_name,
                  convo.adopter_name,
                ];

                const displayName =
                  displayNameCandidates.find((name) => {
                    if (isGenericChatName(name)) return false;
                    const normalized = String(name).trim().toLowerCase();
                    return !currentUserCandidates.includes(normalized);
                  }) || "User";

                const processedConvo = {
                  conversation_id: convo.id,
                  title: convo.title || "Chat",
                  is_group: convo.is_group || false,
                  created_at: convo.created_at,
                  updated_at: convo.updated_at,
                  last_message:
                    lastMessage && lastMessage.length > 0
                      ? lastMessage[0].content
                      : "No messages yet",
                  last_message_time:
                    lastMessage && lastMessage.length > 0
                      ? lastMessage[0].created_at
                      : null,
                  last_message_sender:
                    lastMessage && lastMessage.length > 0
                      ? lastMessage[0].sender_id
                      : null,
                  other_user_id: otherUserId,
                  other_user_name: displayName,
                  other_user_avatar: otherUserInfo.avatar,
                  pet_name: convo.pet_name, // Store for metadata, but not used for display
                  post_id: convo.post_id,
                  adopter_name: convo.adopter_name,
                  owner_name: convo.owner_name,
                  unread_count: unreadCount || 0,
                } as Conversation;

                console.log("Processed conversation:", processedConvo);

                return processedConvo;
              } catch (convoError) {
                console.error(
                  `Error processing conversation ${convo.id}:`,
                  convoError
                );
                // Return a simplified version of the conversation to prevent the entire process from failing
                return {
                  conversation_id: convo.id,
                  title: convo.title || "Chat",
                  is_group: convo.is_group || false,
                  created_at: convo.created_at,
                  updated_at: convo.updated_at,
                  last_message: "Error loading message",
                  other_user_name: !isGenericChatName(convo.title) ? convo.title : "User",
                  unread_count: 0,
                } as Conversation;
              }
            })
          );

          console.log("All processed conversations:", processedConvos);

          // Show all processed conversations (no deduplication)
          processedConvos.sort((a, b) => {
            const timeA = a.last_message_time
              ? new Date(a.last_message_time).getTime()
              : 0;
            const timeB = b.last_message_time
              ? new Date(b.last_message_time).getTime()
              : 0;
            return timeB - timeA; // Most recent first
          });
          setConversations(processedConvos);

          // Defensive: only set loading false after conversations are set
          if (showLoading) {
            const elapsed = Date.now() - start;
            setTimeout(() => setIsLoading(false), Math.max(0, 300 - elapsed));
          }
        } catch (processError) {
          console.error("Error processing conversations:", processError);
        }
      } catch (error) {
        console.error("Error fetching conversations:", error);
        toast.error("Failed to load conversations");
        setIsLoading(false);
      }
    },
    [user, getUserInfo]
  );

  // Mark messages as read when viewing a conversation
  const markMessagesAsRead = useCallback(async () => {
    if (!user || !conversationId) return;

    try {
      // Call the database function to mark messages as read
      await supabase.rpc("mark_messages_as_read", {
        conv_id: conversationId,
        user_uuid: user.id,
      });
    } catch (error) {
      console.error("Error marking messages as read:", error);
    }
  }, [user, conversationId]);

  // Fetch conversation messages with email focus
  const fetchMessages = useCallback(async () => {
    if (!user || !conversationId) return;

    try {
      setIsLoading(true);

      // First verify the conversation still exists
      const { error: checkError } = await supabase
        .from("conversations")
        .select("id")
        .eq("id", conversationId)
        .single();

      if (checkError) {
        // Only redirect if it's actually not found (code PGRST116)
        if (checkError.code === "PGRST116") {
          toast.error(
            "This conversation no longer exists. You will be redirected.",
            {
              id: "conversation-not-found",
              duration: 5000,
            }
          );

          // Wait a moment before redirecting
          setTimeout(() => {
            navigate("/chat");
          }, 2000);

          setIsLoading(false);
          return;
        }
        // For other errors, we can still try to load messages
      }

      // Check if we have the conversation data with pet name
      const { data: conversationData, error: conversationError } =
        await supabase
          .from("conversations")
          .select("pet_name, title")
          .eq("id", conversationId)
          .single();

      // Get a pet name to use for messages
      let petName = null;
      if (!conversationError && conversationData && conversationData.pet_name) {
        petName = conversationData.pet_name;
      }

      // Get messages for this conversation
      const { data, error } = await supabase
        .from("messages")
        .select(
          `
          id,
          conversation_id,
          sender_id,
          content,
          created_at,
          is_read,
          image_url
        `
        )
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) {
        // Special handling for foreign key violation (conversation doesn't exist)
        if (error.code === "23503") {
          toast.error(
            "Unable to load messages. The conversation may have been deleted."
          );
          setTimeout(() => {
            navigate("/chat");
          }, 2000);
          setIsLoading(false);
          return;
        }
        throw error;
      }

      // If we don't have a pet name from the conversation table, try looking it up
      if (!petName) {
        // Check if we have an adoption conversation
        let adoptedPetName = null;

        // Get the other user in this conversation
        const { data: members, error: membersError } = await supabase
          .from("user_conversations")
          .select("user_id")
          .eq("conversation_id", conversationId)
          .neq("user_id", user.id);

        if (!membersError && members && members.length > 0) {
          const otherUserId = members[0].user_id;

          // Check for adoption requests between these users
          const { data: adoptionData, error: adoptionError } = await supabase
            .from("adoption_requests")
            .select("pet_name, post_id, status")
            .or(`requester_id.eq.${user.id},owner_id.eq.${user.id}`)
            .or(`requester_id.eq.${otherUserId},owner_id.eq.${otherUserId}`)
            .order("updated_at", { ascending: false })
            .limit(1);

          if (
            !adoptionError &&
            adoptionData &&
            adoptionData.length > 0 &&
            adoptionData[0].pet_name
          ) {
            // Found an adoption request with pet name - store for metadata
            adoptedPetName = adoptionData[0].pet_name;
            petName = adoptedPetName;

            // Get user name for the title instead of pet name
            const otherUserInfo = await getUserInfo(otherUserId);
            const userDisplayName = otherUserInfo.name || "User";

            // Update the conversation - use user name for title
            await supabase
              .from("conversations")
              .update({
                pet_name: adoptedPetName, // Store pet name for metadata
                title: userDisplayName, // Use user name for title
              })
              .eq("id", conversationId);
          }
        }
      }

      // Get the other user in this conversation to determine roles
      const { data: members, error: membersError } = await supabase
        .from("user_conversations")
        .select("user_id")
        .eq("conversation_id", conversationId)
        .neq("user_id", user.id);

      let otherUserId = null;
      let otherUserName = null;

      if (!membersError && members && members.length > 0) {
        otherUserId = members[0].user_id;

        // Check adoption requests to determine roles
        const { data: adoptionData, error: adoptionError } = await supabase
          .from("adoption_requests")
          .select("requester_id, owner_id, pet_name")
          .or(`requester_id.eq.${user.id},owner_id.eq.${user.id}`)
          .or(`requester_id.eq.${otherUserId},owner_id.eq.${otherUserId}`)
          .order("updated_at", { ascending: false })
          .limit(1);

        if (!adoptionError && adoptionData && adoptionData.length > 0) {
          const otherInfo = await getUserInfo(otherUserId);
          otherUserName = otherInfo.name;
        }
      }

      // Format messages with sender info
      const formattedMessages = await Promise.all(
        data.map(async (msg: Message) => {
          // Your own messages
          if (msg.sender_id === user.id) {
            return {
              id: msg.id,
              conversation_id: msg.conversation_id,
              sender_id: msg.sender_id,
              content: msg.content,
              created_at: msg.created_at,
              is_read: msg.is_read,
              image_url: msg.image_url,
              sender_name: "You",
              sender_avatar: null,
            };
          }

          // Use the already-resolved username, or look it up
          if (otherUserName) {
            return {
              id: msg.id,
              conversation_id: msg.conversation_id,
              sender_id: msg.sender_id,
              content: msg.content,
              created_at: msg.created_at,
              is_read: msg.is_read,
              image_url: msg.image_url,
              sender_name: otherUserName,
              sender_avatar: null,
            };
          }

          // Fallback - get the sender's username
          const senderInfo = await getUserInfo(msg.sender_id);

          return {
            id: msg.id,
            conversation_id: msg.conversation_id,
            sender_id: msg.sender_id,
            content: msg.content,
            created_at: msg.created_at,
            is_read: msg.is_read,
            image_url: msg.image_url,
            sender_name: senderInfo.name,
            sender_avatar: senderInfo.avatar,
          };
        })
      );

      setMessages(formattedMessages);
    } catch (error: unknown) {
      console.error("Error fetching messages:", error);
      toast.error("Failed to load messages");
    } finally {
      setIsLoading(false);
    }
  }, [user, conversationId, navigate, getUserInfo]);

  const fetchConversationDetails = useCallback(async () => {
    if (!conversationId || !user) return;

    try {
      // First check if the conversation still exists
      const { error: checkError } = await supabase
        .from("conversations")
        .select("id")
        .eq("id", conversationId)
        .single();

      if (checkError) {
        // Only redirect for not found errors
        if (checkError.code === "PGRST116") {
          toast.error(
            "This conversation no longer exists. You will be redirected.",
            {
              id: "conversation-not-found",
              duration: 5000,
            }
          );

          // Wait a moment before redirecting
          setTimeout(() => {
            navigate("/chat");
          }, 2000);

          return;
        }
        // For other errors, continue trying
      }

      // First get the conversation itself
      const { data: conversationData, error: conversationError } =
        await supabase
          .from("conversations")
          .select("*")
          .eq("id", conversationId)
          .single();

      if (conversationError) {
        // Special handling for not found
        if (conversationError.code === "PGRST116") {
          toast.error(
            "This conversation no longer exists. You will be redirected."
          );
          setTimeout(() => {
            navigate("/chat");
          }, 2000);
          return;
        }
        throw conversationError;
      }

      // Just get the other user's username for the chat title
      // Get the other user in this conversation
      const { data: members, error: membersError } = await supabase
        .from("user_conversations")
        .select("user_id")
        .eq("conversation_id", conversationId)
        .neq("user_id", user.id);

      if (membersError) throw membersError;

      if (members && members.length > 0) {
        const otherUserId = members[0].user_id;
        const otherInfo = await getUserInfo(otherUserId);
        const username =
          !isGenericChatName(otherInfo.name)
            ? otherInfo.name
            : !isGenericChatName(conversationData.title)
            ? conversationData.title
            : "User";

        // Update conversation title with username
        if (!isGenericChatName(username)) {
          await supabase
            .from("conversations")
            .update({ title: username })
            .eq("id", conversationId);
        }

        document.title = `Chat with ${username}`;
      }
    } catch (error) {
      console.error("Error fetching conversation details:", error);
    }
  }, [conversationId, user, navigate, getUserInfo, updateDocumentTitle, isGenericChatName]);

  // Start a new conversation with a user
  const startConversation = useCallback(
    async (otherUserId: string) => {
      if (!user) return;

      try {
        setIsCreatingConversation(true);
        toast.loading("Starting conversation...", { id: "creating-convo" });

        // Get the pet name and post id from location state if available
        const petName = location.state?.petName || null;
        const postId =
          location.state?.postId || location.state?.post_id || null;

        // First check for existing conversations
        const { data: existingConversation, error: existingError } =
          await supabase.rpc("find_shared_conversation", {
            user_id_1: user.id,
            user_id_2: otherUserId,
            specific_post_id: postId,
          });

        if (
          !existingError &&
          existingConversation &&
          existingConversation.length > 0
        ) {
          const conversationId = existingConversation[0].conversation_id;
          toast.success("Continuing existing conversation", {
            id: "creating-convo",
          });

          // Small delay to ensure UI updates properly
          setTimeout(() => {
            setIsCreatingConversation(false);
            navigate(`/chat/${conversationId}`);
          }, 500);
          return;
        }

        // If no existing conversation, proceed with creation
        // Get user name for the title
        const receiverUserInfo = await getUserInfo(otherUserId);
        const receiverDisplayName = receiverUserInfo.name || "User";
        
        const { data: newConversation, error: createError } = await supabase
          .from("conversations")
          .insert({
            title: receiverDisplayName, // Use user name instead of pet name
            pet_name: petName, // Store pet name for metadata only
            post_id: postId,
            is_group: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (createError) throw createError;

        if (!newConversation || !newConversation.id) {
          throw new Error("Failed to create conversation");
        }

        // Add both users to the conversation
        const { error: userConvosError } = await supabase
          .from("user_conversations")
          .insert([
            {
              user_id: user.id,
              conversation_id: newConversation.id,
              joined_at: new Date().toISOString(),
              last_read: new Date().toISOString(),
            },
            {
              user_id: otherUserId,
              conversation_id: newConversation.id,
              joined_at: new Date().toISOString(),
              last_read: new Date().toISOString(),
            },
          ]);

        if (userConvosError) throw userConvosError;

        toast.success("Started new conversation", { id: "creating-convo" });

        // Small delay to ensure UI updates properly
        setTimeout(() => {
          setIsCreatingConversation(false);
          navigate(`/chat/${newConversation.id}`);
        }, 500);
      } catch (error) {
        console.error("Error starting conversation:", error);
        toast.error("Failed to start conversation", { id: "creating-convo" });
        setIsCreatingConversation(false);
      }
    },
    [user, location.state, navigate]
  );

  // Function to clean up duplicate conversations for the current user
  const cleanupDuplicateConversations = useCallback(
    async (silent: boolean = false) => {
      if (!user) return;

      try {
        if (!silent) {
          toast.loading("Cleaning up conversations...", {
            id: "cleanup-convos",
          });
        }

        // Get all conversations for the current user
        const { data: userConvos, error: userConvosError } = await supabase
          .from("user_conversations")
          .select("conversation_id")
          .eq("user_id", user.id);

        if (userConvosError) throw userConvosError;

        if (!userConvos || userConvos.length === 0) {
          if (!silent) {
            toast.success("No conversations to clean up", {
              id: "cleanup-convos",
            });
          }
          return;
        }

        const convoIds = userConvos.map((uc) => uc.conversation_id);

        // Get conversation details
        const { data: conversations, error: convosError } = await supabase
          .from("conversations")
          .select("*")
          .in("id", convoIds);

        if (convosError) throw convosError;

        // Group conversations by post_id
        const postGroups = conversations.reduce(
          (
            groups: Record<string, ConversationDetails[]>,
            convo: ConversationDetails
          ) => {
            if (convo.post_id) {
              const key = `post_${convo.post_id}`;
              if (!groups[key]) groups[key] = [];
              groups[key].push(convo);
            }
            return groups;
          },
          {}
        );

        let mergedCount = 0;
        let currentConversationMerged = false;
        let redirectToConversationId = null;

        // Process each group of duplicates
        for (const duplicates of Object.values(
          postGroups
        ) as ConversationDetails[][]) {
          if (duplicates.length <= 1) continue;

          // Sort by created_at to keep the oldest conversation
          duplicates.sort(
            (a: ConversationDetails, b: ConversationDetails) =>
              new Date(a.created_at).getTime() -
              new Date(b.created_at).getTime()
          );

          const keeper = duplicates[0];
          const duplicatesToRemove = duplicates.slice(1);

          for (const dupe of duplicatesToRemove) {
            // Check if currently viewed conversation is being merged
            if (conversationId === dupe.id) {
              currentConversationMerged = true;
              redirectToConversationId = keeper.id;
            }

            // Move messages to the keeper conversation
            await supabase
              .from("messages")
              .update({ conversation_id: keeper.id })
              .eq("conversation_id", dupe.id);

            // Delete the duplicate conversation and its user associations
            await supabase
              .from("user_conversations")
              .delete()
              .eq("conversation_id", dupe.id);

            await supabase.from("conversations").delete().eq("id", dupe.id);

            mergedCount++;
          }
        }

        if (mergedCount > 0) {
          if (!silent) {
            toast.success(`Merged ${mergedCount} duplicate conversations`, {
              id: "cleanup-convos",
            });
          }

          // If current conversation was merged, redirect to the keeper
          if (currentConversationMerged && redirectToConversationId) {
            toast.success("Redirecting to merged conversation...", {
              id: "redirect-notice",
            });
            setTimeout(() => {
              navigate(`/chat/${redirectToConversationId}`);
            }, 1000);
          }

          // Refresh conversations list
          fetchConversations();
        } else if (!silent) {
          toast.success("No duplicates found", { id: "cleanup-convos" });
        }
      } catch (error) {
        console.error("Error cleaning up conversations:", error);
        if (!silent) {
          toast.error("Failed to clean up conversations", {
            id: "cleanup-convos",
          });
        }
      }
    },
    [user, conversationId, navigate, fetchConversations]
  );

  // Check if we have an otherUserId from navigation state
  useEffect(() => {
    if (user) {
      // Create or ensure user profile exists
      const createUserProfile = async () => {
        // Check if profile exists
        const { error } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", user.id)
          .single();

        if (error) {
          // Profile doesn't exist, create one
          await supabase.from("profiles").insert({
            id: user.id,
            full_name: user.email || `User ${user.id.substring(0, 6)}`,
            updated_at: new Date().toISOString(),
          });
        }
      };

      createUserProfile();

      // If we have an otherUserId in the location state, start a conversation with them
      if (location.state?.otherUserId) {
        startConversation(location.state.otherUserId);

        // Clear the state so we don't keep starting the same conversation
        navigate("/chat", { replace: true });
      }
    }
  }, [user, location.state, startConversation, navigate]);

  // Setup scheduled cleanup when the component mounts
  useEffect(() => {
    if (!user) return;

    // Run initial cleanup silently when component mounts
    if (!hasRunCleanup) {
      // Small delay to not block initial render
      const initialCleanupTimeout = setTimeout(() => {
        cleanupDuplicateConversations(true);
        setHasRunCleanup(true);
      }, 3000);

      return () => clearTimeout(initialCleanupTimeout);
    }

    // Run periodic cleanup every 30 minutes while the chat page is open
    const cleanupInterval = setInterval(() => {
      // Only run if we're on the main chat page (not in a specific conversation)
      if (!conversationId) {
        console.log("Running scheduled cleanup check");
        cleanupDuplicateConversations(true);
      }
    }, 30 * 60 * 1000); // 30 minutes

    return () => clearInterval(cleanupInterval);
  }, [user, conversationId, hasRunCleanup, cleanupDuplicateConversations]);

  // Handle real-time subscription
  useEffect(() => {
    if (!user) return;

    // Always fetch conversations for the sidebar (show loading spinner on mount)
    fetchConversations(true);

    // Subscribe to conversation changes for the sidebar (no spinner on real-time updates)
    const sidebarSubscription = supabase
      .channel("conversation_updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
        },
        () => fetchConversations(false)
      )
      .subscribe();

    // Subscribe to user_conversations updates for the sidebar (no spinner on real-time updates)
    const userConvoSubscription = supabase
      .channel("user_conversations_updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_conversations",
          filter: `user_id=eq.${user.id}`,
        },
        () => fetchConversations(false)
      )
      .subscribe();

    // If in a specific conversation, also fetch messages and subscribe
    let messageSubscription: ReturnType<typeof supabase.channel> | undefined;
    if (conversationId) {
      fetchMessages();
      markMessagesAsRead();

      messageSubscription = supabase
        .channel(`room:${conversationId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `conversation_id=eq.${conversationId}`,
          },
          async (payload) => {
            const newMessage = payload.new as Message;
            // Format the new message with sender info
            const formattedMessage = { ...newMessage };
            if (newMessage.sender_id === user.id) {
              // Always label your own messages as \"You\"
              formattedMessage.sender_name = "You";
              formattedMessage.sender_avatar = null;
            } else {
              // Get the other participant and pet from the current conversation
              const currentConversation = conversations.find(
                (c) => c.conversation_id === conversationId
              );

              if (
                currentConversation &&
                currentConversation.adopter_name &&
                currentConversation.owner_name
              ) {
                // Determine which base name to show based on the viewer's role
                let baseName: string;
                if (user.email === currentConversation.adopter_name) {
                  // Viewer is adopter -> show owner name
                  baseName = currentConversation.owner_name;
                } else if (user.email === currentConversation.owner_name) {
                  // Viewer is owner -> show adopter name
                  baseName = currentConversation.adopter_name;
                } else {
                  // Fallback to getUserInfo if we can't match roles
              const senderInfo = await getUserInfo(newMessage.sender_id);
                  baseName = senderInfo.name;
                }

                const petNameForLabel = currentConversation.pet_name;
                formattedMessage.sender_name =
                  petNameForLabel && baseName
                    ? `${baseName} · ${petNameForLabel}`
                    : baseName;
              } else {
                // Fallback to getUserInfo if conversation data not available
                const senderInfo = await getUserInfo(newMessage.sender_id);
                formattedMessage.sender_name = senderInfo.name;
              }

              formattedMessage.sender_avatar = null;
            }
            setMessages((prevMessages) => [...prevMessages, formattedMessage]);
            // If this is not our message, mark it as read
            if (newMessage.sender_id !== user.id) {
              markMessagesAsRead();
            }
          }
        )
        .subscribe();
    }

    return () => {
      supabase.removeChannel(sidebarSubscription);
      supabase.removeChannel(userConvoSubscription);
      if (messageSubscription) supabase.removeChannel(messageSubscription);
    };
  }, [
    user,
    conversationId,
    hasRunCleanup,
    fetchConversations,
    fetchMessages,
    markMessagesAsRead,
    getUserInfo,
  ]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Fetch conversation details
  useEffect(() => {
    if (conversationId && user) {
      fetchConversationDetails();
    }
  }, [conversationId, user, fetchConversationDetails]);

  // Add debug logs for loading state
  useEffect(() => {
    console.log("Current loading state:", isLoading);
  }, [isLoading]);

  // Send a new message
  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!message.trim() || !user || !conversationId) return;

    try {
      // First verify that the conversation exists
      const { error: checkError } = await supabase
        .from("conversations")
        .select("id")
        .eq("id", conversationId)
        .single();

      if (checkError) {
        // Only redirect if we get a real error finding the conversation
        // (not just if we get null, which might happen during async operations)
        if (checkError.code === "PGRST116") {
          toast.error(
            "This conversation no longer exists. You will be redirected.",
            {
              id: "conversation-not-found",
              duration: 5000,
            }
          );

          // Wait a moment before redirecting
          setTimeout(() => {
            navigate("/chat");
          }, 2000);

          return;
        }
      }

      const newMessage = {
        conversation_id: conversationId,
        sender_id: user.id,
        content: message.trim(),
        created_at: new Date().toISOString(),
        is_read: false,
        image_url: null,
      };

      // Insert the message
      const { error } = await supabase.from("messages").insert(newMessage);

      if (error) {
        if (error.code === "23503") {
          // Foreign key violation - conversation doesn't exist
          toast.error(
            "Message could not be sent. Conversation may have been deleted."
          );
          setTimeout(() => {
            navigate("/chat");
          }, 2000);
          return;
        }
        throw error;
      }

      // Update the conversation's last update time
      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversationId);

      // Clear the input
      setMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
    }
  };

  // Handle image file selection and upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !conversationId) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    
    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }
    
    setUploadingImage(true);
    try {
      // Create a unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}_${Date.now()}.${fileExt}`;
      const filePath = `${conversationId}/${fileName}`;
      
      console.log('Uploading image:', { fileName, filePath, fileSize: file.size, fileType: file.type });
      
      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('chat-images')
        .upload(filePath, file, { 
          upsert: true,
          contentType: file.type,
          cacheControl: '3600'
        });
        
      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }
      
      // Get public URL
      const { data: publicUrlData } = supabase.storage.from('chat-images').getPublicUrl(filePath);
      const imageUrl = publicUrlData.publicUrl;
      
      console.log('Image uploaded successfully:', imageUrl);
      
      // Send message with image_url
      const newMessage = {
        conversation_id: conversationId,
        sender_id: user.id,
        content: '',
        image_url: imageUrl,
        created_at: new Date().toISOString(),
        is_read: false,
      };
      
      const { error: insertError } = await supabase.from('messages').insert(newMessage);
      
      if (insertError) {
        console.error('Message insert error:', insertError);
        throw insertError;
      }
      
      toast.success('Image sent!');
    } catch (err) {
      console.error('Image upload error:', err);
      toast.error(`Failed to send image: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Format timestamp to a readable format
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const today = new Date();

    // If message is from today, show only time
    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    // If message is from this year, show month and day
    if (date.getFullYear() === today.getFullYear()) {
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    }

    // Otherwise show full date
    return date.toLocaleDateString();
  };

  // Helper to get the other user's ID for the current conversation

  // Delete conversation for current user
  const handleDeleteConversation = async (convId: string) => {
    setDeleteLoading(true);
    try {
      // Delete from user_conversations
      const { error: ucError } = await supabase
        .from("user_conversations")
        .delete()
        .eq("conversation_id", convId)
        .eq("user_id", user!.id);

      if (ucError) {
        console.error("Error deleting user_conversation:", ucError);
        toast.error("Failed to delete conversation: " + ucError.message);
        return;
      }

      // Remove from local state immediately
      setConversations(prev => prev.filter(c => c.conversation_id !== convId));
      toast.success("Conversation deleted");
      setShowDeleteDialog(null);
      if (conversationId === convId) navigate("/chat");
    } catch (err) {
      console.error("Delete conversation error:", err);
      toast.error("Failed to delete conversation");
    } finally {
      setDeleteLoading(false);
    }
  };


  // Owner-only 'Mark as Adopted' button
  const [chatPostStatus, setChatPostStatus] = React.useState("");
  const [isPostOwner, setIsPostOwner] = React.useState(false);

  React.useEffect(() => {
    const convo = conversations.find(c => c.conversation_id === conversationId);
    if (convo && convo.post_id && user) {
      // Fetch post details to check owner and status
      supabase.from('posts').select('status,user_id').eq('id', convo.post_id).single()
        .then(({data}) => {
          if (data) {
            setChatPostStatus(data.status || "");
            setIsPostOwner(data.user_id === user.id);
          }
        });
    } else {
      setChatPostStatus("");
      setIsPostOwner(false);
    }
  }, [conversationId, conversations, user]);

// Render the chat interface or conversation list
  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center p-8 bg-white rounded-lg shadow-md">
          <h2 className="text-2xl font-bold text-violet-700 mb-4">
            Please Sign In
          </h2>
          <p className="text-gray-600 mb-6">
            You need to be logged in to access the chat feature.
          </p>
          <button
            onClick={() => navigate("/login")}
            className="px-6 py-3 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-lg font-medium hover:from-violet-600 hover:to-purple-600 transition-all duration-300"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (isLoading || isCreatingConversation) {
    return (
      <div className="flex justify-center items-center py-10 h-screen bg-gradient-to-br from-violet-50 via-blue-50/40 to-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-violet-500 border-opacity-100 border-r-4 border-opacity-50 mx-auto mb-4"></div>
          <p className="text-violet-700 font-medium">
            {isCreatingConversation ? "Starting conversation..." : "Loading..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 w-full font-['Poppins']">
      {/* Sidebar overlay for mobile */}
      {isSidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Conversations sidebar */}
      <div
        className={`
        ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0
        fixed lg:static inset-y-0 left-0 z-50
        ${isSidebarCollapsed ? "w-16" : "w-80"} max-w-[85vw] bg-white/80 backdrop-blur-xl border-r border-slate-200/80 shadow-2xl lg:shadow-none
        transition-all duration-300 ease-in-out
        flex flex-col
      `}
      >
        {/* Collapse/Expand Button */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200/80">
          <h2 className={`text-xl font-bold text-slate-800 transition-all duration-300 ${isSidebarCollapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100 w-auto"}`}>Messages</h2>
          <button
            className="p-2 rounded-full hover:bg-slate-100 transition-colors ml-auto"
            onClick={() => setIsSidebarCollapsed((prev) => !prev)}
            aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isSidebarCollapsed ? <FaChevronRight /> : <FaChevronLeft />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center items-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-r-2 border-indigo-500"></div>
            </div>
          ) : conversations.length === 0 ? (
            <div className={`flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center ${isSidebarCollapsed ? "hidden" : ""}`}>
              <FaComments className="text-5xl mb-4 text-slate-300" />
              <span className="font-semibold text-lg text-slate-600">
                No conversations yet
              </span>
              <p className="text-sm text-slate-500 mt-2">
                Start a chat to see your messages here.
              </p>
            </div>
          ) : (
            conversations.map((conversation) => (
              <div
                key={conversation.conversation_id}
                onClick={() => {
                  navigate(`/chat/${conversation.conversation_id}`);
                  setIsSidebarOpen(false); // Close sidebar on mobile
                }}
                className={`p-4 border-b border-slate-100/80 cursor-pointer transition-all duration-200 relative flex items-center ${
                  conversationId === conversation.conversation_id
                    ? "bg-indigo-50"
                    : "hover:bg-slate-100/70"
                } ${isSidebarCollapsed ? "justify-center" : ""}`}
                style={{ position: 'relative' }}
              >
                {conversationId === conversation.conversation_id && (
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-indigo-500 rounded-r-full"></div>
                )}
                <div className="relative shrink-0">
                  <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center shadow-md">
                    <span className="text-white font-semibold text-lg">
                      {conversation.other_user_name
                        ?.charAt(0)
                        .toUpperCase() || "U"}
                    </span>
                  </div>
                  {conversation.unread_count > 0 && (
                    <span className="absolute -top-1 -right-1 bg-pink-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold border-2 border-white">
                      {conversation.unread_count > 9
                        ? "9+"
                        : conversation.unread_count}
                    </span>
                  )}
                </div>
                {!isSidebarCollapsed && (
                  <>
                    <div className="flex-1 min-w-0 ml-3">
                      <div className="flex justify-between items-center">
                        <p className="font-semibold text-slate-800 truncate">
                          {conversation.other_user_name || "User"}
                        </p>
                        {conversation.last_message_time && (
                          <span className="text-xs text-slate-400 ml-2 shrink-0">
                            {formatTime(conversation.last_message_time)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500 truncate">
                        {conversation.last_message || "No messages yet"}
                      </p>
                    </div>
                    {/* Delete button */}
                    <div className="flex flex-col gap-1 ml-2">
                      <button
                        onClick={e => { e.stopPropagation(); setShowDeleteDialog(conversation.conversation_id); }}
                        className="px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-xs font-semibold"
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Unified Chat Header */}
        <div className="p-4 border-b border-slate-200/80 bg-white/80 backdrop-blur-lg flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            {/* Mobile Sidebar Toggle: Only shows inside a convo */}
            {conversationId && (
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="lg:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                aria-label="Open conversation list"
              >
                <FaBars className="w-5 h-5" />
              </button>
            )}

            {conversationId ? (
              <>
                <div className="w-11 h-11 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-lg">
                    {conversations
                      .find((c) => c.conversation_id === conversationId)
                      ?.other_user_name?.charAt(0)
                      .toUpperCase() || "U"}
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-lg">
                    {conversations.find(
                      (c) => c.conversation_id === conversationId
                    )?.other_user_name || "Chat"}
                  </h3>
                  <p className="text-sm text-emerald-500 font-medium">Online</p>
                </div>
              </>
            ) : (
              <h3 className="font-bold text-slate-800 text-lg">
                Your Conversations
              </h3>
            )}
          </div>
          {conversationId && (
            <div className="flex gap-2">
              {/* Mark as Adopted button - only show to post owner for non-adopted pets */}
              {isPostOwner && chatPostStatus && chatPostStatus.toLowerCase() !== "adopted" && (
                <button
                  onClick={async () => {
                    const convo = conversations.find(c => c.conversation_id === conversationId);
                    if (!convo || !convo.post_id) return;
                    
                    // Mark post as Adopted
                    const { error } = await supabase
                      .from("posts")
                      .update({ status: "Adopted" })
                      .eq("id", convo.post_id);

                    // Mark the approved adoption request as 'completed'
                    const { data: approvedRequests } = await supabase
                      .from("adoption_requests")
                      .select("id")
                      .eq("post_id", convo.post_id)
                      .eq("status", "approved");

                    if (approvedRequests && approvedRequests.length > 0) {
                      const reqId = approvedRequests[0].id;
                      await supabase
                        .from("adoption_requests")
                        .update({ status: "completed", updated_at: new Date().toISOString() })
                        .eq("id", reqId);
                    }
                    
                    if (!error) {
                      setChatPostStatus("Adopted");
                      toast.success("Pet marked as Adopted!");
                    } else {
                      toast.error("Failed to mark as Adopted");
                    }
                  }}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 text-white rounded-xl hover:from-green-600 hover:via-emerald-600 hover:to-teal-600 text-base font-bold shadow-lg hover:shadow-xl transition-all transform hover:scale-105 border-2 border-white/20"
                >
                  <FaCheckCircle className="text-xl" />
                  <span>Mark as Adopted</span>
                </button>
              )}
              <button
                onClick={() => setShowDeleteDialog(conversationId)}
                className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-xs font-semibold"
              >
                Delete
              </button>
            </div>
          )}
        </div>

        {conversationId ? (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <FaComments className="text-5xl mb-4 text-slate-300" />
                <p className="font-semibold text-slate-600">No messages yet</p>
                <p className="text-sm text-slate-500">
                  Send a message to start the conversation.
                </p>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex items-end gap-2 ${
                    message.sender_id === user?.id
                      ? "justify-end"
                      : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-sm lg:max-w-lg px-4 py-3 rounded-2xl shadow-md ${
                      message.sender_id === user?.id
                        ? "bg-gradient-to-br from-indigo-500 to-purple-500 text-white rounded-br-lg"
                        : "bg-white text-slate-800 border border-slate-200/80 rounded-bl-lg"
                    }`}
                  >
                    {message.image_url && (
                      <img
                        src={message.image_url}
                        alt="Sent image"
                        className="mb-2 max-w-xs max-h-60 rounded-lg border"
                        style={{ objectFit: 'cover' }}
                        onError={(e) => {
                          console.error('Failed to load image:', message.image_url);
                          e.currentTarget.style.display = 'none';
                        }}
                        onLoad={() => {
                          console.log('Image loaded successfully:', message.image_url);
                        }}
                      />
                    )}
                    {message.content && <p className="text-sm leading-relaxed">{message.content}</p>}
                    <p
                      className={`text-xs mt-1.5 text-right ${
                        message.sender_id === user?.id
                          ? "text-indigo-100/80"
                          : "text-slate-400"
                      }`}
                    >
                      {formatTime(message.created_at)}
                    </p>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center p-6 bg-slate-50/50">
            <div className="text-center max-w-sm">
              <div className="w-28 h-28 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-indigo-200/50">
                <FaComments className="w-12 h-12 text-white" />
              </div>
              <h3 className="text-3xl font-bold text-slate-800 mb-3 font-['Quicksand']">
                Welcome to Pawpal Chat
              </h3>
              <p className="text-slate-500 leading-relaxed">
                Select a conversation from the sidebar to view messages or start
                a new chat with a pet owner.
              </p>
            </div>
          </div>
        )}

        {/* Bottom Action Bar */}
        <div className="p-4 border-t border-slate-200/80 bg-white/80 backdrop-blur-lg">
          {conversationId ? (
            <>
              {/* Prominent Mark as Adopted Banner - only show to post owner for non-adopted pets */}
              {isPostOwner && chatPostStatus && chatPostStatus.toLowerCase() !== "adopted" && (
                <div className="mb-4 p-4 bg-gradient-to-r from-green-50 via-emerald-50 to-teal-50 border-2 border-green-300 rounded-xl shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center shadow-md">
                        <FaHeart className="text-white text-xl" />
                      </div>
                      <div>
                        <p className="font-bold text-green-800 text-lg">Ready to Finalize Adoption?</p>
                        <p className="text-sm text-green-700">Click the button below to mark this pet as adopted</p>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        const convo = conversations.find(c => c.conversation_id === conversationId);
                        if (!convo || !convo.post_id) return;
                        
                        // Mark post as Adopted
                        const { error } = await supabase
                          .from("posts")
                          .update({ status: "Adopted" })
                          .eq("id", convo.post_id);

                        // Mark the approved adoption request as 'completed'
                        const { data: approvedRequests } = await supabase
                          .from("adoption_requests")
                          .select("id")
                          .eq("post_id", convo.post_id)
                          .eq("status", "approved");

                        if (approvedRequests && approvedRequests.length > 0) {
                          const reqId = approvedRequests[0].id;
                          await supabase
                            .from("adoption_requests")
                            .update({ status: "completed", updated_at: new Date().toISOString() })
                            .eq("id", reqId);
                        }
                        
                        if (!error) {
                          setChatPostStatus("Adopted");
                          toast.success("Pet marked as Adopted!");
                        } else {
                          toast.error("Failed to mark as Adopted");
                        }
                      }}
                      className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 text-white rounded-xl hover:from-green-600 hover:via-emerald-600 hover:to-teal-600 text-base font-bold shadow-lg hover:shadow-xl transition-all transform hover:scale-105 border-2 border-white/30"
                    >
                      <FaCheckCircle className="text-xl" />
                      <span>Mark as Adopted</span>
                    </button>
                  </div>
                </div>
              )}
              {/* Message Input Form */}
              <form onSubmit={sendMessage} className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-12 h-12 flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-500 text-white rounded-full hover:from-indigo-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
                title="Send Image"
                disabled={uploadingImage}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5V7.5A2.25 2.25 0 015.25 5.25h13.5A2.25 2.25 0 0121 7.5v9a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 16.5z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5l5.25-5.25a2.25 2.25 0 013.182 0l5.318 5.318M14.25 9.75h.008v.008h-.008V9.75z" />
                </svg>
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </button>
              <button
                type="submit"
              
                onClick={() => setIsSidebarOpen(true)}
                className="w-12 h-12 flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-500 text-white rounded-full hover:from-indigo-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
              >
                <FaComments className="w-5 h-5" />
              </button>
              <div className="relative flex-1">
                <span className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                  <FaComments className="w-5 h-5 text-indigo-400" />
                </span>
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="w-full pl-12 pr-5 py-3 border border-slate-300/70 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={!message.trim()}
                className="w-12 h-12 flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-500 text-white rounded-full hover:from-indigo-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
              >
                <FaPaperPlane />
                </button>
              </form>
            </>
          ) : (
            // Button to open conversation list
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden w-full flex items-center justify-center gap-3 px-5 py-3 bg-gradient-to-br from-indigo-500 to-purple-500 text-white rounded-full hover:from-indigo-600 hover:to-purple-600 transition-all shadow-lg"
              aria-label="Open conversation list"
            >
              <FaComments className="w-5 h-5" />
              <span className="font-semibold">View Conversations</span>
            </button>
          )}
        </div>
      </div>
      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-transparent">
          <div className="bg-white rounded-lg p-6 shadow-lg w-full max-w-xs">
            <h4 className="font-bold mb-4">Delete Conversation?</h4>
            <p className="mb-4 text-sm">This will remove the conversation from your list. You cannot undo this action.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowDeleteDialog(null)} className="px-4 py-2 bg-gray-200 rounded">Cancel</button>
              <button onClick={() => handleDeleteConversation(showDeleteDialog)} disabled={deleteLoading} className="px-4 py-2 bg-red-500 text-white rounded">{deleteLoading ? "Deleting..." : "Delete"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatPage;
