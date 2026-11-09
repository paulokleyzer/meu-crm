import { z } from "zod";
import type { ChatProposal } from "./chat-import";

// Resumes triage after a browser reload WITHOUT saving the full WhatsApp transcript.
const review = z.object({
  category: z.enum(["lead", "supplier", "group", "personal", "irrelevant", "uncertain"]),
  situation: z.enum(["active", "recoverable", "possible_loss", "won", "unknown"]),
  area: z.enum(["solar", "motos", "construction", "licitacao", "other"]),
  summary: z.string().max(1500),
  reason: z.string().max(1500),
  evidence: z.array(z.string().max(450)).max(8),
  nextStep: z.string().max(500),
  confidence: z.enum(["low", "medium", "high"]),
  method: z.enum(["ai", "rules"]),
  partial: z.boolean(),
});
const row = z.object({
  fileName: z.string().max(200),
  name: z.string().max(160),
  phone: z.string().max(40),
  lastAt: z.string().max(60),
  messageCount: z.number().int().min(0).max(50_000),
  isGroup: z.boolean(),
  customerName: z.string().max(120),
  pipelineId: z.string().max(100),
  stageId: z.string().max(100),
  businessTypeId: z.string().max(100),
  review,
});
const report = z.object({
  format: z.literal("meu-crm-chat-report-v1"),
  exportedAt: z.string().max(60),
  items: z.array(row).max(100),
});

export function exportChatReport(proposals: ChatProposal[]) {
  return JSON.stringify({
    format: "meu-crm-chat-report-v1",
    exportedAt: new Date().toISOString(),
    items: proposals.map((p) => ({
      fileName: p.thread.fileName,
      name: p.thread.name,
      phone: p.phone,
      lastAt: p.thread.lastAt,
      messageCount: p.thread.messageCount ?? p.thread.messages.length,
      isGroup: p.thread.isGroup,
      customerName: p.customerName,
      pipelineId: p.pipelineId,
      stageId: p.stageId,
      businessTypeId: p.businessTypeId,
      review: p.review,
    })),
  }, null, 2);
}
export function importChatReport(source: string): ChatProposal[] {
  if (source.length > 5_000_000) throw new Error("Relatório acima do limite de 5 MB.");
  const parsed = report.parse(JSON.parse(source));
  return parsed.items.map((item) => ({
    thread: {
      id: crypto.randomUUID(),
      fileName: item.fileName,
      name: item.name,
      phone: item.phone,
      lastAt: item.lastAt,
      messages: [],
      participants: [],
      isGroup: item.isGroup,
      messageCount: item.messageCount,
    },
    review: item.review,
    selected: false, // Aprovação deve ser repetida, nunca restaurada implicitamente.
    customerName: item.customerName,
    phone: item.phone,
    pipelineId: item.pipelineId,
    stageId: item.stageId,
    businessTypeId: item.businessTypeId,
  }));
}
