import { generateText, type UIMessage } from "ai";
import { resolveModel } from "@/lib/models";
import { LEARNER_PROFILE, modeInstruction, type PracticeMode } from "@/lib/prompt";

export const maxDuration = 60;

type AssistBody = {
  task: "suggest" | "explain";
  messages?: UIMessage[];
  selectedText?: string;
  context?: string;
  model?: string;
  mode?: PracticeMode;
};

function uiMessageText(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

export async function POST(req: Request) {
  if (!process.env.OPENROUTER_API_KEY) {
    return Response.json(
      { error: "OPENROUTER_API_KEY is missing. Add it to .env.local" },
      { status: 500 },
    );
  }

  const body = (await req.json()) as AssistBody;

  if (body.task === "explain") {
    const selectedText = body.selectedText?.trim().slice(0, 160);
    if (!selectedText) {
      return Response.json({ error: "Select a word or phrase first" }, { status: 400 });
    }

    const result = await generateText({
      model: resolveModel(body.model),
      system:
        "You explain English vocabulary to a Russian-speaking learner. Be concise. Return: Russian translation; simple English meaning; one short example. No markdown heading.",
      prompt: `Explain "${selectedText}" in this context:\n${(body.context ?? "").slice(0, 800)}`,
    });

    return Response.json({ text: result.text.trim() });
  }

  const messages = body.messages ?? [];
  if (!messages.some((message) => message.role === "assistant")) {
    return Response.json(
      { error: "The interviewer needs to ask a question first" },
      { status: 400 },
    );
  }

  const result = await generateText({
    model: resolveModel(body.model),
    system: `You are a ghostwriter for Nikita, the job candidate. You never act as the interviewer or tutor.
Return only Nikita's next spoken answer in natural B1-B2 English, with no label, question, notes, quotation marks or correction block.
Directly answer the interviewer's latest question in 2-5 sentences. Use only verified facts. Never invent anything.

${LEARNER_PROFILE}`,
    prompt: `Practice mode: ${modeInstruction(body.mode ?? "interview")}

Conversation transcript:
${messages
  .map((message) => `${message.role === "assistant" ? "Interviewer" : "Nikita"}: ${uiMessageText(message)}`)
  .join("\n")}

Write Nikita's answer now.
Nikita's answer:`,
  });

  return Response.json({ text: result.text.trim() });
}
