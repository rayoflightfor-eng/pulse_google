import { useEffect, useRef } from "react";
import { actions, getState, isAtRisk, subscribe } from "@/lib/store";
import { sendNotification } from "@/lib/notifications";

// Polls every 20s. Fires:
// 1) Step-start alerts when an approved rescue step's startAt is within the
//    last 60s and hasn't been fired.
// 2) Risk-cleared alerts when a task that was previously at-risk is no longer.
export function NotificationManager() {
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const tick = () => {
      const s = getState();
      const now = Date.now();

      if (s.prefs.notifyStepStart) {
        for (const plan of s.rescuePlans) {
          if (plan.status !== "approved") continue;
          for (const step of plan.steps) {
            if (step.firedStart || step.done) continue;
            const startMs = new Date(step.startAt).getTime();
            const delta = startMs - now;
            if (delta <= 0 && delta > -10 * 60_000) {
              const task = s.tasks.find((t) => t.id === plan.taskId);
              sendNotification(
                `Rescue step starting: ${step.title}`,
                task ? `For: ${task.title}` : undefined,
                `step-${step.id}`,
              );
              actions.markStepFired(plan.id, step.id);
            }
          }
        }
      }

      const currentAtRisk = new Set(s.tasks.filter(isAtRisk).map((t) => t.id));
      const previously = new Set(s.lastAtRiskIds);
      if (s.prefs.notifyRiskCleared) {
        for (const id of previously) {
          if (!currentAtRisk.has(id)) {
            const t = s.tasks.find((t) => t.id === id);
            if (t) {
              sendNotification(
                "Task no longer at risk",
                `${t.title} cleared the 24h danger zone.`,
                `risk-${id}`,
              );
            }
          }
        }
      }
      const nextIds = [...currentAtRisk];
      if (nextIds.length !== s.lastAtRiskIds.length || nextIds.some((id) => !previously.has(id))) {
        actions.setLastAtRiskIds(nextIds);
      }
    };

    const id = setInterval(tick, 20_000);
    // initial pass to seed lastAtRiskIds without firing if empty
    if (getState().lastAtRiskIds.length === 0) {
      const ids = getState()
        .tasks.filter(isAtRisk)
        .map((t) => t.id);
      actions.setLastAtRiskIds(ids);
    }
    tick();
    const unsub = subscribe(() => {
      // no-op; tick runs on interval
    });
    return () => {
      clearInterval(id);
      unsub();
    };
  }, []);

  return null;
}
