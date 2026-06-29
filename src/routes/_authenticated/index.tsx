import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, Flame, Sparkles, Timer } from "lucide-react";
import { actions, hoursUntil, isAtRisk, isOverdue, rankedTasks, useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RescueButton, RescuePlansPanel } from "@/components/RescueFlow";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Today — Pulse" },
      {
        name: "description",
        content:
          "Your prioritized queue, at-risk deadlines, and the single most important next action.",
      },
    ],
  }),
  component: TodayPage,
});

function fmtDeadline(iso: string | null) {
  if (!iso) return "No deadline";
  const h = hoursUntil(iso);
  if (h < 0) return `Overdue ${Math.abs(Math.round(h))}h`;
  if (h < 1) return `${Math.round(h * 60)}m left`;
  if (h < 48) return `${Math.round(h)}h left`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function TodayPage() {
  const tasks = useStore((s) => s.tasks);
  const atRiskHours = useStore((s) => s.prefs.atRiskHours);
  const ranked = rankedTasks(tasks);
  const overdue = tasks.filter(isOverdue);
  const next6h = tasks.filter(
    (t) => !t.done && t.deadline && hoursUntil(t.deadline) >= 0 && hoursUntil(t.deadline) < 6,
  );
  const atRisk = tasks.filter(isAtRisk);
  const focus = ranked[0];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <div className="text-sm text-muted-foreground">Today</div>
        <h1 className="text-3xl font-semibold tracking-tight">Let's not miss anything.</h1>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Overdue" value={overdue.length} icon={AlertTriangle} tone="destructive" />
        <Stat label="Next 6h" value={next6h.length} icon={Timer} tone="warning" />
        <Stat
          label={`At risk (${atRiskHours}h)`}
          value={atRisk.length}
          icon={Flame}
          tone="primary"
        />
        <Stat label="Open tasks" value={tasks.filter((t) => !t.done).length} icon={Sparkles} />
      </div>

      {focus ? (
        <div className="rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-6">
          <div className="text-xs uppercase tracking-wider text-primary">Focus now</div>
          <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">{focus.title}</h2>
              <div className="mt-1 text-sm text-muted-foreground">
                P{focus.priority} · {fmtDeadline(focus.deadline)}
              </div>
              {focus.notes ? (
                <p className="mt-2 max-w-prose text-sm text-muted-foreground">{focus.notes}</p>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button onClick={() => actions.updateTask(focus.id, { done: true })}>
                Mark done
              </Button>
              <RescueButton task={focus} />
            </div>
          </div>
        </div>
      ) : null}

      <RescuePlansPanel />

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Prioritized queue
          </h3>
          <Link to="/tasks" className="text-sm text-primary inline-flex items-center gap-1">
            All tasks <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
          {ranked.slice(0, 8).map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-4 py-3">
              <Checkbox
                checked={t.done}
                onCheckedChange={(v) => actions.updateTask(t.id, { done: Boolean(v) })}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{t.title}</div>
                <div className="text-xs text-muted-foreground">
                  P{t.priority} · {fmtDeadline(t.deadline)}
                  {isAtRisk(t) ? <span className="ml-2 text-primary">· at risk</span> : null}
                  {isOverdue(t) ? <span className="ml-2 text-destructive">· overdue</span> : null}
                </div>
              </div>
              <RescueButton task={t} />
            </li>
          ))}
          {ranked.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-muted-foreground">
              All clear. Add a task to get started.
            </li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "primary" | "warning" | "destructive";
}) {
  const toneClass =
    tone === "destructive"
      ? "text-destructive"
      : tone === "warning"
        ? "text-amber-500"
        : tone === "primary"
          ? "text-primary"
          : "text-muted-foreground";
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">{label}</div>
        <Icon className={`h-4 w-4 ${toneClass}`} />
      </div>
      <div className={`mt-2 text-2xl font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}
