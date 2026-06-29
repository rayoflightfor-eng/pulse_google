import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { actions, PRIORITY_LABEL, type Priority, type Task } from "@/lib/store";

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const tz = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
}

export function TaskEditor({ task, onClose }: { task?: Task; onClose?: () => void }) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [notes, setNotes] = useState(task?.notes ?? "");
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 3);
  const [deadline, setDeadline] = useState(toLocalInput(task?.deadline ?? null));

  function submit() {
    if (!title.trim()) return;
    const iso = deadline ? new Date(deadline).toISOString() : null;
    if (task) {
      actions.updateTask(task.id, { title: title.trim(), notes, priority, deadline: iso });
    } else {
      actions.addTask({ title: title.trim(), notes, priority, deadline: iso });
    }
    onClose?.();
  }

  return (
    <div className="space-y-3">
      <Input
        placeholder="Task title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
      />
      <Textarea
        placeholder="Notes (optional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={3}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Priority</label>
          <Select
            value={String(priority)}
            onValueChange={(v) => setPriority(Number(v) as Priority)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {([1, 2, 3, 4] as const).map((k) => (
                <SelectItem key={k} value={String(k)}>
                  {PRIORITY_LABEL[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Deadline</label>
          <Input
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        {onClose ? (
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        ) : null}
        <Button onClick={submit}>{task ? "Save" : "Add task"}</Button>
      </div>
    </div>
  );
}
