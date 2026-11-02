import { z } from "zod";
import type { CrmData } from "./types";

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
  source: z.string().max(100),
  expectedCloseDate: z.union([z.literal(""), z.iso.date()]),
  notes: z.string().max(10000),
  position: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const crmSchema = z
  .object({
    schemaVersion: z.literal(1),
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
    ].map((x) => x.id);
    if (new Set(allIds).size !== allIds.length)
      ctx.addIssue({
        code: "custom",
        message: "Identificadores duplicados no backup.",
      });
    for (const d of data.deals) {
      const pipeline = data.pipelines.find((p) => p.id === d.pipelineId);
      if (
        !pipeline?.stages.some((s) => s.id === d.stageId) ||
        !data.customers.some((c) => c.id === d.customerId)
      ) {
        ctx.addIssue({
          code: "custom",
          message: "Oportunidade com cliente, funil ou etapa inexistente.",
        });
      }
    }
    if (data.activities.some((a) => !data.deals.some((d) => d.id === a.dealId)))
      ctx.addIssue({
        code: "custom",
        message: "Histórico sem oportunidade correspondente.",
      });
  });

export function parseCrmData(input: unknown): CrmData {
  return crmSchema.parse(input);
}
