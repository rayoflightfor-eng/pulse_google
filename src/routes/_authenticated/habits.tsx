import { createFileRoute } from "@tanstack/react-router";
import { Flame, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { actions, useStore, type Habit } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/habits")({
  head: () => ({
    meta: [
      { title: "Habits — Pulse" },
      { name: "description", content: "30-day habit grid with streaks." },
    ],
  }),
  component: HabitsPage,
});

function streak(h: Habit) {
  const set = new Set(h.completedDates);
  let s = 0;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  while (true) {
    const k = d.toISOString().slice(0, 10);
    if (set.has(k)) {
      s++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return s;
}

function HabitsPage() {
  const habits = useStore((s) => s.habits);
  const [title, setTitle] = useState("");

  const days = Array.from({ length: 30 }).map((_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (29 - i));
    return d;
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Habits</h1>
        <p className="text-sm text-muted-foreground">Last 30 days · click cells to toggle</p>
      </header>

      <div className="flex gap-2">
        <Input
          placeholder="New habit (e.g. Meditate 10m)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && title.trim()) {
              actions.addHabit(title.trim());
              setTitle("");
            }
          }}
        />
        <Button
          onClick={() => {
            if (!title.trim()) return;
            actions.addHabit(title.trim());
            setTitle("");
          }}
        >
          <Plus className="mr-1.5 h-4 w-4" /> Add
        </Button>
      </div>

      <div className="space-y-3">
        {habits.map((h) => {
          const s = streak(h);
          return (
            <div key={h.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">{h.title}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Flame className="h-3.5 w-3.5 text-amber-500" /> {s}-day streak
                  </div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => actions.deleteHabit(h.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div
                className="grid grid-cols-15 sm:grid-cols-30 gap-1"
                style={{ gridTemplateColumns: "repeat(30, minmax(0, 1fr))" }}
              >
                {days.map((d) => {
                  const k = d.toISOString().slice(0, 10);
                  const done = h.completedDates.includes(k);
                  return (
                    <button
                      key={k}
                      onClick={() => actions.toggleHabit(h.id, k)}
                      title={k}
                      className={`aspect-square rounded transition-colors ${
                        done ? "bg-primary" : "bg-muted hover:bg-muted-foreground/20"
                      }`}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
        {habits.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No habits yet. Add one above.
          </div>
        ) : null}
      </div>
    </div>
  );
}
