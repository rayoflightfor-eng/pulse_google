import { CheckCircle2, Clock, ShieldCheck, X } from "lucide-react";
import { actions, makeRescueSteps, useStore, type Task } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function RescueButton({ task }: { task: Task }) {
  function propose() {
    if (!task.deadline) {
      toast.error("Set a deadline first to plan a rescue");
      return;
    }
    const steps = makeRescueSteps(task);
    actions.createRescuePlan({
      taskId: task.id,
      rationale: `Auto-generated 4-step plan that fits within the remaining time before the deadline.`,
      steps,
    });
    toast.success("Rescue plan proposed — review and approve");
  }
  return (
    <Button size="sm" variant="outline" onClick={propose}>
      <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
      Rescue
    </Button>
  );
}

export function RescuePlansPanel() {
  const plans = useStore((s) => s.rescuePlans);
  const tasks = useStore((s) => s.tasks);
  const visible = plans.filter((p) => p.status !== "rejected");
  if (visible.length === 0) return null;

  return (
    <div className="space-y-3">
      {visible.map((plan) => {
        const task = tasks.find((t) => t.id === plan.taskId);
        if (!task) return null;
        const pending = plan.status === "pending";
        return (
          <div
            key={plan.id}
            className={`rounded-2xl border p-4 ${
              pending ? "border-primary/40 bg-primary/5" : "border-border bg-card"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-primary">
                  {pending ? "Pending approval" : "Active rescue"}
                </div>
                <div className="mt-0.5 font-semibold">{task.title}</div>
                <p className="mt-1 text-sm text-muted-foreground">{plan.rationale}</p>
              </div>
              {pending ? (
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => actions.rejectRescuePlan(plan.id)}
                  >
                    <X className="mr-1 h-3.5 w-3.5" /> Reject
                  </Button>
                  <Button size="sm" onClick={() => actions.approveRescuePlan(plan.id)}>
                    <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Approve & schedule
                  </Button>
                </div>
              ) : null}
            </div>
            <ol className="mt-3 space-y-2">
              {plan.steps.map((step, i) => (
                <li
                  key={step.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-background/60 px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                      {i + 1}
                    </span>
                    <div>
                      <div className={step.done ? "line-through text-muted-foreground" : ""}>
                        {step.title}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {fmtTime(step.startAt)} · {step.durationMin}m
                      </div>
                    </div>
                  </div>
                  {plan.status === "approved" ? (
                    <Button
                      size="sm"
                      variant={step.done ? "secondary" : "ghost"}
                      onClick={() => actions.toggleStepDone(plan.id, step.id)}
                    >
                      {step.done ? "Done" : "Mark done"}
                    </Button>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
        );
      })}
    </div>
  );
}
