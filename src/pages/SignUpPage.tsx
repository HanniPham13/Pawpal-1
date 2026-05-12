import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { FaPaw, FaLock, FaEnvelope, FaUser, FaEye, FaEyeSlash } from "react-icons/fa";
import { useAuth } from "../context/AuthContext";

interface AdoptionValidation {
  hasExperience: string;
  stableLiving: string;
  canAfford: string;
  hasTime: string;
  householdOnBoard: string;
  hasSpace: string;
  longTermCommitment: string;
}

const SignUpPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signUpWithEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [adoptionAnswers, setAdoptionAnswers] = useState<AdoptionValidation>({
    hasExperience: "",
    stableLiving: "",
    canAfford: "",
    hasTime: "",
    householdOnBoard: "",
    hasSpace: "",
    longTermCommitment: "",
  });

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  const incomingState = location.state as {
    prefillEmail?: string;
  } | null;

  useEffect(() => {
    if (!incomingState) return;

    if (incomingState.prefillEmail) {
      setEmail((prev) => prev || incomingState.prefillEmail || "");
    }

    navigate(location.pathname, { replace: true, state: {} });
  }, [incomingState, location.pathname, navigate]);

  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
  const adoptionQuestions = useMemo(
    () => [
      {
        key: "hasExperience" as keyof AdoptionValidation,
        question: "Do you have previous experience caring for pets?",
        helpText: "Prior experience helps ensure you can handle daily needs and emergencies."
      },
      {
        key: "stableLiving" as keyof AdoptionValidation,
        question: "Is your living situation stable for the next 12 months?",
        helpText: "We need to know your future companion will have a consistent home."
      },
      {
        key: "canAfford" as keyof AdoptionValidation,
        question: "Can you comfortably afford food, vet visits, and supplies?",
        helpText: "Pet care can cost around ₱2,500-₱8,000 per month depending on size and needs."
      },
      {
        key: "hasTime" as keyof AdoptionValidation,
        question: "Can you commit time daily for exercise, play, and training?",
        helpText: "Quality time helps pets adapt faster and feel secure."
      },
      {
        key: "householdOnBoard" as keyof AdoptionValidation,
        question: "Is everyone in your household supportive of adopting?",
        helpText: "Household members should agree on responsibilities and expectations."
      },
      {
        key: "hasSpace" as keyof AdoptionValidation,
        question: "Do you have enough space for a pet in your home?",
        helpText: "Provide honest details about indoor and outdoor access."
      },
      {
        key: "longTermCommitment" as keyof AdoptionValidation,
        question: "Are you ready for a long-term commitment (10+ years)?",
        helpText: "Pets rely on us for their entire lives."
      },
    ],
    []
  );

  const stepQuestionMap: Record<2 | 3 | 4, (keyof AdoptionValidation)[]> = {
    2: ["hasExperience", "stableLiving", "canAfford"],
    3: ["hasTime", "householdOnBoard"],
    4: ["hasSpace", "longTermCommitment"],
  };

  const questionsForStep = (currentStep: 2 | 3 | 4) =>
    adoptionQuestions.filter(({ key }) => stepQuestionMap[currentStep].includes(key));

  const handleAnswerChange = (key: keyof AdoptionValidation, value: string) => {
    setAdoptionAnswers((prev) => ({
      ...prev,
      [key]: prev[key] === value ? "" : value,
    }));
    setError("");
  };

  const validateAccountStep = () => {
    if (!firstName.trim() || !lastName.trim()) {
      setError("First name and last name are required");
      return false;
    }
    if (!email.trim()) {
      setError("Email is required");
      return false;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return false;
    }
    if (!passwordRegex.test(password)) {
      setError(
        "Password must be at least 8 characters and include lowercase, uppercase, number, and special character."
      );
      return false;
    }
    return true;
  };

  const validateAdoptionStep = (currentStep: 2 | 3 | 4) => {
    const missing = stepQuestionMap[currentStep].filter((key) => !adoptionAnswers[key]);
    if (missing.length) {
      setError("Please answer all questions on this page before continuing.");
      return false;
    }
    return true;
  };

  const handleNext = () => {
    setError("");
    if (step === 1 && validateAccountStep()) {
      setStep(2);
    } else if (step === 2 && validateAdoptionStep(2)) {
      setStep(3);
    } else if (step === 3 && validateAdoptionStep(3)) {
      setStep(4);
    }
  };

  const handlePrevious = () => {
    setError("");
    setStep((prev) => (prev > 1 ? ((prev - 1) as 1 | 2 | 3 | 4) : prev));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step !== 4) {
      handleNext();
      return;
    }

    if (!validateAdoptionStep(4)) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { success, error } = await signUpWithEmail(
        email, 
        password, 
        "user", 
        firstName, 
        lastName,
        adoptionAnswers
      );

      if (
        success ||
        (error && error.toLowerCase().includes("verify your email")) ||
        (error && error.toLowerCase().includes("email not confirmed"))
      ) {
          navigate("/verify-email", {
            state: {
              email,
              message: "Please check your email to verify your account before signing in."
            }
          });
      } else if (error && (error.includes("already exists") || error.includes("already registered"))) {
        setError(error);
        setTimeout(() => {
          navigate("/login");
        }, 3000);
      } else {
        // Show the full error message and object for debugging
        let displayError = "Sign up failed. Try again.";
        if (error) {
          if (typeof error === 'string') displayError = error;
          else if ((error as any)?.message) displayError = (error as any).message;
          else displayError = JSON.stringify(error);
        }
        setError(displayError);
        if (error) {
          // Log the full error object for developer visibility
          console.error("Signup failed with error (full object):", error);
        }
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-50">
      {/* Left Section */}
      <div className="hidden md:flex w-full md:w-1/2 p-6 sm:p-12 flex-col justify-between bg-white">
        <div>
          <div className="mb-8">
            <FaPaw className="text-violet-600 text-3xl sm:text-4xl" />
          </div>
          <h1 className="text-2xl sm:text-5xl font-bold mb-6 text-gray-900">
            Find the perfect companion for your family.
          </h1>
          <p className="text-base sm:text-xl text-gray-600 mb-8 sm:mb-12">
            Join our community of pet lovers and find your next furry friend.
          </p>
        </div>

        {/* Testimonial Card */}
        <div className="bg-gray-900 text-white p-4 sm:p-8 rounded-2xl mt-8 md:mt-0">
          <p className="text-base sm:text-lg mb-4 sm:mb-6">
            "Thanks to this platform, I found my perfect companion. The process was smooth and the community is amazing!"
          </p>
          <div className="flex items-center">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-violet-600 rounded-full flex items-center justify-center text-lg sm:text-xl font-bold">
              JD
            </div>
            <div className="ml-4">
              <p className="font-semibold">John Doe</p>
              <p className="text-gray-400">Pet Owner</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center justify-center w-full md:w-1/2 p-6 md:p-12 min-h-screen">
        <div className="w-full max-w-md">
          <h2 className="text-2xl sm:text-3xl font-bold mb-2 text-gray-900">Create your account</h2>
          <p className="text-gray-600 mb-4 sm:mb-8">Join as a pet owner and find your perfect companion</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex items-center gap-3 text-sm font-medium text-gray-500">
              {[1, 2, 3, 4].map((value) => (
                <div key={value} className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center border ${
                      step === value
                        ? "bg-violet-600 text-white border-violet-600"
                        : value < step
                        ? "bg-violet-100 text-violet-700 border-violet-200"
                        : "bg-white text-gray-400 border-gray-200"
                    }`}
                  >
                    {value}
                  </div>
                  {value < 4 && <div className="w-10 h-px bg-gray-200 hidden sm:block" />}
                </div>
              ))}
            </div>

            {step === 1 && (
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-1/2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      First Name
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FaUser className="text-gray-400" />
                      </div>
                      <input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="w-full pl-10 px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                        placeholder="First name"
                      />
                    </div>
                  </div>
                  <div className="w-1/2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Last Name
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FaUser className="text-gray-400" />
                      </div>
                      <input
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="w-full pl-10 px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                        placeholder="Last name"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <FaEnvelope className="text-gray-400" />
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                      placeholder="Enter your email"
                    />
                  </div>
                </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-2">
                       Password
                     </label>
                     <div className="relative">
                       <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                         <FaLock className="text-gray-400" />
                       </div>
                       <input
                         type={showPassword ? "text" : "password"}
                         value={password}
                         onChange={(e) => setPassword(e.target.value)}
                         className="w-full pl-10 pr-10 px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                         placeholder="Create a password"
                         minLength={6}
                       />
                       <button
                         type="button"
                         className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 focus:outline-none"
                         tabIndex={-1}
                         onClick={() => setShowPassword((prev) => !prev)}
                         aria-label={showPassword ? "Hide password" : "Show password"}
                       >
                         {showPassword ? <FaEyeSlash /> : <FaEye />}
                       </button>
                     </div>
                   </div>

                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-2">
                       Confirm Password
                     </label>
                     <div className="relative">
                       <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                         <FaLock className="text-gray-400" />
                       </div>
                       <input
                         type={showPassword ? "text" : "password"}
                         value={confirmPassword}
                         onChange={(e) => setConfirmPassword(e.target.value)}
                         className="w-full pl-10 pr-10 px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                         placeholder="Confirm password"
                         minLength={6}
                       />
                     </div>
                   </div>
                 </div>
<<<<<<< Updated upstream

                 <div className="flex items-start">
                   <input
                     type="checkbox"
                     id="termsCheckbox"
                     checked={acceptedTerms}
                     onChange={(e) => {
                       setAcceptedTerms(e.target.checked);
                       setError("");
                     }}
                     className="mt-1 mr-3 h-4 w-4 text-violet-600 focus:ring-violet-500 border-gray-300 rounded"
                   />
                   <label htmlFor="termsCheckbox" className="text-sm text-gray-700 cursor-pointer">
                     I agree to the{" "}
                     <button
                       type="button"
                       onClick={(e) => {
                         e.preventDefault();
                         setShowTermsModal(true);
                       }}
                       className="text-violet-600 hover:text-violet-800 underline font-semibold"
                     >
                       Terms of Service
                     </button>
                   </label>
                 </div>

                 {error && (
                   <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                     {error}
                   </div>
                 )}
=======
>>>>>>> Stashed changes
              </div>
            )}

            {[2, 3, 4].includes(step) && (
              <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Adoption readiness check</h3>
                  <p className="text-sm text-gray-600">
                    Help us understand your home environment so local shelters can match you with the right companion.
                  </p>
                </div>

                <div className="space-y-5">
                  {questionsForStep(step as 2 | 3 | 4).map(({ key, question, helpText }) => (
                    <div key={key} className="border border-gray-100 rounded-xl p-4">
                      <p className="font-medium text-gray-900">{question}</p>
                      <p className="text-sm text-gray-500 mb-4">{helpText}</p>
                      <div className="flex gap-3">
                        {["yes", "no"].map((value) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => handleAnswerChange(key as keyof AdoptionValidation, value)}
                            className={`flex-1 py-2 rounded-lg border transition-all ${
                              adoptionAnswers[key as keyof AdoptionValidation] === value
                                ? "border-violet-600 bg-violet-50 text-violet-700 font-semibold"
                                : "border-gray-200 text-gray-600 hover:border-violet-300 hover:text-violet-700"
                            }`}
                          >
                            {value === "yes" ? "Yes" : "No"}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div className="text-red-600 text-sm p-3 bg-red-50 rounded-lg border border-red-200">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              {step > 1 && (
                <button
                  type="button"
                  onClick={handlePrevious}
                  className="w-1/3 text-gray-700 border border-gray-300 py-3 rounded-lg font-semibold hover:bg-gray-50"
                  disabled={loading}
                >
                  Back
                </button>
              )}

              {step < 4 && (
                <button
                  type="button"
                  onClick={handleNext}
                  className="flex-1 bg-violet-600 text-white py-3 rounded-lg font-semibold hover:bg-violet-700"
                >
                  Next
                </button>
              )}

              {step === 4 && (
                <button
                  type="submit"
                  className="flex-1 bg-violet-600 text-white py-3 rounded-lg font-semibold hover:bg-violet-700 transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={loading}
                >
                  {loading ? (
                    <div className="flex items-center justify-center">
                      <svg className="animate-spin h-5 w-5 mr-3 text-white" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Creating account...
                    </div>
                  ) : (
                    "Create Account"
                  )}
                </button>
              )}
            </div>

            <div className="text-center">
              <p className="text-gray-600">
                Already have an account?{" "}
                <Link to="/login" className="text-violet-600 hover:text-violet-800 font-semibold">
                  Sign in
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SignUpPage;