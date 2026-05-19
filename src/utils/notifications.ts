import { supabase } from "../supabase-client";

type NotificationInsertPayload = {
  user_id: string;
  type: string;
  message: string;
  created_at: string;
  requester_id?: string;
  link?: string;
  post_id?: number;
};

const isPostIdSchemaError = (error: {
  code?: string | null;
  message?: string | null;
  details?: string | null;
}) => {
  if (!error) return false;
  const text = `${error.message || ""} ${error.details || ""}`.toLowerCase();
  return (
    error.code === "23503" ||
    (text.includes("post_id") && text.includes("foreign key"))
  );
};

const getMissingColumnName = (error: {
  message?: string | null;
  details?: string | null;
}) => {
  const text = `${error.message || ""} ${error.details || ""}`;

  const schemaCacheMatch = text.match(
    /could not find the ['"]([a-z0-9_]+)['"] column/i
  );
  if (schemaCacheMatch?.[1]) return schemaCacheMatch[1].toLowerCase();

  const postgresMatch = text.match(
    /column ['"]?([a-z0-9_]+)['"]?(?: of relation ['"]?[a-z0-9_]+['"]?)? does not exist/i
  );
  if (postgresMatch?.[1]) return postgresMatch[1].toLowerCase();

  return null;
};

export const insertNotificationWithFallback = async (
  payload: NotificationInsertPayload
) => {
  const attemptPayload: NotificationInsertPayload = { ...payload };

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const result = await supabase.from("notifications").insert([attemptPayload]);
    if (!result.error) return null;

    if (attemptPayload.post_id && isPostIdSchemaError(result.error)) {
      delete attemptPayload.post_id;
      continue;
    }

    const missingColumn = getMissingColumnName(result.error);
    if (missingColumn && missingColumn in attemptPayload) {
      delete attemptPayload[
        missingColumn as keyof NotificationInsertPayload
      ];
      continue;
    }

    return result.error;
  }

  return {
    message: "Failed to insert notification after fallback attempts",
  };
};
