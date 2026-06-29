import { useSyncExternalStore } from "react";

export type Priority = 1 | 2 | 3 | 4; // 1 = highest

export type Task = {
  id: string;
  title: string;
  notes?: string;
  priority: Priority;
  deadline: string | null; // ISO
  done: boolean;
  createdAt: string;
};

export type Habit = {
  id: string;
  title: string;
  completedDates: string[]; // YYYY-MM-DD
};

export type Goal = {
  id: string;
  title: string;
  target: number;
  progress: number;
  deadline: string | null;
};

export type RescueStep = {
  id: string;
  title: string;
  startAt: string; // ISO
  durationMin: number;
  done: boolean;
  firedStart?: boolean;
};

export type RescuePlan = {
  id: string;
  taskId: string;
  rationale: string;
  steps: RescueStep[];
  status: "pending" | "approved" | "rejected";
  createdAt: string;
};

export type Prefs = {
  notifyStepStart: boolean;
  notifyRiskCleared: boolean;
  atRiskHours: number; // window (in hours) before deadline that flags a task as at-risk
  rescueLeadMin: number; // minutes of buffer before deadline reserved at the end of a rescue plan
  autoCorrectPrefs: boolean; // when true, invalid pref values are clamped on save; when false, raw values are kept and only a warning is shown
};

export const PREFS_DEFAULTS: Prefs = {
  notifyStepStart: true,
  notifyRiskCleared: true,
  atRiskHours: 24,
  rescueLeadMin: 30,
  autoCorrectPrefs: true,
};

export const PREFS_LIMITS = {
  atRiskHours: { min: 1, max: 96 },
  rescueLeadMin: { min: 0, max: 240 },
} as const;

function clamp(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/**
 * Normalize prefs so invariants hold:
 * - numeric fields clamped to allowed ranges
 * - rescue lead time cannot exceed the at-risk window (otherwise every new
 *   plan would already be outside the rescue horizon before it starts)
 */
export function validatePrefs(p: Prefs): Prefs {
  const atRiskHours = clamp(
    p.atRiskHours,
    PREFS_LIMITS.atRiskHours.min,
    PREFS_LIMITS.atRiskHours.max,
  );
  const maxLead = Math.min(PREFS_LIMITS.rescueLeadMin.max, atRiskHours * 60);
  const rescueLeadMin = clamp(p.rescueLeadMin, PREFS_LIMITS.rescueLeadMin.min, maxLead);
  return { ...p, atRiskHours, rescueLeadMin };
}

export function prefsIssues(p: Prefs): string[] {
  const issues: string[] = [];
  if (p.rescueLeadMin > p.atRiskHours * 60) {
    issues.push(
      `Rescue lead time (${p.rescueLeadMin}m) is larger than the at-risk window (${p.atRiskHours}h = ${p.atRiskHours * 60}m). Plans would have no time to run.`,
    );
  }
  return issues;
}

export type State = {
  tasks: Task[];
  habits: Habit[];
  goals: Goal[];
  rescuePlans: RescuePlan[];
  prefs: Prefs;
  lastAtRiskIds: string[];
};

const KEY = "pulse.state.v1";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function todayISO() {
  return new Date().toISOString();
}

function seed(): State {
  const now = new Date();
  const add = (h: number) => new Date(now.getTime() + h * 3600_000).toISOString();
  return {
    tasks: [
      {
        id: uid(),
        title: "Submit project proposal",
        priority: 1,
        deadline: add(5),
        done: false,
        createdAt: todayISO(),
        notes: "Final draft + send to advisor",
      },
      {
        id: uid(),
        title: "Pay electricity bill",
        priority: 2,
        deadline: add(20),
        done: false,
        createdAt: todayISO(),
      },
      {
        id: uid(),
        title: "Prep interview answers",
        priority: 1,
        deadline: add(40),
        done: false,
        createdAt: todayISO(),
      },
      {
        id: uid(),
        title: "Reply to client email",
        priority: 3,
        deadline: add(2),
        done: false,
        createdAt: todayISO(),
      },
      {
        id: uid(),
        title: "Read research paper",
        priority: 4,
        deadline: null,
        done: false,
        createdAt: todayISO(),
      },
    ],
    habits: [
      { id: uid(), title: "Deep work 90m", completedDates: [] },
      { id: uid(), title: "Exercise", completedDates: [] },
      { id: uid(), title: "Read 20 pages", completedDates: [] },
    ],
    goals: [
      { id: uid(), title: "Ship MVP", target: 10, progress: 4, deadline: add(24 * 21) },
      { id: uid(), title: "Run 50km this month", target: 50, progress: 18, deadline: add(24 * 14) },
    ],
    rescuePlans: [],
    prefs: { ...PREFS_DEFAULTS },
    lastAtRiskIds: [],
  };
}

let state: State = load();
const listeners = new Set<() => void>();

function load(): State {
  if (typeof window === "undefined") return seed();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) {
      const s = seed();
      window.localStorage.setItem(KEY, JSON.stringify(s));
      return s;
    }
    const parsed = JSON.parse(raw) as State;
    // backfill any new pref keys added after the user's state was saved
    parsed.prefs = { ...PREFS_DEFAULTS, ...(parsed.prefs ?? {}) };
    return parsed;
  } catch {
    return seed();
  }
}

