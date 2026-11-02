import { z } from "zod";
import type { CrmData } from "./types";
import { upgradeBackup } from "./upgrade-backup";

const id = z.string().min(1).max(100);
const shortText = z.string().trim().min(1).max(120);
const stage = z.object({
  id,
  name: shortText,
  probability: z.number().int().min(0).max(100),
});
const customer = z.object({
  id,
  name: shortText,
  company: z.string().max(160),
  email: z.union([z.literal(""), z.email()]),
  phone: z.string().max(40),
  createdAt: z.iso.datetime(),
});
const deal = z.object({
  id,
  title: shortText,
  value: z
    .number()
    .finite()
    .min(0)
    .max(999_999_999_999)
    .refine(
      (v) => Math.abs(v * 100 - Math.round(v * 100)) < 0.001,
      "Use no máximo duas casas decimais.",
    ),
  customerId: id,
  pipelineId: id,
  stageId: id,
  status: z.enum(["open", "won", "lost"]),
  priority: z.enum(["low", "medium", "high"]),
  owner: shortText,
  source: z.string().max(120),
  businessTypeId: z.union([z.literal(""), id]),
  expectedCloseDate: z.union([z.literal(""), z.iso.date()]),
  notes: z.string().max(10000),
  position: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

const currentSchema = z
  .object({
    schemaVersion: z.literal(2),
    pipelines: z
      .array(
        z.object({
          id,
          name: shortText,
          description: z.string().max(500),
          stages: z.array(stage).min(1).max(30),
        }),
      )
      .min(1)
      .max(100),
    businessTypes: z
      .array(z.object({ id, name: z.string().min(1).max(120) }))
      .max(200),
    sources: z
      .array(z.object({ id, name: z.string().min(1).max(120) }))
      .max(200),
    sellers: z
      .array(
        z.object({ id, name: z.string().min(1).max(120), active: z.boolean() }),
      )
      .min(1)
      .max(200),
    distributionRules: z
      .array(
        z.object({
          id,
          name: shortText,
          businessTypeId: z.union([z.literal(""), id]),
          source: z.string().max(120),
          pipelineId: id,
          enabled: z.boolean(),
          isDefault: z.boolean(),
        }),
      )
      .max(200),
    scheduledActivities: z
      .array(
        z.object({
          id,
          title: shortText,
          type: z.enum(["task", "call", "meeting", "follow_up"]),
          dueAt: z.iso.datetime(),
          customerId: z.union([z.literal(""), id]),
          dealId: z.union([z.literal(""), id]),
          owner: shortText,
          completedAt: z.union([z.literal(""), z.iso.datetime()]),
          notes: z.string().max(4000),
          remindBeforeMinutes: z.number().int().min(0).max(1440),
          createdAt: z.iso.datetime(),
        }),
      )
      .max(10000),
    customers: z.array(customer).max(50000),
    deals: z.array(deal).max(50000),
    activities: z
      .array(
        z.object({
          id,
          dealId: id,
          text: z.string().min(1).max(1000),
          createdAt: z.iso.datetime(),
        }),
      )
      .max(200000),
  })
  .superRefine((data, ctx) => {
    const allIds = [
      ...data.pipelines,
      ...data.pipelines.flatMap((p) => p.stages),
      ...data.customers,
      ...data.deals,
      ...data.activities,
      ...data.businessTypes,
      ...data.sources,
      ...data.sellers,
      ...data.distributionRules,
      ...data.scheduledActivities,
    ].map((x) => x.id);
    if (new Set(allIds).size !== allIds.length)
      ctx.addIssue({
        code: "custom",
        message: "Identificadores duplicados no backup.",
      });
    const issue = (message: string) =>
      ctx.addIssue({ code: "custom", message });
    const customers = new Set(data.customers.map((c) => c.id));
    const pipelines = new Map(data.pipelines.map((p) => [p.id, p]));
    const deals = new Map(data.deals.map((d) => [d.id, d]));
    const categories = new Set(data.businessTypes.map((c) => c.id));
    const sources = new Set(data.sources.map((c) => c.name));
    const sellers = new Set(data.sellers.map((c) => c.name));
    for (const list of [data.businessTypes, data.sources, data.sellers]) {
      if (new Set(list.map((x) => x.name)).size !== list.length)
        issue("Nomes duplicados nas configurações.");
    }
    if (!data.sellers.some((s) => s.active))
      issue("Mantenha pelo menos um responsável ativo.");
    if (data.distributionRules.filter((r) => r.isDefault).length > 1)
      issue("Escolha somente uma regra padrão.");
    for (const r of data.distributionRules) {
      if (
        !pipelines.has(r.pipelineId) ||
        (r.businessTypeId && !categories.has(r.businessTypeId)) ||
        (r.source && !sources.has(r.source))
      )
        issue("Regra de distribuição com referência inexistente.");
    }
    for (const t of data.scheduledActivities) {
      const deal = deals.get(t.dealId);
      if (
        (!t.customerId && !t.dealId) ||
        (t.customerId && !customers.has(t.customerId)) ||
        (t.dealId && !deal) ||
        (deal && t.customerId && deal.customerId !== t.customerId) ||
        !sellers.has(t.owner)
      )
        issue("Atividade com cliente, oportunidade ou responsável inválido.");
    }
    for (const d of data.deals) {
      const pipeline = pipelines.get(d.pipelineId);
      if (
        (d.businessTypeId && !categories.has(d.businessTypeId)) ||
        (d.source && !sources.has(d.source)) ||
        !sellers.has(d.owner)
      )
        issue("Tipo de negócio, origem ou responsável inexistente.");
      if (
        !pipeline?.stages.some((s) => s.id === d.stageId) ||
        !customers.has(d.customerId)
      ) {
        ctx.addIssue({
          code: "custom",
          message: "Oportunidade com cliente, funil ou etapa inexistente.",
        });
      }
    }
    if (data.activities.some((a) => !deals.has(a.dealId)))
      ctx.addIssue({
        code: "custom",
        message: "Histórico sem oportunidade correspondente.",
      });
  });

export const crmSchema = z.preprocess(upgradeBackup, currentSchema);

export function parseCrmData(input: unknown): CrmData {
  return crmSchema.parse(input);
}
