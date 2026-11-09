import type { CrmData } from "./types";
import { saveCustomer, saveDeal } from "./crm";
import { normalized } from "./format";

export interface ChatMessage {
  at: string;
  sender: string;
  text: string;
}
export interface ChatThread {
  id: string;
  fileName: string;
  name: string;
  phone: string;
  messages: ChatMessage[];
  participants: string[];
  isGroup: boolean;
  lastAt: string;
}
export type ChatCategory =
  | "lead"
  | "supplier"
  | "group"
  | "personal"
  | "irrelevant"
  | "uncertain";
export type ChatSituation =
  | "active"
  | "recoverable"
  | "possible_loss"
  | "won"
  | "unknown";
export type BusinessArea = "solar" | "motos" | "construction" | "licitacao" | "other";
export interface ChatReview {
  category: ChatCategory;
  situation: ChatSituation;
  area: BusinessArea;
  summary: string;
  reason: string;
  evidence: string[];
  nextStep: string;
  confidence: "low" | "medium" | "high";
  method: "rules" | "ai";
  partial: boolean;
}
export interface ChatProposal {
  thread: ChatThread;
  review: ChatReview;
  selected: boolean;
  customerName: string;
  phone: string;
  pipelineId: string;
  stageId: string;
  businessTypeId: string;
}
const MAX_MESSAGES = 20_000;

function dateIso(source: string) {
  const [dd, mm, yyyy] = source.split(/[/.]/).map(Number);
  if (!dd || !mm || !yyyy) return "";
  const y = yyyy < 100 ? (yyyy >= 70 ? 1900 + yyyy : 2000 + yyyy) : yyyy;
  const value = new Date(Date.UTC(y, mm - 1, dd));
  if (
    Number.isNaN(value.getTime()) ||
    value.getUTCFullYear() !== y ||
    value.getUTCMonth() !== mm - 1 ||
    value.getUTCDate() !== dd
  ) return "";
  return value.toISOString().slice(0, 10);
}

function fileTitle(fileName: string) {
  return fileName
    .split(/[\\/]/).at(-1)!
    .replace(/\.(txt|zip)$/i, "")
    .replace(/^_chat$/i, "")
    .replace(/^(?:WhatsApp Chat with|Conversa do WhatsApp com|Chat do WhatsApp com)\s*/i, "")
    .replace(/^\s*[-_]\s*/, "")
    .trim() || "Conversa sem nome";
}

export function normalizedPhone(value: string) {
  const number = value.replace(/\D/g, "");
  if (/^55\d{10,11}$/.test(number)) return "+" + number;
  if (/^\d{10,11}$/.test(number)) return "+55" + number;
  return "";
}

export function parseWhatsAppText(fileName: string, text: string): ChatThread {
  const name = fileTitle(fileName);
  const phone = normalizedPhone(name);
  const messages: ChatMessage[] = [];
  let current: ChatMessage | null = null;
  // iPhone: [09/11/2026, 14:31:05] Nome: texto
  // Android: 09/11/2026, 14:31 - Nome: texto
  const marker =
    /^\[?(\d{1,2}[/.]\d{1,2}[/.]\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?)(?:\s*(?:AM|PM))?\]?\s*(?:-\s*)?(.*)$/i;
  for (const original of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const line = original.replace(/[\u200e\u200f\u202a-\u202e]/g, "");
    const match = marker.exec(line);
    const at = match ? dateIso(match[1]) : "";
    const separator = match ? match[3].indexOf(": ") : -1;
    if (at && separator > 0) {
      const sender = match![3].slice(0, separator).trim();
      const body = match![3].slice(separator + 2).trim();
      if (sender && sender.length < 150) {
        current = { sender, text: body, at: at + " " + match![2] };
        if (messages.length < MAX_MESSAGES) messages.push(current);
        continue;
      }
    }
    if (current && messages.length <= MAX_MESSAGES)
      current.text = (current.text + "\n" + line).slice(0, 40_000);
  }
  const participants = [...new Set(messages.map((message) => message.sender))];
  const titleGroup = /grupo|integradores|compra coletiva|grupo de compras|grupo solar/i.test(name);
  return {
    id: crypto.randomUUID(),
    fileName,
    name,
    phone,
    messages,
    participants,
    isGroup: participants.length > 2 || titleGroup,
    lastAt: messages.at(-1)?.at || "",
  };
}
const SOLAR = /energia solar|fotovoltaic|placas solares|painel solar|inversor|gera[çc][aã]o de energia|kwp\b|sistema solar/i;
const MOTOS = /moto el[eé]trica|e-bike|bicicleta el[eé]trica|scooter|bateria de moto/i;
const CONSTRUCTION = /constru[çc][aã]o|reforma|impermeabili|telhado|pintura|obra civil|alvenaria/i;
const LICITACAO = /licita[çc][aã]o|preg[aã]o|edital|empenho|compras\.gov|ata de registro/i;
const SUPPLIER = /distribuidor|atacado|estoque dispon[ií]vel|tabela de pre[çc]os|representante comercial|sou fornecedor|fornecimento para revenda/i;
const INTEREST = /or[çc]amento|proposta|quanto custa|qual o valor|pre[çc]o|financiamento|visita t[eé]cnica|quero comprar|tenho interesse|me passa|parcelamento/i;
const LOST = /n[aã]o tenho (mais )?interesse|desisti|n[aã]o vou (mais )?fazer|fechei com outr|j[aá] contratei outr|pode cancelar/i;
const WON = /fechado|pode emitir a nota|vou pagar|contrato assinado|pagamento realizado|pix enviado/i;