function save() {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  }
  listeners.forEach((l) => l());
}

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function getState() {
  return state;
}

export function setState(updater: (s: State) => State) {
  state = updater(state);
  save();
}

export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(state),
  );
}

// ---------- helpers ----------
export const PRIORITY_LABEL: Record<Priority, string> = {
  1: "P1 · Critical",
  2: "P2 · High",
  3: "P3 · Medium",
  4: "P4 · Low",
};

export function hoursUntil(iso: string | null): number {
  if (!iso) return Infinity;
  return (new Date(iso).getTime() - Date.now()) / 3600_000;
}

export function isOverdue(t: Task) {
  return !t.done && t.deadline !== null && hoursUntil(t.deadline) < 0;
}

/**
 * Prefs as the scheduler should read them: raw inputs when warn-only mode is
 * on, clamped/validated values when auto-correct is on. The store may hold
 * out-of-range numbers in warn-only mode, so callers must go through this
 * helper rather than reading state.prefs directly for scheduling math.
 */
export function effectivePrefs(p: Prefs = state.prefs): Prefs {
  return p.autoCorrectPrefs ? validatePrefs(p) : p;
}

export function isAtRisk(t: Task) {
  if (t.done || !t.deadline) return false;
  const h = hoursUntil(t.deadline);
  return h >= 0 && h <= effectivePrefs().atRiskHours;
}

export function priorityScore(t: Task) {
  const h = hoursUntil(t.deadline);
  const urgency = h === Infinity ? 0 : Math.max(0, 200 - h * 2);
  const prio = (5 - t.priority) * 30;
  return urgency + prio + (isOverdue(t) ? 500 : 0);
}

