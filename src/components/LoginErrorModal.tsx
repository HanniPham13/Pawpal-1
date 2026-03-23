import { FaTimes, FaExclamationTriangle } from "react-icons/fa";

interface LoginErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  errorMessage?: string;
  declinedReason?: string | null;
  onDeclinedGotIt?: () => Promise<void> | void;
  onDeclinedRegisterAgain?: () => Promise<void> | void;
  isDeclinedActionLoading?: boolean;
  declinedAction?: "got-it" | "register-again" | null;
}

export const LoginErrorModal = ({
  isOpen,
  onClose,
  errorMessage,
  declinedReason,
  onDeclinedGotIt,
  onDeclinedRegisterAgain,
  isDeclinedActionLoading = false,
  declinedAction = null,
}: LoginErrorModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 min-h-screen">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-md"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/20 p-6 max-w-md w-full mx-auto my-auto transform transition-all duration-300 scale-100">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-full hover:bg-gray-100"
          aria-label="Close modal"
        >
          <FaTimes className="w-4 h-4" />
        </button>

        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg ${declinedReason ? "bg-gradient-to-br from-red-600 to-pink-600" : "bg-gradient-to-br from-red-500 to-pink-500"}`}>
            <FaExclamationTriangle className="text-white text-2xl" />
          </div>
        </div>

        {/* Content */}
        <div className="text-center">
          {declinedReason ? (
            <>
              <h3 className="text-2xl font-extrabold text-red-700 mb-4 font-['Inter']">
                Account Declined
              </h3>
              <div className="bg-red-100 border border-red-400 text-red-800 rounded-lg p-4 mb-4 font-semibold text-base break-words">
                {declinedReason}
              </div>
              <p className="text-gray-700 mb-8 font-medium">
                You cannot log in because a veterinarian has declined your registration for the reason above.<br />
                If you believe this is a mistake, you may contact support or <b>register with your email again</b>.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (onDeclinedRegisterAgain) {
                      void onDeclinedRegisterAgain();
                      return;
                    }
                    window.location.href = "/signup";
                  }}
                  disabled={isDeclinedActionLoading}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white rounded-xl font-bold transition-all duration-200 shadow-sm hover:shadow-md font-['Inter'] text-base disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDeclinedActionLoading && declinedAction === "register-again"
                    ? "Processing..."
                    : "Register Again"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onDeclinedGotIt) {
                      void onDeclinedGotIt();
                      return;
                    }
                    onClose();
                  }}
                  disabled={isDeclinedActionLoading}
                  className="flex-1 px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-semibold transition-all duration-200 font-['Inter'] text-base border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDeclinedActionLoading && declinedAction === "got-it"
                    ? "Processing..."
                    : "Got It"}
                </button>
              </div>
            </>
          ) : (
            <>
              <h3 className="text-xl font-bold text-gray-900 mb-2 font-['Inter']">
                Login Failed
              </h3>
              <p className="text-gray-600 mb-6 font-['Inter']">
                {errorMessage || "Invalid email or password"}
              </p>
              <p className="text-sm text-gray-500 mb-6">
                Please check your credentials and try again.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white rounded-xl font-semibold transition-all duration-200 shadow-sm hover:shadow-md font-['Inter']"
                >
                  OK
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

