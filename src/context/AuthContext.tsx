import { User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../supabase-client";

interface AuthResponse {
  success: boolean;
  error?: string;
  declinedReason?: string | null;
  /** When present, pass to decline-user-cleanup so auth deletion does not rely on email scan alone. */
  declinedUserId?: string | null;
}

interface AdoptionValidation {
  hasExperience?: string;
  stableLiving?: string;
  canAfford?: string;
  hasTime?: string;
  householdOnBoard?: string;
  hasSpace?: string;
  longTermCommitment?: string;
}

interface AuthContextType {
  user: User | null;
  role: string | null;
  signUpWithEmail: (
    email: string,
    password: string,
    role?: string,
    first_name?: string,
    last_name?: string,
    adoptionValidation?: AdoptionValidation
  ) => Promise<AuthResponse>;
  signInWithEmail: (email: string, password: string) => Promise<AuthResponse>;
  signOut: () => Promise<void>;
  resendVerificationEmail: (email: string) => Promise<AuthResponse>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** True while the URL still carries Supabase email-confirm / magic-link tokens (hash or query). */
function isAuthEmailCallbackUrl(): boolean {
  if (typeof window === "undefined") return false;
  const hash = new URLSearchParams(window.location.hash.substring(1));
  const q = new URLSearchParams(window.location.search);
  return !!(
    hash.get("access_token") ||
    hash.get("refresh_token") ||
    q.get("token_hash") ||
    q.get("token") ||
    q.get("code")
  );
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);

  const invokeDeclinedCleanup = async (
    email: string,
    userIds?: string[],
    options?: { purgeDeclineLog?: boolean }
  ): Promise<boolean> => {
    const cleanedEmail = email.toLowerCase().trim();
    const sanitizedUserIds =
      userIds?.filter((id): id is string => typeof id === "string" && id.length > 0) || [];
    const purgeDeclineLog = options?.purgeDeclineLog === true;

    try {
      const invokePromise = supabase.functions.invoke("decline-user-cleanup", {
        body: {
          email: cleanedEmail,
          purgeDeclineLog,
          ...(sanitizedUserIds.length ? { userIds: sanitizedUserIds } : {}),
        },
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        window.setTimeout(
          () => reject(new Error("Declined cleanup request timed out")),
          12000
        );
      });

      const { data, error } = (await Promise.race([invokePromise, timeoutPromise])) as {
        data: { success?: boolean } | null;
        error: { message?: string } | null;
      };

      if (error) {
        console.warn("decline-user-cleanup invoke failed:", error.message);
        return false;
      }

      return data?.success !== false;
    } catch (cleanupError) {
      console.warn("decline-user-cleanup unexpected failure:", cleanupError);
      return false;
    }
  };

  const shouldBlockPendingUserSession = async (sessionUser: User) => {
    // Let the verify-email page (or root URL before App redirects) finish exchanging tokens
    // and upsert the users row; otherwise we sign out too early and the user lands on home with no session.
    if (isAuthEmailCallbackUrl()) {
      return false;
    }

    const { data: userData, error } = await supabase
      .from("users")
      .select("role, verified")
      .eq("user_id", sessionUser.id)
      .maybeSingle();

    // If this is a regular user session but profile row is not ready yet,
    // keep them pending and signed out until admin/vet verification exists.
    const metadataRole = sessionUser.user_metadata?.role;
    if (!userData) {
      return metadataRole === "user";
    }

    if (error) return false;
    return userData.role === "user" && userData.verified !== true;
  };

  const fetchUserRole = async (userId: string) => {
    const { data, error } = await supabase
      .from("users") // or 'profiles' if that's your table
      .select("role")
      .eq("user_id", userId)
      .single();
    if (!error && data) {
      setRole(data.role);
      localStorage.setItem("userRole", data.role);
    } else {
      setRole(null);
      localStorage.removeItem("userRole");
    }
  };

  useEffect(() => {
    checkUser();
    const savedRole = localStorage.getItem("userRole");
    if (savedRole) setRole(savedRole);
    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session?.user) {
        setUser(null);
        return;
      }

      const blockPendingSession = await shouldBlockPendingUserSession(session.user);

      if (blockPendingSession) {
        await supabase.auth.signOut();
        localStorage.removeItem("userRole");
        setUser(null);
        return;
      }

      setUser(session.user);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (user) {
      fetchUserRole(user.id);
    } else {
      setRole(null);
      localStorage.removeItem("userRole");
    }
  }, [user]);

  useEffect(() => {
    const insertUserIfNeeded = async () => {
      if (!user) return;
      
      console.log("User session detected, attempting to upsert user profile:", user.id);
      
      // Get adoptionValidation from localStorage (only for newly verified accounts)
      let adoptionValidation = null;
      const cached = localStorage.getItem("pendingAdoptionValidation");
      if (cached) {
        try { 
          const parsed = JSON.parse(cached);
          // Validate that it's an object with at least one property
          if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
            // Filter out empty values
            adoptionValidation = Object.fromEntries(
              Object.entries(parsed).filter(([_, value]) => value && (typeof value === 'string' ? value.trim() !== '' : value !== null && value !== undefined))
            );
            if (Object.keys(adoptionValidation).length === 0) {
              adoptionValidation = null;
            }
            console.log("Found and validated cached adoption validation:", adoptionValidation);
          } else {
            console.warn("Cached adoption validation is empty or invalid");
          }
        } catch (e) {
          console.error("Failed to parse cached adoption validation:", e);
        }
      }
      
      // Check if user already exists - get existing role to preserve it
      const { data: existingUser, error: checkError } = await supabase
        .from("users")
        .select("user_id, role, adoption_validation")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (checkError) {
        console.error("Error checking existing user:", checkError);
      }
      
      // Prepare user data - prioritize cached adoption validation if it exists
      // Only use existing adoption_validation if there's no cached one (to avoid overwriting with null)
      const finalAdoptionValidation = adoptionValidation || existingUser?.adoption_validation || null;
      
      // Preserve existing role from database - don't overwrite admin/vet roles
      // Only use metadata role if user doesn't exist yet (new signup)
      const finalRole = existingUser?.role || user.user_metadata?.role || "user";
      
      console.log("Final adoption validation for upsert:", finalAdoptionValidation);
      console.log("Preserving role:", finalRole, "(existing:", existingUser?.role, ", metadata:", user.user_metadata?.role, ")");
      
      // Build full_name: try metadata full_name, then first+last, then email prefix
      const resolvedFullName = 
        user.user_metadata?.full_name ||
        (user.user_metadata?.first_name
          ? `${user.user_metadata.first_name}${user.user_metadata?.last_name ? ' ' + user.user_metadata.last_name : ''}`
          : null) ||
        user.email?.split("@")[0] ||
        null;

      const userData = {
        user_id: user.id,
        email: user.email || "",
        full_name: resolvedFullName,
        role: finalRole,
        adoption_validation: finalAdoptionValidation,
        created_at: new Date().toISOString(),
      };
      
      console.log("Upserting user data:", userData);
      
      // Upsert user profile - use update only for role to preserve existing role
      const { data: upsertData, error: upsertError } = await supabase
        .from("users")
        .upsert([userData], { 
          onConflict: 'user_id',
          // Only update role if it's not already set (preserve existing admin/vet roles)
          ignoreDuplicates: false
        })
        .select();
      
      if (upsertError) {
        console.error('AuthProvider auto upsert error:', upsertError);
        console.error('Upsert error details:', JSON.stringify(upsertError, null, 2));
        // Try insert instead of upsert in case of conflict issues
        const { error: insertError, data: insertData } = await supabase
          .from("users")
          .insert([userData])
          .select();
        if (insertError) {
          console.error('Insert fallback also failed:', insertError);
        } else {
          console.log('Insert fallback succeeded:', insertData);
          // Clear cached adoption validation after successful insert
          if (cached) {
            localStorage.removeItem("pendingAdoptionValidation");
          }
        }
      } else {
        console.log('Upsert succeeded:', upsertData);
        // Clear cached adoption validation after successful upsert
        if (cached) {
          localStorage.removeItem("pendingAdoptionValidation");
        }
      }
    };
    insertUserIfNeeded();
  }, [user]);

  const checkUser = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        setUser(null);
        return;
      }

      const blockPendingSession = await shouldBlockPendingUserSession(session.user);

      if (blockPendingSession) {
        await supabase.auth.signOut();
        localStorage.removeItem("userRole");
        setUser(null);
        return;
      }

      setUser(session.user);
    } catch (error) {
      console.error("Error checking user session:", error);
      setUser(null);
    }
  };

  const signUpWithEmail = async (
    email: string,
    password: string,
    role: string = "user",
    first_name?: string,
    last_name?: string,
    adoptionValidation?: AdoptionValidation
  ): Promise<AuthResponse> => {
    try {
      const cleanedEmail = email.toLowerCase().trim();

      const withTimeout = async <T,>(
        promise: Promise<T>,
        ms: number,
        message: string
      ): Promise<T> =>
        new Promise<T>((resolve, reject) => {
          const timer = window.setTimeout(() => reject(new Error(message)), ms);
          promise
            .then((value) => {
              window.clearTimeout(timer);
              resolve(value);
            })
            .catch((timeoutError) => {
              window.clearTimeout(timer);
              reject(timeoutError);
            });
        });

      // Ensure we are starting from a clean session to avoid weird auth redirects
      // if the user was previously signed in on this device.
      await supabase.auth.signOut();

      // Best-effort cleanup for declined users before trying signup; purge decline_log after cleanup.
      await invokeDeclinedCleanup(cleanedEmail, undefined, { purgeDeclineLog: true });

      // CLEAN OUT DECLINED USER RECORD
      const { error: cleanupError } = await supabase
        .from("users")
        .delete()
        .ilike("email", cleanedEmail)
        .eq("declined", true);

      if (cleanupError) {
        console.warn("Failed to clean declined user prior to signup:", cleanupError.message);
      }

      const fullName = first_name && last_name 
        ? `${first_name} ${last_name}` 
        : email.split("@")[0];

      // Save adoption validation to localStorage BEFORE signup
      // Ensure it's a valid object before saving
      if (adoptionValidation && typeof adoptionValidation === 'object') {
        // Filter out empty values to keep only answered questions
        const filteredValidation = Object.fromEntries(
          Object.entries(adoptionValidation).filter(([_, value]) => value && value.trim && value.trim() !== '')
        );
        
        if (Object.keys(filteredValidation).length > 0) {
          localStorage.setItem("pendingAdoptionValidation", JSON.stringify(filteredValidation));
          console.log("Saved adoption validation to localStorage:", filteredValidation);
        } else {
          console.warn("Adoption validation object is empty, not saving to localStorage");
        }
      }

      // Step 1: Sign up with Supabase
      // Force Supabase to always return to the verify page with an explicit type so our callback guard runs.
      const redirectUrl = `${window.location.origin}/verify-email?type=signup`;
      console.log("Signing up user with email:", email.toLowerCase().trim());
      console.log("Email redirect URL:", redirectUrl);
      const signUpStart = performance.now();
      
      const attemptSignUp = () =>
        supabase.auth.signUp({
          email: email.toLowerCase().trim(),
          password,
          options: {
            data: {
              email: email.toLowerCase().trim(),
              full_name: fullName,
              first_name,
              last_name,
              role,
              adoption_validation: adoptionValidation || null,
            },
            emailRedirectTo: redirectUrl,
          },
        });

      const { data: signUpData, error: authError } = await withTimeout(
        attemptSignUp(),
        15000,
        "Signup is taking too long. Please check your connection and try again."
      );

      console.log(
        `[signup] supabase.auth.signUp completed in ${Math.round(
          performance.now() - signUpStart
        )}ms`
      );

      console.log("Signup response:", { 
        user: signUpData?.user?.id, 
        session: !!signUpData?.session,
        error: authError?.message 
      });

      // If signup fails due to existing email
      if (authError) {
        console.error("Signup error:", authError);
        if (
          authError.message.includes("already registered") ||
          authError.message.includes("already exists") ||
          authError.message.includes("User already registered")
        ) {
          // If the email belongs to a previously declined user, cleanup can unlock signup.
          const cleanupWorked = await invokeDeclinedCleanup(cleanedEmail, undefined, {
            purgeDeclineLog: true,
          });
          if (cleanupWorked) {
            const { data: retryData, error: retryError } = await withTimeout(
              attemptSignUp(),
              15000,
              "Signup retry is taking too long. Please try again."
            );

            if (!retryError) {
              if (retryData.user && !retryData.session) {
                return {
                  success: true,
                  error: "Please check your email to verify your account before signing in.",
                };
              }
              return { success: true };
            }

            console.warn("Signup retry still failed:", retryError.message);
          }

          return {
            success: false,
            error:
              "This email is still registered. If this account was declined, wait a few seconds and try Create Account again.",
          };
        }
        return { success: false, error: authError.message };
      }

      // Do not block signup with an extra users-table insert here.
      // The verification callback page and session hooks already upsert the profile.

      // If user was created but no session (email confirmation required)
      if (signUpData.user && !signUpData.session) {
        return {
          success: true,
          error: "Please check your email to verify your account before signing in.",
        };
      }

      // If we have a session (email confirmation not required), user will be inserted by useEffect
      return { success: true };
    } catch (error) {
      console.error("Signup error:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred",
      };
    }
  };

  const resendVerificationEmail = async (email: string): Promise<AuthResponse> => {
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.toLowerCase().trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/verify-email?type=signup`,
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to resend verification email",
      };
    }
  };

  const signInWithEmail = async (
    email: string,
    password: string
  ): Promise<AuthResponse> => {
    try {
      console.log("Attempting to sign in...");
      const cleanedEmail = email.toLowerCase().trim();
      
      // FIRST: Check decline log (covers cases where the account was deleted after being declined)
      try {
        const { data: declineLogData, error: declineLogError } = await Promise.race([
          supabase.rpc("get_decline_reason", { email_input: cleanedEmail }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("RPC timeout")), 5000)
          )
        ]) as any;

        const declineLogEntry = Array.isArray(declineLogData)
          ? declineLogData[0]
          : declineLogData;

        if (!declineLogError && declineLogEntry?.reason) {
          const logUserId =
            typeof declineLogEntry?.user_id === "string" ? declineLogEntry.user_id : null;
          await invokeDeclinedCleanup(cleanedEmail, logUserId ? [logUserId] : undefined, {
            purgeDeclineLog: true,
          });
          return {
            success: false,
            error: "Your account has been declined and you cannot log in.",
            declinedReason: declineLogEntry.reason,
            declinedUserId: logUserId,
          };
        }
      } catch (rpcError) {
        // If RPC fails (function doesn't exist or times out), continue with login
        console.warn("Decline log check failed, continuing with login:", rpcError);
      }

      // SECOND: Check if user is declined BEFORE attempting password authentication
      // This way we can show the decline modal even if password is wrong
      const { data: declinedCheck, error: declinedCheckError } = await supabase
        .from("users")
        .select("declined, declined_reason, user_id")
        .ilike("email", cleanedEmail)
        .maybeSingle();

      // If we found a declined user, return decline reason immediately
      if (!declinedCheckError && declinedCheck && declinedCheck.declined === true) {
        await invokeDeclinedCleanup(
          cleanedEmail,
          declinedCheck.user_id ? [declinedCheck.user_id] : undefined,
          { purgeDeclineLog: true }
        );
        return {
          success: false,
          error: "Your account has been declined and you cannot log in.",
          declinedReason:
            declinedCheck.declined_reason ||
            "Your account was declined during veterinary review.",
          declinedUserId: declinedCheck.user_id || null,
        };
      }

      // Now attempt password authentication
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanedEmail,
        password,
      });

      if (error) {
        console.error("Sign in error:", error);
        return {
          success: false,
          error: "Invalid email or password",
        };
      }

      if (!data?.user) {
        return {
          success: false,
          error: "User not found",
        };
      }

      // Check if email is confirmed first
      if (!data.user.email_confirmed_at) {
        await supabase.auth.signOut();
        return {
          success: false,
          error: "Please verify your email address before signing in. Check your inbox for the verification link.",
        };
      }

      // Get user role, verification, and declined status from users table
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("role, verified, declined, declined_reason")
        .eq("user_id", data.user.id)
        .single();

      if (userError || !userData) {
        console.error("Error fetching user role:", userError);
        await supabase.auth.signOut();
        return {
          success: false,
          error: "Error fetching user account. Please contact support.",
        };
      }

      // Double-check declined status (in case it was set after the initial check)
      if (userData.declined === true) {
        await invokeDeclinedCleanup(cleanedEmail, [data.user.id], {
          purgeDeclineLog: true,
        });
        await supabase.auth.signOut();
        return {
          success: false,
          error: "Your account has been declined and you cannot log in.",
          declinedReason:
            userData.declined_reason ||
            "Your account was declined during veterinary review.",
          declinedUserId: data.user.id,
        };
      }

      // For regular users: Block login if account is not verified by admin/vet
      // Vets and admins can always log in (they don't need approval)
      if (userData.role === "user") {
        // Check if verified field exists and is true
        if (userData.verified !== true) {
          await supabase.auth.signOut();
          return {
            success: false,
            error: "Your account is awaiting vet/admin approval. You cannot log in until your account has been verified. We'll notify you once it's approved.",
          };
        }
      }

      // Store role in localStorage
      localStorage.setItem("userRole", userData.role || "user");

      // Try adoptionValidation from localStorage (may be null for returning users)
      let adoptionValidation = null;
      const cached = localStorage.getItem("pendingAdoptionValidation");
      if (cached) {
        try {
          adoptionValidation = JSON.parse(cached);
        } catch {}
        localStorage.removeItem("pendingAdoptionValidation"); // Clean up after inserting
      }
      // Preserve existing role - don't overwrite admin/vet roles
      // Only update if the role from database is valid, otherwise keep existing
      const { error: upsertError } = await supabase
        .from("users")
        .upsert([
          {
            user_id: data.user.id,
            email: data.user.email,
            role: userData?.role || "user", // userData comes from database query, so it's already the correct role
            full_name: data.user.user_metadata?.full_name ||
              (data.user.user_metadata?.first_name
                ? `${data.user.user_metadata.first_name}${data.user.user_metadata?.last_name ? ' ' + data.user.user_metadata.last_name : ''}`
                : null) ||
              data.user.email?.split("@")[0] || null,
            adoption_validation: adoptionValidation,
            created_at: new Date().toISOString(),
          }
        ], { 
          onConflict: 'user_id',
          // Don't update role if it already exists (preserve admin/vet roles)
          // The role from userData is already correct from the database query above
        });
      if (upsertError) {
        console.error('Upsert error:', upsertError);
      }

      console.log("Sign in successful");
      return {
        success: true,
      };
    } catch (error) {
      console.error("Unexpected error during sign in:", error);
      return {
        success: false,
        error: "An unexpected error occurred",
      };
    }
  };

  const signOut = async () => {
    try {
      // Clear all auth data first
      setUser(null);
      setRole(null);

      // Clear all localStorage data
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith("supabase.auth.")) {
          localStorage.removeItem(key);
        }
      }
      // Also clear your custom role key
      localStorage.removeItem("userRole");

      // Kill the session
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      // Navigate to landing page
      window.location.href = "/";
    } catch (error) {
      console.error("Error during sign out:", error);
      // Force a hard refresh even on error
      window.location.href = "/";
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        signUpWithEmail,
        signInWithEmail,
        signOut,
        resendVerificationEmail,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within the AuthProvider");
  }
  return context;
};