export function rankedTasks(tasks: Task[]) {
  return [...tasks].filter((t) => !t.done).sort((a, b) => priorityScore(b) - priorityScore(a));
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

// ---------- actions ----------
export const actions = {
  addTask(input: Partial<Task> & { title: string }) {
    setState((s) => ({
      ...s,
      tasks: [
        ...s.tasks,
        {
          id: uid(),
          title: input.title,
          notes: input.notes,
          priority: input.priority ?? 3,
          deadline: input.deadline ?? null,
          done: false,
          createdAt: todayISO(),
        },
      ],
    }));
  },
  updateTask(id: string, patch: Partial<Task>) {
    setState((s) => ({
      ...s,
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));
  },
  deleteTask(id: string) {
    setState((s) => ({
      ...s,
      tasks: s.tasks.filter((t) => t.id !== id),
      rescuePlans: s.rescuePlans.filter((p) => p.taskId !== id),
    }));
  },
  toggleHabit(habitId: string, date: string) {
    setState((s) => ({
      ...s,
      habits: s.habits.map((h) =>
        h.id !== habitId
          ? h
          : {
              ...h,
              completedDates: h.completedDates.includes(date)
                ? h.completedDates.filter((d) => d !== date)
                : [...h.completedDates, date],
            },
      ),
    }));
  },
  addHabit(title: string) {
    setState((s) => ({ ...s, habits: [...s.habits, { id: uid(), title, completedDates: [] }] }));
  },
  deleteHabit(id: string) {
    setState((s) => ({ ...s, habits: s.habits.filter((h) => h.id !== id) }));
  },
  addGoal(g: Omit<Goal, "id">) {
    setState((s) => ({ ...s, goals: [...s.goals, { ...g, id: uid() }] }));
  },
  updateGoal(id: string, patch: Partial<Goal>) {
    setState((s) => ({
      ...s,
      goals: s.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)),
    }));
  },
  deleteGoal(id: string) {
    setState((s) => ({ ...s, goals: s.goals.filter((g) => g.id !== id) }));
  },
  createRescuePlan(plan: Omit<RescuePlan, "id" | "createdAt" | "status">) {
    const id = uid();
    setState((s) => ({
      ...s,
      rescuePlans: [
        ...s.rescuePlans.filter((p) => p.taskId !== plan.taskId || p.status === "approved"),
        { ...plan, id, status: "pending", createdAt: todayISO() },
      ],
    }));
    return id;
  },
  approveRescuePlan(id: string) {
    setState((s) => ({
      ...s,
      rescuePlans: s.rescuePlans.map((p) => (p.id === id ? { ...p, status: "approved" } : p)),
    }));
  },
  rejectRescuePlan(id: string) {
    setState((s) => ({
      ...s,
      rescuePlans: s.rescuePlans.map((p) => (p.id === id ? { ...p, status: "rejected" } : p)),
    }));
  },
  markStepFired(planId: string, stepId: string) {
    setState((s) => ({
      ...s,
      rescuePlans: s.rescuePlans.map((p) =>
        p.id !== planId
          ? p
          : {
              ...p,
              steps: p.steps.map((st) => (st.id === stepId ? { ...st, firedStart: true } : st)),
            },
      ),
    }));
  },
  toggleStepDone(planId: string, stepId: string) {
    setState((s) => ({
      ...s,
      rescuePlans: s.rescuePlans.map((p) =>
        p.id !== planId
          ? p
          : {
              ...p,
              steps: p.steps.map((st) => (st.id === stepId ? { ...st, done: !st.done } : st)),
            },
      ),
    }));
  },
  setPrefs(patch: Partial<Prefs>) {
    setState((s) => {
      const merged = { ...s.prefs, ...patch };
      // Always normalize the mode flag and notification booleans; only clamp
      // numeric ranges when auto-correct is enabled. Otherwise keep the user's
      // raw values so prefsIssues() can surface a warning instead.
      const next = merged.autoCorrectPrefs ? validatePrefs(merged) : merged;
      return { ...s, prefs: next };
    });
  },
  setLastAtRiskIds(ids: string[]) {
    setState((s) => ({ ...s, lastAtRiskIds: ids }));
  },
};

export function makeRescueSteps(task: Task, count = 4): RescueStep[] {
  const now = Date.now();
  const deadline = task.deadline ? new Date(task.deadline).getTime() : now + 24 * 3600_000;
  const leadMs = Math.max(0, effectivePrefs().rescueLeadMin) * 60_000;
  const totalMs = Math.max(deadline - now - leadMs, count * 15 * 60_000);
  const stepMs = totalMs / count;
  const templates = [
    "Outline & gather materials",
    "Draft core content",
    "Refine and review",
    "Final polish & submit",
  ];
  return Array.from({ length: count }).map((_, i) => ({
    id: uid(),
    title: templates[i] ?? `Step ${i + 1}`,
    startAt: new Date(now + stepMs * i).toISOString(),
    durationMin: Math.max(15, Math.round((stepMs / 60_000) * 0.8)),
    done: false,
  }));
}
