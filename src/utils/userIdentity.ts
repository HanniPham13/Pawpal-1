import { supabase } from "../supabase-client";

type UserIdentity = {
  name: string;
  email: string;
  avatar: string | null;
};

const fallbackNameFor = (userId: string) =>
  `User ${String(userId).slice(0, 6) || "Unknown"}`;

const normalizeText = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const getFirstTextValueFromObject = (value: unknown): string | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  for (const objectValue of Object.values(record)) {
    const normalized = normalizeText(objectValue);
    if (normalized) return normalized;
  }
  return null;
};

const getEmailFromRpcResult = (data: unknown): string | null => {
  if (Array.isArray(data) && data.length > 0) {
    const first = data[0] as { email?: unknown };
    return normalizeText(first?.email) || getFirstTextValueFromObject(first);
  }

  if (typeof data === "object" && data !== null) {
    const maybeObj = data as { email?: unknown };
    return normalizeText(maybeObj.email) || getFirstTextValueFromObject(maybeObj);
  }

  return normalizeText(data);
};

const getNameFromRpcResult = (data: unknown): string | null => {
  if (Array.isArray(data) && data.length > 0) {
    const first = data[0] as { full_name?: unknown; name?: unknown; email?: unknown };
    return (
      normalizeText(first?.full_name) ||
      normalizeText(first?.name) ||
      normalizeText(first?.email) ||
      getFirstTextValueFromObject(first) ||
      normalizeText(data[0])
    );
  }

  if (typeof data === "object" && data !== null) {
    const maybeObj = data as { full_name?: unknown; name?: unknown; email?: unknown };
    return (
      normalizeText(maybeObj.full_name) ||
      normalizeText(maybeObj.name) ||
      normalizeText(maybeObj.email) ||
      getFirstTextValueFromObject(maybeObj)
    );
  }

  return normalizeText(data);
};

export const resolveUserIdentity = async (
  userId: string,
  fallbackEmail?: string
): Promise<UserIdentity> => {
  const fallbackName = normalizeText(fallbackEmail)?.split("@")[0] || fallbackNameFor(userId);

  if (!userId) {
    return { name: fallbackName, email: normalizeText(fallbackEmail) || "", avatar: null };
  }

  let email = normalizeText(fallbackEmail) || "";
  let avatar: string | null = null;

  try {
    const { data: profileData } = await supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", userId)
      .maybeSingle();

    const profileName = normalizeText(profileData?.full_name);
    avatar = normalizeText(profileData?.avatar_url) || null;
    if (profileName) {
      return { name: profileName, email, avatar };
    }
  } catch (error) {
    console.warn("resolveUserIdentity: profiles lookup failed", error);
  }

  try {
    const { data: usersData } = await supabase
      .from("users")
      .select("full_name, email")
      .eq("user_id", userId)
      .maybeSingle();

    const usersName = normalizeText(usersData?.full_name);
    const usersEmail = normalizeText(usersData?.email);
    if (usersEmail && !email) email = usersEmail;
    if (usersName) {
      return { name: usersName, email, avatar };
    }
  } catch (error) {
    console.warn("resolveUserIdentity: users lookup failed", error);
  }

  try {
    const { data: displayNameData, error: displayNameError } = await supabase.rpc(
      "get_user_display_name",
      { user_uuid: userId }
    );
    if (!displayNameError) {
      const displayName = getNameFromRpcResult(displayNameData);
      if (displayName) {
        return { name: displayName, email, avatar };
      }
    }
  } catch (error) {
    console.warn("resolveUserIdentity: get_user_display_name RPC failed", error);
  }

  try {
    const { data: nameData, error: nameError } = await supabase.rpc("get_user_name", {
      user_id: userId,
    });
    if (!nameError) {
      const rpcName = getNameFromRpcResult(nameData);
      if (rpcName) {
        return { name: rpcName, email, avatar };
      }
    }
  } catch (error) {
    console.warn("resolveUserIdentity: get_user_name RPC failed", error);
  }

  try {
    const { data: emailData, error: emailError } = await supabase.rpc("get_user_email", {
      user_id: userId,
    });
    if (!emailError) {
      const rpcEmail = getEmailFromRpcResult(emailData);
      if (rpcEmail) {
        email = rpcEmail;
        const emailName = rpcEmail.split("@")[0];
        return { name: normalizeText(emailName) || fallbackName, email, avatar };
      }
    }
  } catch (error) {
    console.warn("resolveUserIdentity: get_user_email RPC failed", error);
  }

  return { name: fallbackName, email, avatar };
};

