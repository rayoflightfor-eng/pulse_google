import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  Bell,
  BellRing,
  CalendarDays,
  CheckSquare,
  ListTodo,
  LogOut,
  MessageSquare,
  Settings,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/lib/store";
import {
  notificationPermission,
  notificationsSupported,
  requestNotificationPermission,
  sendNotification,
} from "@/lib/notifications";
import { toast } from "sonner";

const nav = [
  { to: "/", label: "Today", icon: Zap },
  { to: "/tasks", label: "Tasks", icon: ListTodo },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/habits", label: "Habits", icon: CheckSquare },
  { to: "/goals", label: "Goals", icon: Target },
  { to: "/coach", label: "AI Coach", icon: MessageSquare },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const prefs = useStore((s) => s.prefs);
  const navigate = useNavigate();
  const [perm, setPerm] = useState<NotificationPermission>("default");

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  useEffect(() => {
    setPerm(notificationPermission());
  }, []);

  async function enable() {
    const p = await requestNotificationPermission();
    setPerm(p);
    if (p === "granted") toast.success("Notifications enabled");
    else if (p === "denied") toast.error("Notifications blocked in your browser");
  }

  function test() {
    if (!notificationsSupported()) {
      toast.error("This browser doesn't support notifications");
      return;
    }
    if (perm !== "granted") {
      toast.error("Enable notifications first");
      return;
    }
    const parts: string[] = [];
    if (prefs.notifyStepStart) parts.push("step-start");
    if (prefs.notifyRiskCleared) parts.push("risk-cleared");
    const label = parts.length ? parts.join(" + ") : "no event types enabled";
    const ok = sendNotification(
      "Pulse test notification",
      `Permission granted. Active alerts: ${label}.`,
      "pulse-test",
    );
    if (ok) toast.success("Test notification sent");
    else toast.error("Couldn't send notification");
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border bg-card/40 px-4 py-6">
        <Link to="/" className="mb-8 flex items-center gap-2 px-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <div className="text-base font-semibold tracking-tight">Pulse</div>
            <div className="text-xs text-muted-foreground">Last-minute life saver</div>
          </div>
        </Link>
        <nav className="flex flex-col gap-1">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto rounded-xl border border-border bg-background/60 p-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 font-medium text-foreground">
            <Sparkles className="h-3.5 w-3.5" /> Local-first
          </div>
          <p className="mt-1 leading-snug">Your tasks, habits, and goals stay in this browser.</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-2 border-b border-border bg-background/80 px-4 backdrop-blur md:px-6">
          <div className="flex items-center gap-2 md:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Activity className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold">Pulse</span>
          </div>
          <div className="hidden md:block text-sm text-muted-foreground">
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </div>
          <div className="flex items-center gap-2">
            {perm !== "granted" ? (
              <Button size="sm" variant="outline" onClick={enable}>
                <Bell className="mr-1.5 h-4 w-4" />
                Enable notifications
              </Button>
            ) : (
              <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground">
                <BellRing className="h-3.5 w-3.5 text-primary" /> Alerts on
              </span>
            )}
            <Button size="sm" variant="ghost" onClick={test} title="Send test notification">
              <BellRing className="mr-1.5 h-4 w-4" />
              Test
            </Button>
            <Button size="sm" variant="ghost" onClick={signOut} title="Sign out">
              <LogOut className="mr-1.5 h-4 w-4" />
              Sign out
            </Button>
          </div>
        </header>
        <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>

        <nav className="md:hidden sticky bottom-0 z-20 grid grid-cols-7 border-t border-border bg-background/95 backdrop-blur">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex flex-col items-center gap-0.5 py-2 text-[10px] ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
