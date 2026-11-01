import type {
  CrmData,
  CustomerInput,
  Deal,
  DealFilters,
  DealInput,
  PipelineInput,
} from "./types";
import { localDate, normalized } from "./format";

export const newId = () => crypto.randomUUID();
const timestamp = () => new Date().toISOString();
function activity(data: CrmData, dealId: string, text: string): CrmData {
  return {
    ...data,
    activities: [
      ...data.activities,
      { id: newId(), dealId, text, createdAt: timestamp() },
    ],
  };
}
export function createPipeline(data: CrmData, input: PipelineInput): CrmData {
  return { ...data, pipelines: [...data.pipelines, { ...input, id: newId() }] };
}
export function duplicatePipeline(data: CrmData, pipelineId: string): CrmData {
  const pipeline = data.pipelines.find((p) => p.id === pipelineId);
  if (!pipeline) throw new Error("Funil não encontrado.");
  let name = `${pipeline.name} (cópia)`;
  let n = 2;
  while (data.pipelines.some((p) => p.name === name))
    name = `${pipeline.name} (cópia ${n++})`;
  return createPipeline(data, {
    ...pipeline,
    name,
    stages: pipeline.stages.map((s) => ({ ...s, id: newId() })),
  });
}
export function updatePipeline(
  data: CrmData,
  pipelineId: string,
  input: PipelineInput,
): CrmData {
  if (!input.stages.length)
    throw new Error("O funil precisa de pelo menos uma etapa.");
  if (!data.pipelines.some((p) => p.id === pipelineId))
    throw new Error("Funil não encontrado.");
  let next: CrmData = {
    ...data,
    pipelines: data.pipelines.map((p) =>
      p.id === pipelineId ? { ...p, ...input } : p,
    ),
  };
  for (const deal of data.deals.filter(
    (d) =>
      d.pipelineId === pipelineId &&
      !input.stages.some((s) => s.id === d.stageId),
  )) {
    next = moveDeal(next, deal.id, input.stages[0].id);
  }
  return next;
}
export function deletePipeline(
  data: CrmData,
  pipelineId: string,
  targetId: string,
): CrmData {
  if (data.pipelines.length <= 1)
    throw new Error("Mantenha pelo menos um funil.");
  const target = data.pipelines.find(
    (p) => p.id === targetId && p.id !== pipelineId,
  );
  if (!target) throw new Error("Escolha um funil de destino.");
  let next = data;
  for (const deal of data.deals.filter((d) => d.pipelineId === pipelineId))
    next = moveDeal(next, deal.id, target.stages[0].id);
  return {
    ...next,
    pipelines: next.pipelines.filter((p) => p.id !== pipelineId),
  };
}
export function saveCustomer(
  data: CrmData,
  input: CustomerInput,
  id?: string,
): CrmData {
  if (id && !data.customers.some((c) => c.id === id))
    throw new Error("Cliente não encontrado.");
  const customer = {
    ...input,
    name: input.name.trim(),
    id: id || newId(),
    createdAt:
      data.customers.find((c) => c.id === id)?.createdAt || timestamp(),
  };
  return {
    ...data,
    customers: id
      ? data.customers.map((c) => (c.id === id ? customer : c))
      : [...data.customers, customer],
  };
}
export function saveDeal(
  data: CrmData,
  input: DealInput,
  id?: string,
): CrmData {
  const pipeline = data.pipelines.find((p) => p.id === input.pipelineId);
  if (!pipeline?.stages.some((s) => s.id === input.stageId))
    throw new Error("Escolha uma etapa válida para este funil.");
  if (!data.customers.some((c) => c.id === input.customerId))
    throw new Error("Escolha um cliente válido.");
  const existing = data.deals.find((d) => d.id === id);
  if (id && !existing) throw new Error("Oportunidade não encontrada.");
  const now = timestamp();
  const deal: Deal = {
    ...input,
    title: input.title.trim(),
    id: id || newId(),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    position:
      existing?.stageId === input.stageId
        ? existing.position
        : Math.max(
            -1,
            ...data.deals
              .filter((d) => d.stageId === input.stageId)
              .map((d) => d.position),
          ) + 1,
  };
  const next = {
    ...data,
    deals: id
      ? data.deals.map((d) => (d.id === id ? deal : d))
      : [...data.deals, deal],
  };
  return activity(
    next,
    deal.id,
    id ? "Detalhes da oportunidade atualizados" : "Oportunidade criada",
  );
}
export function deleteDeal(data: CrmData, id: string): CrmData {
  return {
    ...data,
    deals: data.deals.filter((d) => d.id !== id),
    activities: data.activities.filter((a) => a.dealId !== id),
  };
}
export function moveDeal(
  data: CrmData,
  dealId: string,
  stageId: string,
  beforeId?: string,
): CrmData {
  const deal = data.deals.find((d) => d.id === dealId);
  const pipeline = data.pipelines.find((p) =>
    p.stages.some((s) => s.id === stageId),
  );
  if (!deal || !pipeline)
    throw new Error("Oportunidade ou etapa não encontrada.");
  if (dealId === beforeId) return data;
  const target = data.deals
    .filter((d) => d.stageId === stageId && d.id !== dealId)
    .sort((a, b) => a.position - b.position);
  const beforeIndex = target.findIndex((d) => d.id === beforeId);
  target.splice(beforeIndex < 0 ? target.length : beforeIndex, 0, {
    ...deal,
    stageId,
    pipelineId: pipeline.id,
    updatedAt: timestamp(),
  });
  const positions = new Map(
    target.map((d, i) => [d.id, { ...d, position: i }]),
  );
  const next = {
    ...data,
    deals: data.deals.map((d) => positions.get(d.id) || d),
  };
  return deal.stageId === stageId
    ? next
    : activity(
        next,
        dealId,
        `Movida para ${pipeline.stages.find((s) => s.id === stageId)!.name} · ${pipeline.name}`,
      );
}
export function filterDeals(
  data: CrmData,
  pipelineId: string,
  filters: DealFilters,
): Deal[] {
  const q = normalized(filters.query.trim());
  const today = localDate();
  return data.deals
    .filter((d) => {
      const customer = data.customers.find((c) => c.id === d.customerId);
      return (
        d.pipelineId === pipelineId &&
        (filters.status === "all" || d.status === filters.status) &&
        (!filters.owner || d.owner === filters.owner) &&
        (!filters.priority || d.priority === filters.priority) &&
        (filters.due !== "overdue" ||
          (!!d.expectedCloseDate &&
            d.expectedCloseDate < today &&
            d.status === "open")) &&
        (!q ||
          normalized(
            `${d.title} ${customer?.name} ${customer?.company} ${customer?.email}`,
          ).includes(q))
      );
    })
    .sort((a, b) => a.position - b.position);
}
