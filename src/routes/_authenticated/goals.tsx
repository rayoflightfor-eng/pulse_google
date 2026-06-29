import { createFileRoute } from "@tanstack/react-router";
import { Minus, Plus, Target, Trash2 } from "lucide-react";
import { useState } from "react";
import { actions, useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/goals")({
  head: () => ({
    meta: [
      { title: "Goals — Pulse" },
      { name: "description", content: "Track progress toward your goals." },
    ],
  }),
  component: GoalsPage,
});

function GoalsPage() {
  const goals = useStore((s) => s.goals);
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("10");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Goals</h1>
        <p className="text-sm text-muted-foreground">
          Longer-horizon targets to keep direction clear
        </p>
      </header>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-border bg-card p-3">
        <Input
          className="flex-1 min-w-[200px]"
          placeholder="New goal (e.g. Read 12 books)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Input
          type="number"
          className="w-24"
          placeholder="Target"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
        />
        <Button
          onClick={() => {
            const n = Number(target);
            if (!title.trim() || !n) return;
            actions.addGoal({ title: title.trim(), target: n, progress: 0, deadline: null });
            setTitle("");
            setTarget("10");
          }}
        >
          <Plus className="mr-1.5 h-4 w-4" /> Add goal
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {goals.map((g) => {
          const pct = Math.min(100, Math.round((g.progress / g.target) * 100));
          return (
            <div key={g.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Target className="h-3.5 w-3.5" /> Goal
                  </div>
                  <div className="mt-0.5 font-semibold">{g.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {g.progress} / {g.target}
                    {g.deadline ? ` · by ${new Date(g.deadline).toLocaleDateString()}` : ""}
                  </div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => actions.deleteGoal(g.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Progress value={pct} className="mt-3" />
              <div className="mt-3 flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    actions.updateGoal(g.id, { progress: Math.max(0, g.progress - 1) })
                  }
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  onClick={() => actions.updateGoal(g.id, { progress: g.progress + 1 })}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
        {goals.length === 0 ? (
          <div className="md:col-span-2 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No goals yet.
          </div>
        ) : null}
      </div>
    </div>
  );
}
