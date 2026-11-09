import { z } from "zod";
import { accessMode, checkAccess } from "@/server/access";
import type { ChatReview } from "@/lib/chat-import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store", Vary: "Authorization" };
const item = z.object({
  at: z.string().max(60),
  sender: z.string().max(150),
  text: z.string().max(20_000),
});
const inputSchema = z.object({
  name: z.string().min(1).max(160),
  isGroup: z.boolean(),
  participants: z.array(z.string().max(150)).max(200),
  messages: z.array(item).min(1).max(5_000),
});

export function GET(request: Request) {
  const blocked = checkAccess(request);
  if (blocked) return blocked;
  return Response.json({
    protected: accessMode() === "basic",
    aiReady: accessMode() === "basic" && Boolean(process.env.CRM_CHAT_IMPORT_API_KEY),
  }, { headers });
}

const enums = {
  category: ["lead", "supplier", "group", "personal", "irrelevant", "uncertain"],
  situation: ["active", "recoverable", "possible_loss", "won", "unknown"],
  area: ["solar", "motos", "construction", "licitacao", "other"],
  confidence: ["low", "medium", "high"],
};
const schema = {
  type: "object",
  additionalProperties: false,
  required: ["category", "situation", "area", "summary", "reason", "evidence", "nextStep", "confidence"],
  properties: {
    category: { type: "string", enum: enums.category },
    situation: { type: "string", enum: enums.situation },
    area: { type: "string", enum: enums.area },
    summary: { type: "string" },
    reason: { type: "string" },
    evidence: { type: "array", items: { type: "string" } },
    nextStep: { type: "string" },
    confidence: { type: "string", enum: enums.confidence },
  },
};
const outputSchema = z.object({
  category: z.enum(["lead", "supplier", "group", "personal", "irrelevant", "uncertain"]),
  situation: z.enum(["active", "recoverable", "possible_loss", "won", "unknown"]),
  area: z.enum(["solar", "motos", "construction", "licitacao", "other"]),
  summary: z.string().max(1_500),
  reason: z.string().max(1_500),
  evidence: z.array(z.string().max(450)).max(8),
  nextStep: z.string().max(500),
  confidence: z.enum(["low", "medium", "high"]),
});

export async function POST(request: Request) {
  const blocked = checkAccess(request);
  if (blocked) return blocked;
  if (accessMode() !== "basic")
    return Response.json({ error: "Análise de conversas reais exige CRM protegido." }, { status: 403, headers });
  const key = process.env.CRM_CHAT_IMPORT_API_KEY;
  if (!key)
    return Response.json({ error: "Configure CRM_CHAT_IMPORT_API_KEY no servidor." }, { status: 503, headers });
  if (Number(request.headers.get("content-length")) > 160_000)
    return Response.json({ error: "Conversa acima do limite desta análise." }, { status: 413, headers });
  let input: z.infer<typeof inputSchema>;
  try {
    const raw = await request.text();
    if (raw.length > 160_000) throw new Error("TOO_LARGE");
    input = inputSchema.parse(JSON.parse(raw));
    if (input.messages.reduce((n, m) => n + m.text.length, 0) > 100_000)
      throw new Error("TOO_LARGE");
  } catch {
    return Response.json({ error: "Envie até 100 mil caracteres de uma conversa válida." }, { status: 422, headers });
  }
  const instruction = [
    "Você analisa histórico de WhatsApp para recuperação de oportunidades comerciais no Brasil.",
    "Considere TODAS as mensagens fornecidas, na ordem cronológica. Não invente fatos.",
    "Diferencie cliente potencial, fornecedor, grupo de integradores/compras, pessoal e irrelevante.",
    "Uma conversa parada ou sem resposta NÃO é desistência. Somente registre perda como possível e requeira confirmação, a menos que haja confirmação inequívoca de conclusão.",
    "Verifique QUEM disse cada frase; uma fala do vendedor não significa intenção do comprador.",
    "Quando houver sinal de venda fechada, classifique como won, nunca como lead aberto.",
    "Se o histórico for inconclusivo use uncertain/unknown, e confiança low.",
    "Extraia evidências literalmente do texto; não insira telefone, documento, endereço ou dado pessoal sensível no resumo.",
    "Nunca recomende enviar mensagens automaticamente; apenas sugira próximo passo a um humano.",
    "Um contato com uma conversa antiga mas interesse não encerrado pode ser recoverable.",
    "Responda somente com o JSON no esquema solicitado. Idioma: português do Brasil.",
  ].join("\n");
  const transcript = input.messages.map((m) =>
    "[" + m.at + "] " + m.sender + ": " + m.text
  ).join("\n");
  try {
    const result = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.CRM_CHAT_IMPORT_MODEL || "gpt-5-mini",
        store: false,
        max_output_tokens: 2_000,
        input: [
          { role: "system", content: instruction },
          { role: "user", content: "Nome do chat: " + input.name + "\nGrupo: " + input.isGroup +
              "\nParticipantes: " + input.participants.join(", ") + "\nHistórico:\n" + transcript },
        ],
        text: { format: { type: "json_schema", name: "triagem_conversa", strict: true, schema } },
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!result.ok)
      return Response.json({
        error: "Não foi possível concluir a análise pela IA. Confira a chave, o modelo e os limites da API.",
      }, { status: 502, headers });
    const output = await result.json() as {
      output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
    };
    const message = output.output?.flatMap((v) => v.content || [])
      .find((v) => v.type === "output_text")?.text;
    const parsed = outputSchema.safeParse(JSON.parse(message || "null"));
    if (!parsed.success) throw new Error("INVALID_AI_OUTPUT");
    const review: ChatReview = {
      ...parsed.data,
      evidence: parsed.data.evidence.slice(0, 5),
      method: "ai",
      partial: false,
    };
    return Response.json({ review }, { headers });
  } catch {
    return Response.json({ error: "A análise não terminou. Nenhum contato foi importado." },
      { status: 502, headers });
  }
}
