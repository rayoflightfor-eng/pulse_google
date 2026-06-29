import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Bell, BellRing, ShieldAlert, Timer } from "lucide-react";
import { useEffect, useState } from "react";
import { actions, getState, prefsIssues, validatePrefs, useStore, type Prefs } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  notificationPermission,
  notificationsSupported,
  requestNotificationPermission,
  sendNotification,
} from "@/lib/notifications";
import { toast } from "sonner";
import { EmailUpdateCard } from "@/components/EmailUpdateCard";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Pulse" },
      { name: "description", content: "Notification preferences and test alerts." },
    ],
  }),
  component: SettingsPage,
});

function applyPrefsPatch(patch: Partial<Prefs>) {
  const current = getState().prefs;
  const next = { ...current, ...patch };
  if (!current.autoCorrectPrefs) {
    // Warn-only mode: keep raw inputs; the banner in the UI surfaces issues.
    actions.setPrefs(patch);
    return;
  }
  const validated = validatePrefs(next);
  const corrected: string[] = [];
  if (validated.atRiskHours !== next.atRiskHours)
    corrected.push(`at-risk window → ${validated.atRiskHours}h`);
  if (validated.rescueLeadMin !== next.rescueLeadMin)
    corrected.push(`rescue lead → ${validated.rescueLeadMin}m`);
  actions.setPrefs(validated);
  if (corrected.length) {
    toast.warning("Auto-corrected invalid setting", { description: corrected.join(", ") });
  }
}

function SettingsPage() {
  const prefs = useStore((s) => s.prefs);
  const [perm, setPerm] = useState<NotificationPermission>("default");

  useEffect(() => setPerm(notificationPermission()), []);

  async function enable() {
    const p = await requestNotificationPermission();
    setPerm(p);
    if (p === "granted") toast.success("Notifications enabled");
    else toast.error("Notifications blocked");
  }

  function test() {
    if (!notificationsSupported()) {
      toast.error("Notifications not supported in this browser");
      return;
    }
    if (perm !== "granted") {
      toast.error("Enable notifications first");
      return;
    }
    const enabled =
      [prefs.notifyStepStart && "step-start", prefs.notifyRiskCleared && "risk-cleared"]
        .filter(Boolean)
        .join(" + ") || "none";
    const ok = sendNotification(
      "Pulse test notification",
      `Permission granted. Active alerts: ${enabled}.`,
      "pulse-test",
    );
    if (ok) toast.success("Test notification sent");
    else toast.error("Couldn't send notification");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Choose which alerts Pulse sends you.</p>
      </header>

      <EmailUpdateCard />

      <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">Browser notifications</div>
            <div className="text-xs text-muted-foreground">
              Status:{" "}
              <span
                className={
                  perm === "granted"
                    ? "text-primary"
                    : perm === "denied"
                      ? "text-destructive"
                      : "text-muted-foreground"
                }
              >
                {perm}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            {perm !== "granted" ? (
              <Button variant="outline" onClick={enable}>
                <Bell className="mr-1.5 h-4 w-4" /> Enable
              </Button>
            ) : null}
            <Button onClick={test}>
              <BellRing className="mr-1.5 h-4 w-4" /> Send test notification
            </Button>
          </div>
        </div>

        <div className="h-px bg-border" />

        <Row
          title="Rescue step starting"
          desc="Alert when an approved rescue step's start time arrives."
          checked={prefs.notifyStepStart}
          onChange={(v) => actions.setPrefs({ notifyStepStart: v })}
        />
        <Row
          title="At-risk task cleared"
          desc={`Alert when a previously at-risk task is no longer at risk (done, deadline cleared, or pushed beyond ${prefs.atRiskHours}h).`}
          checked={prefs.notifyRiskCleared}
          onChange={(v) => actions.setPrefs({ notifyRiskCleared: v })}
        />
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 space-y-5">
        <div>
          <div className="flex items-center gap-2 font-medium">
            <ShieldAlert className="h-4 w-4 text-primary" /> Rescue tuning
          </div>
          <p className="text-xs text-muted-foreground">
            Control when Pulse flags deadlines as at-risk and how much buffer rescue plans leave
            before the deadline.
          </p>
        </div>

        <Row
          title="Auto-correct invalid values"
          desc={
            prefs.autoCorrectPrefs
              ? "On: Pulse clamps out-of-range values on save and shows a toast explaining the change."
              : "Off: Pulse keeps your inputs as-is and only shows a warning when they conflict."
          }
          checked={prefs.autoCorrectPrefs}
          onChange={(v) => {
            // Mode flip itself always goes through validation so flipping back
            // to auto-correct repairs any invalid values left from warn mode.
            actions.setPrefs(
              v ? validatePrefs({ ...prefs, autoCorrectPrefs: true }) : { autoCorrectPrefs: false },
            );
            toast.success(v ? "Auto-correct enabled" : "Warn-only mode enabled");
          }}
        />

        {prefsIssues(prefs).map((msg) => (
          <div
            key={msg}
            className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive"
          >
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>{msg}</span>
          </div>
        ))}

        <SliderRow
          label="At-risk window"
          value={prefs.atRiskHours}
          min={1}
          max={96}
          step={1}
          unit="h"
          help={`Tasks within ${prefs.atRiskHours}h of their deadline show as at-risk and feed the "risk-cleared" alert.`}
          onChange={(v) => applyPrefsPatch({ atRiskHours: v })}
        />
        <SliderRow
          label="Rescue lead time"
          value={prefs.rescueLeadMin}
          min={0}
          max={prefs.autoCorrectPrefs ? Math.min(240, prefs.atRiskHours * 60) : 240}
          step={5}
          unit="m"
          help={
            prefs.autoCorrectPrefs
              ? `New rescue plans reserve ${prefs.rescueLeadMin} minutes of buffer before the deadline. Capped at the at-risk window (${prefs.atRiskHours * 60}m).`
              : `New rescue plans reserve ${prefs.rescueLeadMin} minutes of buffer. Warn-only mode — values above the at-risk window (${prefs.atRiskHours * 60}m) trigger a warning but are kept as-is.`
          }
          onChange={(v) => applyPrefsPatch({ rescueLeadMin: v })}
        />
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
        <div className="font-medium text-foreground mb-1">Local-first storage</div>
        Pulse stores your tasks, habits, goals, and rescue plans in this browser only. Clearing site
        data will reset Pulse.
      </section>
    </div>
  );
}

function Row({
  title,
  desc,
  checked,
  onChange,
}: {
  title: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  unit,
  help,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  help: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Timer className="h-3.5 w-3.5 text-muted-foreground" />
          {label}
        </div>
        <div className="tabular-nums text-sm text-muted-foreground">
          {value}
          {unit}
        </div>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(v) => onChange(v[0] ?? value)}
      />
      <div className="text-xs text-muted-foreground">{help}</div>
    </div>
  );
}
