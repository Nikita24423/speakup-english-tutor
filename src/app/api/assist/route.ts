import { convertToModelMessages, generateText, type UIMessage } from "ai";
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
    system: `You write the learner's next answer in a practice conversation.
Write only the answer the learner should say, in natural spoken English.
Answer the interviewer's latest question directly, using only the verified profile and facts already present in the conversation.
If a personal detail is unknown, say so briefly or keep the answer general. Never invent facts.
Target B1-B2 English and 2-5 sentences. Do not add labels, notes, quotation marks, or corrections.
${LEARNER_PROFILE}
${modeInstruction(body.mode ?? "interview")}`,
    messages: await convertToModelMessages(messages),
  });

  return Response.json({ text: result.text.trim() });
}
