import { User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../supabase-client";

interface AuthResponse {
  success: boolean;
  error?: string;
<<<<<<< Updated upstream
  declinedReason?: string | null;
  /** When present, pass to decline-user-cleanup so auth deletion does not rely on email scan alone. */
  declinedUserId?: string | null;
=======
>>>>>>> Stashed changes
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
      
      // Check if user already exists
      const { data: existingUser, error: checkError } = await supabase
        .from("users")
        .select("id, adoption_validation")
        .eq("id", user.id)
        .maybeSingle();
      
      if (checkError) {
        console.error("Error checking existing user:", checkError);
      }
      
      // Prepare user data - prioritize cached adoption validation if it exists
      // Only use existing adoption_validation if there's no cached one (to avoid overwriting with null)
      const finalAdoptionValidation = adoptionValidation || existingUser?.adoption_validation || null;
      
      console.log("Final adoption validation for upsert:", finalAdoptionValidation);
      
      // Build full_name: try metadata full_name, then first+last, then email prefix
      const resolvedFullName = 
        user.user_metadata?.full_name ||
        (user.user_metadata?.first_name
          ? `${user.user_metadata.first_name}${user.user_metadata?.last_name ? ' ' + user.user_metadata.last_name : ''}`
          : null) ||
        user.email?.split("@")[0] ||
        null;

      const userData = {
        id: user.id,
        email: user.email || "",
<<<<<<< Updated upstream
        full_name: resolvedFullName,
        role: finalRole,
=======
        full_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Unknown",
        role: user.user_metadata?.role || "user",
>>>>>>> Stashed changes
        adoption_validation: finalAdoptionValidation,
        created_at: new Date().toISOString(),
      };
      
      console.log("Upserting user data:", userData);
      
      // Upsert user profile regardless of admin/vet verification status
      const { data: upsertData, error: upsertError } = await supabase
        .from("users")
        .upsert([userData], { onConflict: 'id' })
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
          // As a last-resort, call server RPC to create profile (SECURITY DEFINER RPC should be installed)
          try {
            if (adoptionValidation && typeof adoptionValidation === 'object') {
              await supabase.rpc('create_user_profile_if_missing', {
                _validation: adoptionValidation,
                _full_name: userData.full_name,
                _role: userData.role,
              });
                // Also persist the structured adoption answers into rows if table exists
                try {
                  await supabase.rpc('save_adoption_validation_for_current_user', { _validation: adoptionValidation });
                } catch (innerRpcErr) {
                  console.warn('save_adoption_validation_for_current_user failed:', innerRpcErr);
                }
              if (cached) localStorage.removeItem('pendingAdoptionValidation');
            }
          } catch (rpcErr) {
            console.warn('RPC create_user_profile_if_missing failed:', rpcErr);
          }
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
        // Also attempt RPC to ensure profiles row exists (no-op if already present)
        try {
          await supabase.rpc('create_user_profile_if_missing', {
            _validation: finalAdoptionValidation,
            _full_name: userData.full_name,
            _role: userData.role,
          });
          // Persist adoption validation into rows if available
          if (finalAdoptionValidation) {
            try {
              await supabase.rpc('save_adoption_validation_for_current_user', { _validation: finalAdoptionValidation });
            } catch (inner) {
              console.warn('save_adoption_validation_for_current_user failed after upsert:', inner);
            }
          }
        } catch (rpcErr) {
          console.warn('RPC create_user_profile_if_missing after upsert failed:', rpcErr);
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
<<<<<<< Updated upstream
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

=======
>>>>>>> Stashed changes
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

      // If signup fails due to existing email or server error
      if (authError) {
        // Log full error object for diagnostics
        console.error("Signup error (full):", authError);
        const msg = authError?.message || JSON.stringify(authError);
        if (
          msg.includes("already registered") ||
          msg.includes("already exists") ||
          msg.includes("User already registered")
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
        // Return the full error object stringified so UI can show more detail
        return { success: false, error: typeof authError === 'string' ? authError : JSON.stringify(authError) };
      }

<<<<<<< Updated upstream
      // Do not block signup with an extra users-table insert here.
      // The verification callback page and session hooks already upsert the profile.
=======
      // If user was created, try to insert into users table immediately
      // This might fail due to RLS, but we'll retry after email verification
      if (signUpData?.user?.id) {
        console.log("Attempting to insert user into users table:", signUpData.user.id);
        
        // Prepare adoption validation - filter out empty values
        let finalAdoptionValidation = null;
        if (adoptionValidation && typeof adoptionValidation === 'object') {
          finalAdoptionValidation = Object.fromEntries(
            Object.entries(adoptionValidation).filter(([_, value]) => value && value.trim && value.trim() !== '')
          );
          if (Object.keys(finalAdoptionValidation).length === 0) {
            finalAdoptionValidation = null;
          }
        }
        
        console.log("Adoption validation being saved:", finalAdoptionValidation);
        
        const { error: insertError, data: insertData } = await supabase
          .from("users")
          .insert([
            {
              id: signUpData.user.id,
              email: email.toLowerCase().trim(),
              full_name: fullName,
              role,
              adoption_validation: finalAdoptionValidation,
              created_at: new Date().toISOString()
            }
          ])
          .select();
        
          if (insertError) {
          console.error("Failed to insert user profile on sign up (this is OK, will retry after verification):", insertError);
          console.error("Insert error details:", JSON.stringify(insertError, null, 2));
          // Keep adoption validation in localStorage for retry after email verification
          // Try RPC immediately so server creates the user/profile using auth.uid()
          try {
            // Call RPC regardless of whether adoption answers exist so a profiles row is created.
            await supabase.rpc('create_user_profile_if_missing', {
              _validation: finalAdoptionValidation,
              _full_name: fullName,
              _role: role,
            });
            // Persist adoption validation into rows if available (no-op if null)
            try {
              await supabase.rpc('save_adoption_validation_for_current_user', { _validation: finalAdoptionValidation });
            } catch (saveErr) {
              console.warn('save_adoption_validation_for_current_user failed after signup insert error:', saveErr);
            }
            // If RPC succeeded, clear localStorage
            localStorage.removeItem('pendingAdoptionValidation');
          } catch (rpcErr: any) {
            console.warn('RPC create_user_profile_if_missing failed after signup insert error:', rpcErr);
            // Return a clear error so the UI can show meaningful feedback.
            return { success: false, error: rpcErr?.message || 'Database error saving new user' };
          }
          } else {
          console.log("Successfully inserted user profile:", insertData);
          // Clear localStorage since we successfully saved it
          if (finalAdoptionValidation) {
            localStorage.removeItem("pendingAdoptionValidation");
          }
        }
      }
>>>>>>> Stashed changes

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
<<<<<<< Updated upstream
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
=======
>>>>>>> Stashed changes
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase(),
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

      // Get user role and verification from users table
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("role, verified")
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

<<<<<<< Updated upstream
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

=======
>>>>>>> Stashed changes
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
      const { error: upsertError } = await supabase
        .from("users")
        .upsert([
          {
            id: data.user.id,
            email: data.user.email,
<<<<<<< Updated upstream
            role: userData?.role || "user", // userData comes from database query, so it's already the correct role
            full_name: data.user.user_metadata?.full_name ||
              (data.user.user_metadata?.first_name
                ? `${data.user.user_metadata.first_name}${data.user.user_metadata?.last_name ? ' ' + data.user.user_metadata.last_name : ''}`
                : null) ||
              data.user.email?.split("@")[0] || null,
=======
            role: userData?.role || "user",
            full_name: data.user.user_metadata?.full_name || data.user.email?.split("@")[0] || "Unknown",
>>>>>>> Stashed changes
            adoption_validation: adoptionValidation,
            created_at: new Date().toISOString(),
          }
        ], { onConflict: 'id' });
      if (upsertError) {
        console.error('Upsert error:', upsertError);
        // Fallback to server RPC to ensure adoption validation is stored
        try {
          if (adoptionValidation) {
            await supabase.rpc('create_user_profile_if_missing', {
              _validation: adoptionValidation,
              _full_name: data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || 'Unknown',
              _role: userData?.role || 'user',
            });
            try {
              await supabase.rpc('save_adoption_validation_for_current_user', { _validation: adoptionValidation });
            } catch (saveErr) {
              console.warn('save_adoption_validation_for_current_user failed on sign in upsert fallback:', saveErr);
            }
          }
        } catch (rpcErr) {
          console.warn('RPC create_user_profile_if_missing on sign in upsert failure:', rpcErr);
        }
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
