import { getAiConfigurationError, getChatModel } from "@/lib/ai.server";
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

type ChatRequestBody = { messages?: unknown; context?: unknown };

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { messages, context } = (await request.json()) as ChatRequestBody;
        if (!Array.isArray(messages)) {
          return new Response("Messages are required", { status: 400 });
        }

        const configError = getAiConfigurationError();
        if (configError) {
          return new Response(configError, { status: 500 });
        }

        const system = `You are Pulse, an AI productivity coach. You see the user's full state and help them triage, plan, and rescue deadlines.

Be concise, decisive, and action-oriented. When the user is overwhelmed, recommend the single next best task. When asked about a deadline, propose a concrete step-by-step rescue plan with time estimates. Use short bullet points. Reference task titles directly.

USER STATE (JSON):
${JSON.stringify(context ?? {}, null, 2)}`;

        try {
          const result = streamText({
            model: getChatModel(),
            system,
            messages: await convertToModelMessages(messages as UIMessage[]),
          });

          return result.toUIMessageStreamResponse({
            originalMessages: messages as UIMessage[],
            onError: (error) => {
              console.error("[api/chat]", error);
              if (error instanceof Error) return error.message;
              return "AI request failed";
            },
          });
        } catch (error) {
          console.error("[api/chat]", error);
          const message = error instanceof Error ? error.message : "AI request failed";
          return new Response(message, { status: 500 });
        }
      },
    },
  },
});
