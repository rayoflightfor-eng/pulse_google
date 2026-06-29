import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const [message, setMessage] = useState("Confirming…");

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const next = params.get("next") || "/";
    const type = (params.get("type") || hashParams.get("type")) as EmailOtpType | null;

    async function finish(success: boolean, text: string) {
      if (cancelled) return;
      cancelled = true;
      setMessage(text);
      if (success) toast.success(text);
      else toast.error(text);
      window.location.replace(next);
    }

    async function handle() {
      const tokenHash = params.get("token_hash");
      if (tokenHash && type) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type,
        });
        if (error) {
          await finish(false, error.message);
          return;
        }
      }

      const code = params.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          await finish(false, error.message);
          return;
        }
      }

      const { data, error } = await supabase.auth.getSession();
      if (error) {
        await finish(false, error.message);
        return;
      }
      if (data.session) {
        await finish(
          true,
          type === "email_change" ? "Email updated successfully" : "Email confirmed — you're signed in",
        );
        return;
      }

      // Allow Supabase client time to parse hash tokens from the URL.
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const { data: retry } = await supabase.auth.getSession();
      if (retry.session) {
        await finish(
          true,
          type === "email_change" ? "Email updated successfully" : "Email confirmed — you're signed in",
        );
        return;
      }

      await finish(false, "Invalid or expired confirmation link");
    }

    void handle();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-background px-4">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
