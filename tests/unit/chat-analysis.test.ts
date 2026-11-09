import { describe, expect, it } from "vitest";
import { splitChatMessages, validateSegmentReviews } from "../../src/lib/chat-analysis";
import type { ChatMessage, ChatReview } from "../../src/lib/chat-import";

const message = (text: string, at = "2026-11-09 15:00"): ChatMessage => ({
  at,
  sender: "Cliente",
  text,
});
const finding: ChatReview = {
  category: "lead",
  situation: "recoverable",
  area: "solar",
  summary: "Cliente solicitou orçamento.",
  reason: "Mensagem com pedido explícito.",
  evidence: ["Cliente: Gostaria de orçamento."],
  nextStep: "Retomar após revisão.",
  confidence: "medium",
  method: "ai",
  partial: true,
};

describe("análise integral dividida em trechos", () => {
  it("preserva todo o histórico e ordem cronológica sem eliminar mensagens", () => {
    const messages = Array.from({ length: 150 }, (_, i) =>
      message("A".repeat(600) + i, "2026-11-09 " + String(i % 24).padStart(2, "0") + ":00"),
    );
    const chunks = splitChatMessages(messages, 10_000, 20);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.flatMap((x) => x.messages).map((x) => x.text)).toEqual(messages.map((x) => x.text));
    expect(chunks.every((x, i) => x.index === i + 1)).toBe(true);
  });

  it("divide textos individuais compridos para respeitar o limite do backend", () => {
    const content = "texto".repeat(25_000);
    const chunks = splitChatMessages([message(content)]);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.flatMap((x) => x.messages).map((x) => x.text).join("")).toBe(content);
    expect(chunks.every((x) => x.messages.every((m) => m.text.length <= 18_000))).toBe(true);
  });

  it("impede consolidação incompleta ou fora da ordem", () => {
    const segments = splitChatMessages(
      [message("A".repeat(9000), "2026-11-01"), message("B".repeat(9000), "2026-11-02")],
      10_000,
    );
    const findings = segments.map((segment) => ({
      index: segment.index, startAt: segment.startAt, endAt: segment.endAt, review: finding,
    }));
    expect(validateSegmentReviews(segments, findings)).toHaveLength(2);
    expect(() => validateSegmentReviews(segments, findings.slice(0, 1))).toThrow("não cobriu");
    expect(() => validateSegmentReviews(segments, [findings[1], findings[1]])).toThrow("incompletos");
  });
});
