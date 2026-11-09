import type { ChatMessage, ChatReview } from "./chat-import";

// Each AI request carries a bounded, chronological excerpt.
// A long message is split rather than silently omitted.
export const MAX_SEGMENT_CHARS = 60_000;
export const MAX_SEGMENT_MESSAGES = 800;
export const MAX_SEGMENTS = 90;

export interface ChatSegment {
  index: number;
  startAt: string;
  endAt: string;
  messages: ChatMessage[];
}
export interface ChatSegmentFinding {
  index: number;
  startAt: string;
  endAt: string;
  review: ChatReview;
}

export function splitChatMessages(
  messages: ChatMessage[],
  maxChars = MAX_SEGMENT_CHARS,
  maxMessages = MAX_SEGMENT_MESSAGES,
): ChatSegment[] {
  if (maxChars < 1000 || maxMessages < 1)
    throw new Error("Limites de análise inválidos.");
  const segments: ChatSegment[] = [];
  let batch: ChatMessage[] = [];
  let characters = 0;
  const push = () => {
    if (!batch.length) return;
    segments.push({
      index: segments.length + 1,
      startAt: batch[0].at,
      endAt: batch[batch.length - 1].at,
      messages: batch,
    });
    batch = [];
    characters = 0;
  };
  for (const message of messages) {
    const parts: string[] = [];
    // O backend limita cada texto individual a 20 mil caracteres.
    const partSize = Math.min(maxChars - 400, 18_000);
    if (!message.text.length) parts.push("");
    else for (let at = 0; at < message.text.length; at += partSize)
      parts.push(message.text.slice(at, at + partSize));
    for (const part of parts) {
      const size = part.length + message.sender.length + message.at.length + 40;
      if (batch.length && (characters + size > maxChars || batch.length >= maxMessages))
        push();
      batch.push({ at: message.at, sender: message.sender, text: part });
      characters += size;
    }
  }
  push();
  return segments;
}

export function validateSegmentReviews(
  segments: ChatSegment[],
  findings: ChatSegmentFinding[],
) {
  if (!segments.length || segments.length !== findings.length)
    throw new Error("A análise não cobriu todos os segmentos.");
  const ordered = [...findings].sort((a, b) => a.index - b.index);
  for (let i = 0; i < segments.length; i++) {
    if (
      ordered[i].index !== i + 1 ||
      ordered[i].startAt !== segments[i].startAt ||
      ordered[i].endAt !== segments[i].endAt ||
      ordered[i].review.method !== "ai"
    ) throw new Error("Segmentos incompletos ou fora da ordem.");
  }
  return ordered;
}
