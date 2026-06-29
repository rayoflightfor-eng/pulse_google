import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Loader2, Send, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getState, useStore } from "@/lib/store";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/coach")({
  head: () => ({
    meta: [
      { title: "AI Coach — Pulse" },
      {
        name: "description",
        content: "Chat with Pulse: triage tasks, plan, and rescue deadlines.",
      },
    ],
  }),
  component: CoachPage,
});

function CoachPage() {
  const tasks = useStore((s) => s.tasks);
  const goals = useStore((s) => s.goals);
  const habits = useStore((s) => s.habits);

  const transport = useRef(
    new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: ({ messages }) => ({
        body: {
          messages,
          context: {
            now: new Date().toISOString(),
            tasks: getState().tasks,
            goals: getState().goals,
            habits: getState().habits.map((h) => ({
              title: h.title,
              recent: h.completedDates.slice(-7),
            })),
            rescuePlans: getState().rescuePlans,
          },
        },
      }),
    }),
  ).current;

  const { messages, sendMessage, status } = useChat({
    transport,
    onError: (e) => toast.error(e.message || "Coach failed"),
  });

  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  const busy = status === "submitted" || status === "streaming";

  async function submit() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    await sendMessage({ text });
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  const suggestions = [
    "What should I work on right now?",
    "Help me rescue my most at-risk deadline.",
    "Plan a focused 2-hour block based on my tasks.",
    `I only have 30 minutes — what's the highest leverage thing?`,
  ];

  return (
    <div className="mx-auto flex h-[calc(100vh-10rem)] max-w-4xl flex-col">
      <header className="mb-4">
        <h1 className="text-3xl font-semibold tracking-tight">AI Coach</h1>
        <p className="text-sm text-muted-foreground">
          Sees your {tasks.length} tasks, {goals.length} goals, and {habits.length} habits.
        </p>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto rounded-2xl border border-border bg-card p-4"
      >
        {messages.length === 0 ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4 text-primary" /> Try asking:
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setInput(s);
                    requestAnimationFrame(() => inputRef.current?.focus());
                  }}
                  className="rounded-xl border border-border bg-background px-3 py-2 text-left text-sm hover:bg-accent"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {messages.map((m) => {
          const text = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
          const mine = m.role === "user";
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                  mine ? "bg-primary text-primary-foreground" : "bg-background border border-border"
                }`}
              >
                {mine ? (
                  <div className="whitespace-pre-wrap">{text}</div>
                ) : (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown>{text || "…"}</ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {status === "submitted" ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex gap-2">
        <Textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Ask anything — Pulse can see your state."
          rows={2}
          className="resize-none"
        />
        <Button onClick={submit} disabled={busy || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
