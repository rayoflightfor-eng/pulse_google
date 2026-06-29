import { isAuthError } from "@supabase/supabase-js";

/** Turn Supabase/auth errors into a readable string (avoids empty `{}` toasts). */
export function formatAuthError(err: unknown, fallback = "Something went wrong"): string {
  if (!err) return fallback;
  if (typeof err === "string") return err || fallback;

  if (isAuthError(err)) {
    const message = err.message?.trim();
    if (message && message !== "{}") return message;
    const code = err.code ?? "";
    if (code.includes("rate_limit") || code === "over_email_send_rate_limit") {
      return "email rate limit exceeded";
    }
    if (code === "email_exists") return "That email is already in use";
    if (code) return code.replace(/_/g, " ");
  }

  if (typeof err === "object") {
    const o = err as Record<string, unknown>;
    const message = o.message;
    if (typeof message === "string" && message.trim() && message !== "{}") return message;
    const code = typeof o.code === "string" ? o.code : "";
    if (code.includes("rate_limit") || code === "over_email_send_rate_limit") {
      return "email rate limit exceeded";
    }
    if (code) return code.replace(/_/g, " ");
  }

  if (err instanceof Error && err.message.trim() && err.message !== "{}") {
    return err.message;
  }

  return fallback;
}

export function isEmailRateLimitError(err: unknown): boolean {
  return formatAuthError(err, "").toLowerCase().includes("rate limit");
}

export function isEmailDeliveryError(err: unknown): boolean {
  const message = formatAuthError(err, "").toLowerCase();
  return (
    message.includes("error sending confirmation") ||
    message.includes("error sending confirmation mail") ||
    message.includes("error sending email")
  );
}
