import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  actions,
  hoursUntil,
  isAtRisk,
  isOverdue,
  PRIORITY_LABEL,
  rankedTasks,
  useStore,
  type Task,
} from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TaskEditor } from "@/components/TaskEditor";
import { RescueButton } from "@/components/RescueFlow";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({
    meta: [
      { title: "Tasks — Pulse" },
      { name: "description", content: "Edit priorities and deadlines for every open task." },
    ],
  }),
  component: TasksPage,
});

function fmtDeadline(iso: string | null) {
  if (!iso) return "No deadline";
  const h = hoursUntil(iso);
  if (h < 0) return `Overdue ${Math.abs(Math.round(h))}h`;
  if (h < 1) return `${Math.round(h * 60)}m left`;
  if (h < 48) return `${Math.round(h)}h left`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function TasksPage() {
  const tasks = useStore((s) => s.tasks);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Task | undefined>();

  const open_ = rankedTasks(tasks);
  const done = tasks.filter((t) => t.done);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Tasks</h1>
          <p className="text-sm text-muted-foreground">
            {open_.length} open · {done.length} done
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-1.5 h-4 w-4" /> New task
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New task</DialogTitle>
            </DialogHeader>
            <TaskEditor onClose={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      </header>

      <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
        {open_.map((t) => (
          <li key={t.id} className="flex items-center gap-3 px-4 py-3">
            <Checkbox
              checked={t.done}
              onCheckedChange={(v) => actions.updateTask(t.id, { done: Boolean(v) })}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{t.title}</div>
              <div className="text-xs text-muted-foreground">
                {PRIORITY_LABEL[t.priority]} · {fmtDeadline(t.deadline)}
                {isAtRisk(t) ? <span className="ml-2 text-primary">· at risk</span> : null}
                {isOverdue(t) ? <span className="ml-2 text-destructive">· overdue</span> : null}
              </div>
            </div>
            <RescueButton task={t} />
            <Button size="icon" variant="ghost" onClick={() => setEditing(t)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => actions.deleteTask(t.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </li>
        ))}
        {open_.length === 0 ? (
          <li className="px-4 py-8 text-center text-sm text-muted-foreground">No open tasks</li>
        ) : null}
      </ul>

      {done.length > 0 ? (
        <section>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Completed
          </h3>
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card/60">
            {done.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                <Checkbox
                  checked
                  onCheckedChange={() => actions.updateTask(t.id, { done: false })}
                />
                <span className="line-through text-muted-foreground flex-1 truncate">
                  {t.title}
                </span>
                <Button size="icon" variant="ghost" onClick={() => actions.deleteTask(t.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit task</DialogTitle>
          </DialogHeader>
          {editing ? <TaskEditor task={editing} onClose={() => setEditing(undefined)} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
