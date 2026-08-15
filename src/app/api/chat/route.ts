import {
  convertToModelMessages,
  streamText,
  type UIMessage,
} from "ai";
import { resolveModel } from "@/lib/models";
import { modeInstruction, SYSTEM_PROMPT, type PracticeMode } from "@/lib/prompt";

export const maxDuration = 60;

export async function POST(req: Request) {
  if (!process.env.OPENROUTER_API_KEY) {
    return Response.json(
      { error: "OPENROUTER_API_KEY is missing. Add it to .env.local" },
      { status: 500 },
    );
  }

  const body = (await req.json()) as {
    messages: UIMessage[];
    model?: string;
    mode?: PracticeMode;
  };

  const mode: PracticeMode = body.mode ?? "interview";

  const result = streamText({
    model: resolveModel(body.model),
    system: `${SYSTEM_PROMPT}\n\n${modeInstruction(mode)}`,
    messages: await convertToModelMessages(body.messages),
    temperature: 0.7,
  });

  return result.toUIMessageStreamResponse();
}
