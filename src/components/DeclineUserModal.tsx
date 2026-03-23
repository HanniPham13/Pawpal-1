import { useState } from "react";
import { FaTimes, FaExclamationTriangle } from "react-icons/fa";

interface DeclineUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
  userName?: string;
}

const PREDEFINED_REASONS = [
  "Incomplete profile information",
  "Failed adoption assessment",
  "Suspicious account activity",
  "Does not meet adoption requirements",
  "Duplicate or fake account",
  "Other (specify below)",
];

export const DeclineUserModal = ({
  isOpen,
  onClose,
  onConfirm,
  userName,
}: DeclineUserModalProps) => {
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [customReason, setCustomReason] = useState<string>("");
  const [isOtherSelected, setIsOtherSelected] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleReasonChange = (reason: string) => {
    setSelectedReason(reason);
    setIsOtherSelected(reason === "Other (specify below)");
    if (reason !== "Other (specify below)") {
      setCustomReason("");
    }
  };

  const handleConfirm = async () => {
    const finalReason = isOtherSelected && customReason.trim()
      ? customReason.trim()
      : selectedReason || customReason.trim() || "";

    setIsSubmitting(true);
    try {
      await onConfirm(finalReason);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    // Reset form on close
    setSelectedReason("");
    setCustomReason("");
    setIsOtherSelected(false);
    setIsSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 min-h-screen">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-md"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/20 p-6 max-w-lg w-full mx-auto my-auto transform transition-all duration-300 scale-100 max-h-[90vh] overflow-y-auto">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-full hover:bg-gray-100"
          aria-label="Close modal"
        >
          <FaTimes className="w-4 h-4" />
        </button>

        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-pink-500 rounded-full flex items-center justify-center shadow-lg">
            <FaExclamationTriangle className="text-white text-2xl" />
          </div>
        </div>

        {/* Content */}
        <div className="text-center mb-6">
          <h3 className="text-xl font-bold text-gray-900 mb-2 font-['Inter']">
            Decline User Account
          </h3>
          <p className="text-gray-600 mb-4 font-['Inter']">
            {userName 
              ? `Are you sure you want to decline ${userName}'s account?`
              : "Are you sure you want to decline this account?"
            }
          </p>
          <p className="text-sm text-gray-500 mb-4">
            Please provide a reason for declining this account (optional). This will be shown to the user if they attempt to log in.
          </p>
        </div>

        {/* Reason Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Select a reason (optional):
          </label>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {PREDEFINED_REASONS.map((reason) => (
              <label
                key={reason}
                className="flex items-center p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <input
                  type="radio"
                  name="declineReason"
                  value={reason}
                  checked={selectedReason === reason}
                  onChange={(e) => handleReasonChange(e.target.value)}
                  className="mr-3 text-red-500 focus:ring-red-500"
                />
                <span className="text-sm text-gray-700">{reason}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Custom Reason Input */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {isOtherSelected ? "Please specify the reason:" : "Or enter a custom reason (optional):"}
          </label>
          <textarea
            value={customReason}
            onChange={(e) => setCustomReason(e.target.value)}
            placeholder={isOtherSelected ? "Enter your reason here..." : "Enter a custom reason (optional)"}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
            rows={3}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-all duration-200 font-['Inter']"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white rounded-xl font-semibold transition-all duration-200 shadow-sm hover:shadow-md font-['Inter']"
          >
            {isSubmitting ? "Declining..." : "Decline Account"}
          </button>
        </div>
      </div>
    </div>
  );
};

