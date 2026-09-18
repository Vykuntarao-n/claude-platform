import Anthropic from "@anthropic-ai/sdk";
import { anthropic, CHAT_MODEL, SUPPORT_SYSTEM_PROMPT } from "@/lib/anthropic";

export const runtime = "nodejs";

const MAX_MESSAGES = 40;
const MAX_MESSAGE_LENGTH = 4000;

type IncomingMessage = { role: "user" | "assistant"; content: string };

function isValidHistory(value: unknown): value is IncomingMessage[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_MESSAGES) {
    return false;
  }
  return value.every(
    (m) =>
      m &&
      typeof m === "object" &&
      (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string" &&
      m.content.length > 0 &&
      m.content.length <= MAX_MESSAGE_LENGTH,
  );
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const messages = (body as { messages?: unknown })?.messages;
  if (!isValidHistory(messages)) {
    return new Response(
      "Expected { messages: { role: 'user' | 'assistant', content: string }[] }",
      { status: 400 },
    );
  }
  if (messages[messages.length - 1].role !== "user") {
    return new Response("The last message must be from the user", { status: 400 });
  }

  const anthropicMessages: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const messageStream = anthropic.messages.stream({
          model: CHAT_MODEL,
          max_tokens: 4096,
          system: SUPPORT_SYSTEM_PROMPT,
          messages: anthropicMessages,
        });

        messageStream.on("text", (delta) => {
          controller.enqueue(encoder.encode(delta));
        });

        const finalMessage = await messageStream.finalMessage();

        if (finalMessage.stop_reason === "refusal") {
          controller.enqueue(
            encoder.encode(
              "\n\nI'm not able to help with that. Let me connect you with a human agent instead.",
            ),
          );
        }
      } catch (error) {
        console.error("Chat stream error:", error);
        const message =
          error instanceof Anthropic.APIError
            ? `Sorry, something went wrong talking to the assistant (${error.status ?? "error"}).`
            : "Sorry, something went wrong. Please try again.";
        controller.enqueue(encoder.encode(message));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
