import { createFileRoute } from "@tanstack/react-router";
import { streamHrAssistant, type ChatMessage } from "@/lib/ai.server";

export const Route = createFileRoute("/api/assistant")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { messages?: unknown[] };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const messages: ChatMessage[] = [];
        for (const m of body.messages ?? []) {
          if (!m || typeof m !== "object") continue;
          const msg = m as { role?: unknown; content?: unknown };
          const role = msg.role;
          const content = typeof msg.content === "string" ? msg.content : "";
          if ((role === "user" || role === "assistant") && content.trim()) {
            messages.push({ role, content: content.trim() });
          }
        }

        const trimmed = messages.slice(-20);
        try {
          return await streamHrAssistant(request, trimmed);
        } catch (err) {
          console.error("[API Assistant Error]", err);
          return new Response((err as Error)?.message || "Assistant request failed", {
            status: 500,
          });
        }
      },
    },
  },
});
