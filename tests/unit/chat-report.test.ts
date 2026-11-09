import { describe, expect, it } from "vitest";
import { exportChatReport, importChatReport } from "../../src/lib/chat-report";
import { parseWhatsAppText, reviewLocally, type ChatProposal } from "../../src/lib/chat-import";

function sample(): ChatProposal {
  const thread = parseWhatsAppText(
    "WhatsApp Chat with Cliente Teste.txt",
    "[09/11/2026, 15:00:00] Cliente Teste: Tenho interesse em energia solar.\n" +
    "[09/11/2026, 15:01:00] Atendente: Mensagem de acompanhamento sem palavra comercial.",
  );
  return {
    thread, review: reviewLocally(thread),
    selected: true, customerName: "Cliente Teste", phone: "+5519999990000",
    pipelineId: "pipeline-sales", stageId: "stage-lead", businessTypeId: "",
  };
}

describe("relatório local de triagem", () => {
  it("exporta resumos e evidências, nunca o histórico completo", () => {
    const item = sample();
    const report = exportChatReport([item]);
    expect(report).toContain("meu-crm-chat-report-v1");
    expect(report).not.toContain("Mensagem de acompanhamento sem palavra comercial.");
    const restored = importChatReport(report)[0];
    expect(restored.thread.messages).toEqual([]);
    expect(restored.thread.messageCount).toBe(2);
    expect(restored.review.category).toBe(item.review.category);
    expect(restored.selected).toBe(false);
  });
  it("rejeita payload incompatível e quantidade excessiva", () => {
    expect(() => importChatReport('{"format":"wrong","items":[]}')).toThrow();
    const invalid = JSON.parse(exportChatReport([sample()]));
    invalid.items = Array.from({ length: 101 }, () => invalid.items[0]);
    expect(() => importChatReport(JSON.stringify(invalid))).toThrow();
  });
});
