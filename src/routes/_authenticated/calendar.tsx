import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({
    meta: [
      { title: "Calendar — Pulse" },
      { name: "description", content: "6-week deadline calendar across tasks and rescue steps." },
    ],
  }),
  component: CalendarPage,
});

function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

function CalendarPage() {
  const tasks = useStore((s) => s.tasks);
  const plans = useStore((s) => s.rescuePlans);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = startOfWeek(today);
  const days = Array.from({ length: 42 }).map((_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });

  const taskByDay = new Map<string, typeof tasks>();
  for (const t of tasks) {
    if (!t.deadline) continue;
    const k = new Date(t.deadline).toDateString();
    const arr = taskByDay.get(k) ?? [];
    arr.push(t);
    taskByDay.set(k, arr);
  }
  const stepByDay = new Map<string, { title: string; planId: string }[]>();
  for (const p of plans) {
    if (p.status !== "approved") continue;
    for (const s of p.steps) {
      const k = new Date(s.startAt).toDateString();
      const arr = stepByDay.get(k) ?? [];
      arr.push({ title: s.title, planId: p.id });
      stepByDay.set(k, arr);
    }
  }

  const monthLabel = today.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Calendar</h1>
        <p className="text-sm text-muted-foreground">{monthLabel} · next 6 weeks</p>
      </header>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="grid grid-cols-7 border-b border-border bg-muted/30 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="px-2 py-2 text-center">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d) => {
            const isToday = d.toDateString() === new Date().toDateString();
            const ts = taskByDay.get(d.toDateString()) ?? [];
            const ss = stepByDay.get(d.toDateString()) ?? [];
            return (
              <div
                key={d.toISOString()}
                className={`min-h-[96px] border-b border-r border-border p-2 ${
                  isToday ? "bg-primary/5" : ""
                }`}
              >
                <div
                  className={`text-xs ${
                    isToday ? "font-semibold text-primary" : "text-muted-foreground"
                  }`}
                >
                  {d.getDate()}
                </div>
                <div className="mt-1 space-y-1">
                  {ts.slice(0, 2).map((t) => (
                    <div
                      key={t.id}
                      className="truncate rounded bg-primary/15 px-1.5 py-0.5 text-[10px] text-primary"
                      title={t.title}
                    >
                      {t.title}
                    </div>
                  ))}
                  {ss.slice(0, 2).map((s, i) => (
                    <div
                      key={i}
                      className="truncate rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-500"
                      title={s.title}
                    >
                      ◷ {s.title}
                    </div>
                  ))}
                  {ts.length + ss.length > 4 ? (
                    <div className="text-[10px] text-muted-foreground">
                      +{ts.length + ss.length - 4} more
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