export function reviewLocally(thread: ChatThread): ChatReview {
  const full = thread.messages.map((m) => m.text).join("\n").slice(-100_000);
  const last = thread.messages.slice(-35).map((m) => m.text).join("\n");
  const text = normalized(full);
  const area: BusinessArea = SOLAR.test(text)
    ? "solar"
    : MOTOS.test(text)
      ? "motos"
      : CONSTRUCTION.test(text)
        ? "construction"
        : LICITACAO.test(text)
          ? "licitacao"
          : "other";
  const supplier = SUPPLIER.test(thread.name + "\n" + full);
  const commercial = INTEREST.test(full);
  const loss = LOST.test(last);
  const won = WON.test(last);
  const category: ChatCategory = thread.isGroup
    ? "group"
    : supplier && !commercial
      ? "supplier"
      : area !== "other" || commercial
        ? "lead"
        : "uncertain";
  const situation: ChatSituation =
    loss ? "possible_loss" : won ? "won" : commercial ? "recoverable" : "unknown";
  const evidence = thread.messages
    .filter((m) => INTEREST.test(m.text) || LOST.test(m.text) || WON.test(m.text))
    .slice(-3)
    .map((m) => m.sender + ": " + m.text.slice(0, 160));
  return {
    category,
    situation,
    area,
    summary: commercial
      ? "Há indícios de interesse comercial; é necessário confirmar a situação atual."
      : "Sem sinais suficientes para classificar a negociação com segurança.",
    reason: thread.isGroup
      ? "Conversa com vários participantes; não criar lead individual automaticamente."
      : loss
        ? "Há menção a desistência ou cancelamento, mas ainda é preciso verificar quem disse isso."
        : supplier && !commercial
          ? "Possíveis sinais de fornecimento ou revenda."
          : "Triagem inicial por palavras-chave, não é uma conclusão da IA.",
    evidence,
    nextStep: "Ler o histórico e confirmar o contexto antes de retomar contato.",
    confidence: "low",
    method: "rules",
    partial: thread.messages.length >= MAX_MESSAGES,
  };
}

export function matchCustomer(data: CrmData, name: string, phone: string) {
  const digits = normalizedPhone(phone).replace(/\D/g, "");
  if (digits)
    return data.customers.find((c) => normalizedPhone(c.phone).replace(/\D/g, "") === digits);
  // Nome isolado não comprova identidade quando há telefone cadastrado.
  const matches = data.customers.filter((c) =>
    normalized(c.name.trim()) === normalized(name.trim()) && name.trim().length > 2
  );
  return matches.length === 1 && !normalizedPhone(matches[0].phone)
    ? matches[0] : undefined;
}

export function importApprovedChats(
  data: CrmData,
  proposals: ChatProposal[],
): { data: CrmData; created: number; skipped: number } {
  let next = data, created = 0, skipped = 0;
  const source = "WhatsApp histórico";
  if (!next.sources.some((s) => s.name === source))
    next = { ...next, sources: [...next.sources, { id: crypto.randomUUID(), name: source }] };
  for (const item of proposals.filter((p) => p.selected).slice(0, 30)) {
    if (
      item.review.category !== "lead" ||
      !["active", "recoverable"].includes(item.review.situation) ||
      item.review.partial ||
      !item.customerName.trim() ||
      !next.pipelines.some((p) =>
        p.id === item.pipelineId && p.stages.some((s) => s.id === item.stageId)
      )
    ) { skipped++; continue; }
    let customer = matchCustomer(next, item.customerName, item.phone);
    // Identidades homônimas ou sem telefone devem ser conferidas manualmente.
    if (!customer && next.customers.some((c) =>
      normalized(c.name.trim()) === normalized(item.customerName.trim())
    )) { skipped++; continue; }
    if (!customer) {
      next = saveCustomer(next, {
        name: item.customerName.trim().slice(0, 120),
        company: "",
        email: "",
        phone: normalizedPhone(item.phone),
      });
      customer = next.customers.at(-1)!;
    }
    // Never overwrite an existing opportunity or duplicate it automatically.
    if (next.deals.some((d) =>
      d.customerId === customer.id &&
      d.pipelineId === item.pipelineId &&
      d.status === "open"
    )) { skipped++; continue; }
    const type = next.businessTypes.find((b) => b.id === item.businessTypeId);
    const label = type?.name || "Contato WhatsApp";
    const owner = next.sellers.find((s) => s.active)?.name;
    if (!owner) { skipped++; continue; }
    const notes = [
      "Importação revisada de conversa exportada do WhatsApp.",
      "Arquivo: " + item.thread.fileName.slice(0, 150),
      "Última mensagem: " + (item.thread.lastAt || "não identificada"),
      "Resumo: " + item.review.summary,
      "Justificativa: " + item.review.reason,
      "Próximo passo: " + item.review.nextStep,
      "Evidências: " + item.review.evidence.join(" | "),
      "Histórico completo não armazenado no CRM.",
    ].join("\n").slice(0, 9_000);
    next = saveDeal(next, {
      title: (customer.name + " — " + label).slice(0, 120),
      value: 0,
      customerId: customer.id,
      pipelineId: item.pipelineId,
      stageId: item.stageId,
      status: "open",
      priority: item.review.situation === "active" ? "high" : "medium",
      owner,
      source,
      businessTypeId: type?.id || "",
      expectedCloseDate: "",
      notes,
    });
    created++;
  }
  return { data: next, created, skipped };
}
