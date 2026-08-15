"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FREE_MODELS } from "@/lib/models";
import type { PracticeMode } from "@/lib/prompt";

type SelectedPhrase = {
  messageId: string;
  text: string;
  context: string;
};

type SpeechRecognitionResultLike = {
  0: { transcript: string };
  isFinal: boolean;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike> & {
    length: number;
  };
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function messageText(message: {
  parts?: Array<{ type: string; text?: string }>;
  content?: string;
}): string {
  if (message.parts?.length) {
    return message.parts
      .filter((p) => p.type === "text" && p.text)
      .map((p) => p.text!)
      .join("");
  }
  return typeof message.content === "string" ? message.content : "";
}

export function VoiceChat() {
  const [model, setModel] = useState<string>(FREE_MODELS[0].id);
  const [mode, setMode] = useState<PracticeMode>("interview");
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [voiceOn, setVoiceOn] = useState(true);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assisting, setAssisting] = useState<"suggest" | "explain" | null>(null);
  const [selectedPhrase, setSelectedPhrase] = useState<SelectedPhrase | null>(null);
  const [explanation, setExplanation] = useState("");

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const listeningRef = useRef(false);
  const lastSpokenId = useRef<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { model, mode },
      }),
    [model, mode],
  );

  const { messages, sendMessage, status, setMessages, error: chatError } =
    useChat({ transport });

  const busy = status === "submitted" || status === "streaming";
  const locked = busy || assisting !== null;

  useEffect(() => {
    setSpeechSupported(Boolean(getSpeechRecognition()));
  }, []);

  useEffect(() => {
    scrollerRef.current?.scrollTo({
      top: scrollerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, interim]);

  const speak = useCallback(
    (text: string) => {
      if (!voiceOn || typeof window === "undefined" || !window.speechSynthesis)
        return;
      const clean = text
        .replace(/\*\*/g, "")
        .replace(/^Correction:[\s\S]*$/gim, (block) => block.slice(0, 180))
        .trim();
      if (!clean) return;
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(clean);
      utter.lang = "en-US";
      utter.rate = 0.95;
      const voices = window.speechSynthesis.getVoices();
      const en =
        voices.find((v) => v.lang.startsWith("en") && /female|samantha|google/i.test(v.name)) ??
        voices.find((v) => v.lang.startsWith("en"));
      if (en) utter.voice = en;
      window.speechSynthesis.speak(utter);
    },
    [voiceOn],
  );

  useEffect(() => {
    const last = [...messages].reverse().find((m) => m.role === "assistant");
    if (!last || busy) return;
    const text = messageText(last);
    if (!text || last.id === lastSpokenId.current) return;
    lastSpokenId.current = last.id;
    speak(text);
  }, [messages, busy, speak]);

  const submitText = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;
      setError(null);
      setInput("");
      setInterim("");
      try {
        await sendMessage({ text: trimmed });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to send");
      }
    },
    [busy, sendMessage],
  );

  const stopListening = useCallback(() => {
    listeningRef.current = false;
    setListening(false);
    recognitionRef.current?.stop();
  }, []);

  const startListening = useCallback(() => {
    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      setSpeechSupported(false);
      setError("Голос не поддерживается в этом браузере. Используй Chrome.");
      return;
    }

    window.speechSynthesis?.cancel();
    recognitionRef.current?.abort();

    const recognition = new Ctor();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognitionRef.current = recognition;
    listeningRef.current = true;
    setListening(true);
    setInterim("");
    setError(null);

    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else interimText += result[0].transcript;
      }
      if (interimText) setInterim(interimText);
      if (finalText) {
        setInterim("");
        void submitText(finalText);
      }
    };

    recognition.onerror = (event) => {
      if (event.error !== "aborted" && event.error !== "no-speech") {
        setError(`Микрофон: ${event.error}`);
      }
      listeningRef.current = false;
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
      listeningRef.current = false;
    };

    try {
      recognition.start();
    } catch {
      setError("Не удалось запустить микрофон");
      setListening(false);
    }
  }, [submitText]);

  const toggleMic = () => {
    if (listening) stopListening();
    else startListening();
  };

  const reset = () => {
    stopListening();
    window.speechSynthesis?.cancel();
    setMessages([]);
    lastSpokenId.current = null;
    setInput("");
    setInterim("");
    setError(null);
    setSelectedPhrase(null);
    setExplanation("");
  };

  const selectPhrase = (
    messageId: string,
    context: string,
    container: HTMLElement,
  ) => {
    const selection = window.getSelection();
    const text = selection?.toString().trim() ?? "";
    if (!text || text.length > 160 || !selection?.anchorNode) return;
    if (!container.contains(selection.anchorNode)) return;
    setSelectedPhrase({ messageId, text, context });
    setExplanation("");
  };

  const explainSelection = async () => {
    if (!selectedPhrase || locked) return;
    setAssisting("explain");
    setError(null);
    try {
      const response = await fetch("/api/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: "explain",
          selectedText: selectedPhrase.text,
          context: selectedPhrase.context,
          model,
          mode,
        }),
      });
      const data = (await response.json()) as { text?: string; error?: string };
      if (!response.ok || !data.text) throw new Error(data.error || "Не удалось объяснить слово");
      setExplanation(data.text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось объяснить слово");
    } finally {
      setAssisting(null);
    }
  };

  const suggestAndSend = async () => {
    if (locked) return;
    setAssisting("suggest");
    setError(null);
    try {
      const response = await fetch("/api/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: "suggest", messages, model, mode }),
      });
      const data = (await response.json()) as { text?: string; error?: string };
      if (!response.ok || !data.text) throw new Error(data.error || "Не удалось придумать ответ");
      await sendMessage({ text: data.text });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось придумать ответ");
    } finally {
      setAssisting(null);
    }
  };

  const canSuggest = messages.some((message) => message.role === "assistant");

  return (
    <div className="voice-shell">
      <header className="topbar">
        <div className="brand-block">
          <p className="brand">SpeakUp</p>
          <p className="tagline">Голосовой тренажёр английского к собеседованию</p>
        </div>
        <div className="controls">
          <label className="field">
            <span>Режим</span>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as PracticeMode)}
              disabled={locked}
            >
              <option value="interview">Собеседование</option>
              <option value="daily">Разговор</option>
              <option value="correction">Коррекции</option>
            </select>
          </label>
          <label className="field">
            <span>Модель</span>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled
              title="Приложение использует только бесплатный маршрутизатор OpenRouter"
            >
              {FREE_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className={`chip ${voiceOn ? "on" : ""}`}
            onClick={() => {
              setVoiceOn((v) => !v);
              if (voiceOn) window.speechSynthesis?.cancel();
            }}
          >
            {voiceOn ? "Голос ИИ: вкл" : "Голос ИИ: выкл"}
          </button>
          <button type="button" className="chip" onClick={reset}>
            Сброс
          </button>
        </div>
      </header>

      <main className="stage">
        <div className="transcript" ref={scrollerRef}>
          {messages.length === 0 && !interim && (
            <div className="empty">
              <h1>Говори по-английски. ИИ поправит и продолжит диалог.</h1>
              <p>
                Нажми микрофон и ответь на вопрос интервьюера. Ответы озвучиваются
                бесплатно через браузер; модели — через OpenRouter free.
              </p>
            </div>
          )}

          {messages.map((m) => {
            const text = messageText(m);
            if (!text) return null;
            return (
              <article
                key={m.id}
                className={`bubble ${m.role === "user" ? "user" : "ai"}`}
                onMouseUp={(event) => selectPhrase(m.id, text, event.currentTarget)}
                onTouchEnd={(event) => selectPhrase(m.id, text, event.currentTarget)}
              >
                <span className="who">
                  {m.role === "user" ? "You" : "Tutor"}
                </span>
                <p>{text}</p>
                {selectedPhrase?.messageId === m.id && (
                  <div className="word-card">
                    <div className="word-card-head">
                      <strong>{selectedPhrase.text}</strong>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPhrase(null);
                          setExplanation("");
                          window.getSelection()?.removeAllRanges();
                        }}
                        aria-label="Закрыть объяснение"
                      >
                        ×
                      </button>
                    </div>
                    {explanation ? (
                      <p>{explanation}</p>
                    ) : (
                      <button
                        type="button"
                        className="explain-button"
                        onClick={() => void explainSelection()}
                        disabled={locked}
                      >
                        {assisting === "explain" ? "Объясняю…" : "Перевести и объяснить"}
                      </button>
                    )}
                  </div>
                )}
              </article>
            );
          })}

          {interim && (
            <article className="bubble user interim">
              <span className="who">You</span>
              <p>{interim}…</p>
            </article>
          )}

          {busy && (
            <article className="bubble ai thinking">
              <span className="who">Tutor</span>
              <p>Thinking…</p>
            </article>
          )}
        </div>

        <div className="composer">
          {(error || chatError) && (
            <p className="err">{error || chatError?.message}</p>
          )}
          {!speechSupported && (
            <p className="hint">
              Для голоса открой Chrome/Edge. Пока можно писать текстом.
            </p>
          )}

          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              void submitText(input);
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Или набери ответ по-английски…"
              disabled={locked}
              aria-label="Message"
            />
            <button type="submit" className="send" disabled={locked || !input.trim()}>
              Send
            </button>
            <button
              type="button"
              className={`mic ${listening ? "live" : ""}`}
              onClick={toggleMic}
              disabled={locked}
              aria-pressed={listening}
              aria-label={listening ? "Stop microphone" : "Start microphone"}
            >
              <span className="mic-ring" />
              <span className="mic-dot" />
            </button>
          </form>
          <button
            type="button"
            className="suggest"
            onClick={() => void suggestAndSend()}
            disabled={locked || !canSuggest}
          >
            {assisting === "suggest" ? "ИИ готовит ответ…" : "Ответить за меня с помощью ИИ"}
          </button>
          <p className="status-line">
            {listening
              ? "Слушаю… говори на английском"
              : busy
                ? "ИИ отвечает…"
                : assisting === "suggest"
                  ? "Подбираю лучший ответ…"
                : "Готов к разговору"}
          </p>
        </div>
      </main>
    </div>
  );
}
