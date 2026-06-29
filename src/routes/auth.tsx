import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Activity, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getAuthRedirectTo } from "@/lib/auth-redirect";
import { formatAuthError, isEmailDeliveryError, isEmailRateLimitError } from "@/lib/auth-errors";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — Pulse" },
      {
        name: "description",
        content: "Sign in to Pulse to plan, prioritize, and rescue your deadlines.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/" });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) navigate({ to: "/" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: getAuthRedirectTo("/") },
        });
        if (error) throw error;
        setAwaitingConfirmation(true);
        toast.success("Check your email", {
          description:
            "Look for a message from Supabase (check spam). Click the confirmation link before signing in.",
        });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: unknown) {
      const message = formatAuthError(err, "Authentication failed");
      if (isEmailDeliveryError(err)) {
        toast.error("Couldn't send confirmation email", {
          description:
            "Supabase email delivery failed for this project. Check spam, configure SMTP in Supabase Dashboard → Authentication → Email, or run scripts/configure-supabase-auth.ps1 -AutoConfirm for local dev.",
        });
      } else if (isEmailRateLimitError(err)) {
        toast.error("Too many emails sent", {
          description: "Wait about an hour, then try again or use Google sign-in.",
        });
      } else if (message.toLowerCase().includes("email not confirmed")) {
        setAwaitingConfirmation(true);
        toast.error("Confirm your email first", {
          description:
            "Check spam for a message from Supabase (not branded Pulse). Resend below if needed.",
        });
      } else if (message.toLowerCase().includes("invalid login credentials")) {
        toast.error("Can't sign in with this email yet", {
          description:
            "If you just changed your email, open the confirmation link sent to the new address first — or sign in with your old email until then.",
        });
      } else {
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function onResendConfirmation() {
    if (!email) {
      toast.error("Enter your email address first");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: getAuthRedirectTo("/") },
      });
      if (error) throw error;
      setAwaitingConfirmation(true);
      toast.success("Confirmation email sent");
    } catch (err: unknown) {
      if (isEmailDeliveryError(err)) {
        toast.error("Couldn't send confirmation email", {
          description:
            "Supabase email delivery failed. Configure SMTP in the Supabase dashboard or use -AutoConfirm locally.",
        });
      } else if (isEmailRateLimitError(err)) {
        toast.error("Too many emails sent", {
          description: "Wait about an hour, then try again.",
        });
      } else {
        toast.error(formatAuthError(err, "Couldn't resend email"));
      }
    } finally {
      setLoading(false);
    }
  }

  async function onGoogle() {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) toast.error(result.error.message ?? "Google sign-in failed");
    } catch (err: unknown) {
      toast.error(formatAuthError(err, "Google sign-in failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <div className="text-lg font-semibold tracking-tight">Pulse</div>
            <div className="text-xs text-muted-foreground">Last-minute life saver</div>
          </div>
        </div>

        <h1 className="text-2xl font-semibold tracking-tight">
          {mode === "signin" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "signin"
            ? "Sign in to keep your deadlines on track."
            : "Get started in a few seconds."}
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : mode === "signin" ? (
              "Sign in"
            ) : (
              "Sign up"
            )}
          </Button>
        </form>

        {awaitingConfirmation ? (
          <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3 text-sm">
            <p className="text-muted-foreground">
              We sent a confirmation link to <span className="font-medium text-foreground">{email || "your email"}</span>.
              Open it, then sign in here.
            </p>
            <Button
              type="button"
              variant="link"
              className="mt-1 h-auto p-0 text-sm"
              onClick={onResendConfirmation}
              disabled={loading || !email}
            >
              Resend confirmation email
            </Button>
          </div>
        ) : null}

        <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={onGoogle}
          disabled={loading}
        >
          Continue with Google
        </Button>

        <button
          type="button"
          className="mt-6 w-full text-center text-sm text-muted-foreground hover:text-foreground"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        >
          {mode === "signin" ? "No account? Create one" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
