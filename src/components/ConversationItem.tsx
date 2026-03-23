import React from "react";
import { FaUserCircle } from "react-icons/fa";
import { formatDistanceToNow } from "date-fns";

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
}

interface ConversationItemProps {
  conversation: Conversation;
  onClick: () => void;
}

export const ConversationItem: React.FC<ConversationItemProps> = ({
  conversation,
  onClick,
}) => {
  // Format the time
  const formatTime = (timestamp: string) => {
    if (!timestamp) return "";

    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch {
      return timestamp;
    }
  };

  // Get display name - show "Other User Name (Pet Name)" format
  const getDisplayName = () => {
    // Just use the username directly
    if (
      conversation.other_user_name &&
      !conversation.other_user_name.includes("@") &&
      conversation.other_user_name !== "Unknown" &&
      conversation.other_user_name !== "Unknown User" &&
      conversation.other_user_name !== "Other User"
    ) {
      return conversation.other_user_name;
    }
    if (conversation.title && !conversation.title.includes("@") &&
      conversation.title !== "Unknown" && conversation.title !== "Unknown User") {
      return conversation.title;
    }
    return "User";
  };

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border transition-all duration-300 ${
        conversation.unread_count > 0
          ? "bg-violet-50 border-violet-200"
          : "hover:bg-gray-50 border-gray-100"
      }`}
    >
      <div className="relative">
        {conversation.other_user_avatar ? (
          <img
            src={conversation.other_user_avatar}
            alt={getDisplayName()}
            className="w-12 h-12 rounded-full object-cover"
          />
        ) : (
          <div className="w-12 h-12 bg-violet-300 rounded-full flex items-center justify-center">
            <FaUserCircle className="text-white text-2xl" />
          </div>
        )}
        {conversation.unread_count > 0 && (
          <div className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
            {conversation.unread_count > 9 ? "9+" : conversation.unread_count}
          </div>
        )}
      </div>

      <div className="flex-1">
        <div className="flex justify-between items-center">
          <h3
            className={`font-medium ${
              conversation.unread_count > 0
                ? "text-violet-800 font-semibold"
                : "text-gray-800"
            }`}
          >
            {getDisplayName()}
          </h3>
          {conversation.last_message_time && (
            <span className="text-xs text-gray-500">
              {formatTime(conversation.last_message_time)}
            </span>
          )}
        </div>
        <p
          className={`text-sm truncate ${
            conversation.unread_count > 0 ? "text-violet-700" : "text-gray-500"
          }`}
        >
          {conversation.last_message || "No messages yet"}
        </p>
      </div>
    </div>
  );
};
