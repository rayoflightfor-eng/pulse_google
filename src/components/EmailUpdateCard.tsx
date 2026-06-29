import { useEffect, useState } from "react";
import { Mail, Loader2, ShieldCheck, X } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getAuthRedirectTo } from "@/lib/auth-redirect";
import { formatAuthError, isEmailRateLimitError } from "@/lib/auth-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z
  .object({
    newEmail: z.string().trim().email("Enter a valid email").max(255),
    confirmEmail: z.string().trim().email("Enter a valid email").max(255),
    password: z.string().min(6, "Password is required to confirm"),
  })
  .refine((d) => d.newEmail.toLowerCase() === d.confirmEmail.toLowerCase(), {
    path: ["confirmEmail"],
    message: "Emails don't match",
  });

type FieldErrors = Partial<Record<"newEmail" | "confirmEmail" | "password", string>>;

export function EmailUpdateCard() {
  const [currentEmail, setCurrentEmail] = useState<string>("");
  const [newEmail, setNewEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setCurrentEmail(data.user?.email ?? "");
      // Supabase exposes the not-yet-confirmed address here while change is pending.
      const newE = data.user?.new_email;
      if (newE && newE !== data.user?.email) setPendingEmail(newE);
    });
    return () => {
      active = false;
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    const parsed = schema.safeParse({ newEmail, confirmEmail, password });
    if (!parsed.success) {
      const fe: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as keyof FieldErrors;
        if (k && !fe[k]) fe[k] = issue.message;
      }
      setErrors(fe);
      return;
    }
    if (parsed.data.newEmail.toLowerCase() === currentEmail.toLowerCase()) {
      setErrors({ newEmail: "That's already your current email" });
      return;
    }
    if (pendingEmail) {
      toast.error("Email change already pending", {
        description: `Confirm the link sent to ${pendingEmail}, or cancel the pending change first.`,
      });
      return;
    }

    setLoading(true);
    try {
      // Reauthenticate with current password before requesting a change.
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: currentEmail,
        password: parsed.data.password,
      });
      if (signInError) {
        setErrors({ password: formatAuthError(signInError, "Incorrect password") });
        return;
      }

      const { error } = await supabase.auth.updateUser(
        { email: parsed.data.newEmail },
        { emailRedirectTo: getAuthRedirectTo("/settings") },
      );
      if (error) throw error;

      setPendingEmail(parsed.data.newEmail);
      setNewEmail("");
      setConfirmEmail("");
      setPassword("");
      toast.success("Verification email sent", {
        description:
          "Check both your current and new inboxes. The change only takes effect after you confirm.",
      });
    } catch (err: unknown) {
      if (isEmailRateLimitError(err)) {
        toast.error("Too many emails sent", {
          description:
            "Wait about an hour, then try again. Supabase limits how many verification emails can be sent.",
        });
      } else {
        toast.error(formatAuthError(err, "Couldn't start email change"));
      }
    } finally {
      setLoading(false);
    }
  }

  async function onResendPending() {
    if (!pendingEmail || !currentEmail) return;
    setLoading(true);
    try {
      // Resend to the new address; fall back to current if needed.
      let lastError: unknown;
      for (const email of [pendingEmail, currentEmail]) {
        const { error } = await supabase.auth.resend({
          type: "email_change",
          email,
          options: { emailRedirectTo: getAuthRedirectTo("/settings") },
        });
        if (!error) {
          toast.success("Verification email resent", {
            description: `Check ${pendingEmail} (and ${currentEmail}) for the confirmation link.`,
          });
          return;
        }
        lastError = error;
      }
      throw lastError;
    } catch (err: unknown) {
      if (isEmailRateLimitError(err)) {
        toast.error("Too many emails sent", {
          description:
            "Supabase blocks more emails for about an hour. Wait, then try again — or cancel the pending change and retry later.",
        });
      } else {
        toast.error(formatAuthError(err, "Couldn't resend verification email"));
      }
    } finally {
      setLoading(false);
    }
  }

  async function cancelPending() {
    // Re-issuing updateUser with the current email cancels the pending change.
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: currentEmail });
      if (error) throw error;
      setPendingEmail(null);
      toast.success("Pending email change cancelled");
    } catch (err: unknown) {
      toast.error(formatAuthError(err, "Couldn't cancel"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div>
        <div className="flex items-center gap-2 font-medium">
          <Mail className="h-4 w-4 text-primary" /> Account email
        </div>
        <p className="text-xs text-muted-foreground">
          Changing your email requires your current password and a verification link sent to the new
          address. Your email isn't updated until you click that link.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
        <div className="text-xs text-muted-foreground">Current</div>
        <div className="font-medium break-all">{currentEmail || "—"}</div>
      </div>

      {pendingEmail ? (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm">
          <div className="flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 mt-0.5 text-primary shrink-0" />
            <div>
              <div className="font-medium">Pending verification</div>
              <div className="text-xs text-muted-foreground break-all">
                Confirm the link sent to <span className="font-medium">{pendingEmail}</span> to
                finish the change.
              </div>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={cancelPending}
            disabled={loading}
            title="Cancel pending change"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : null}

      {pendingEmail ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onResendPending}
          disabled={loading}
        >
          Resend verification to {pendingEmail}
        </Button>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="new-email">New email</Label>
          <Input
            id="new-email"
            type="email"
            autoComplete="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            maxLength={255}
            required
          />
          {errors.newEmail ? <p className="text-xs text-destructive">{errors.newEmail}</p> : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm-email">Confirm new email</Label>
          <Input
            id="confirm-email"
            type="email"
            autoComplete="email"
            value={confirmEmail}
            onChange={(e) => setConfirmEmail(e.target.value)}
            maxLength={255}
            required
          />
          {errors.confirmEmail ? (
            <p className="text-xs text-destructive">{errors.confirmEmail}</p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="current-password">Current password</Label>
          <Input
            id="current-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
          {errors.password ? <p className="text-xs text-destructive">{errors.password}</p> : null}
        </div>
        <Button type="submit" disabled={loading || !currentEmail || !!pendingEmail}>
          {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
          Send verification link
        </Button>
      </form>
    </section>
  );
}
