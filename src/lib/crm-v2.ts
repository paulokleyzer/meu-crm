import type {
  CatalogEntry,
  CrmData,
  DistributionRule,
  ScheduledActivityInput,
} from "./types";
import { newId, saveCustomer, saveDeal } from "./crm";

export type Catalog = "businessTypes" | "sources" | "sellers";
export function saveCatalog(
  data: CrmData,
  catalog: Catalog,
  name: string,
  id?: string,
): CrmData {
  name = name.trim();
  if (!name || name.length > 120)
    throw new Error("Informe um nome de até 120 caracteres.");
  if (
    data[catalog].some(
      (e) =>
        e.id !== id &&
        e.name.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"),
    )
  )
    throw new Error("Já existe um cadastro com esse nome.");
  const existing = data[catalog].find((e) => e.id === id);
  if (id && !existing) throw new Error("Cadastro não encontrado.");
  const entry = {
    ...existing,
    id: id || newId(),
    name,
    ...(catalog === "sellers"
      ? {
          active:
            existing && "active" in existing ? Boolean(existing.active) : true,
        }
      : {}),
  };
  let next = {
    ...data,
    [catalog]: id
      ? data[catalog].map((e) => (e.id === id ? entry : e))
      : [...data[catalog], entry],
  } as CrmData;
  if (existing && catalog === "sources")
    next = {
      ...next,
      deals: next.deals.map((d) =>
        d.source === existing.name ? { ...d, source: name } : d,
      ),
      distributionRules: next.distributionRules.map((r) =>
        r.source === existing.name ? { ...r, source: name } : r,
      ),
    };
  if (existing && catalog === "sellers")
    next = {
      ...next,
      deals: next.deals.map((d) =>
        d.owner === existing.name ? { ...d, owner: name } : d,
      ),
      scheduledActivities: next.scheduledActivities.map((t) =>
        t.owner === existing.name ? { ...t, owner: name } : t,
      ),
    };
  return next;
}
export function deleteCatalog(
  data: CrmData,
  catalog: Exclude<Catalog, "sellers">,
  id: string,
): CrmData {
  const entry = data[catalog].find((e) => e.id === id);
  if (!entry) throw new Error("Cadastro não encontrado.");
  return {
    ...data,
    [catalog]: data[catalog].filter((e) => e.id !== id),
    deals: data.deals.map((d) =>
      catalog === "businessTypes" && d.businessTypeId === id
        ? { ...d, businessTypeId: "" }
        : catalog === "sources" && d.source === entry.name
          ? { ...d, source: "" }
          : d,
    ),
    distributionRules: data.distributionRules.map((r) =>
      catalog === "businessTypes" && r.businessTypeId === id
        ? { ...r, businessTypeId: "", enabled: false }
        : catalog === "sources" && r.source === entry.name
          ? { ...r, source: "", enabled: false }
          : r,
    ),
  };
}
export function toggleSeller(data: CrmData, id: string): CrmData {
  const seller = data.sellers.find((s) => s.id === id);
  if (!seller) throw new Error("Responsável não encontrado.");
  if (seller.active && data.sellers.filter((s) => s.active).length === 1)
    throw new Error("Mantenha pelo menos um responsável ativo.");
  return {
    ...data,
    sellers: data.sellers.map((s) =>
      s.id === id ? { ...s, active: !s.active } : s,
    ),
  };
}
export function saveDistributionRule(
  data: CrmData,
  input: Omit<DistributionRule, "id">,
  id?: string,
): CrmData {
  if (!data.pipelines.some((p) => p.id === input.pipelineId))
    throw new Error("Escolha um funil válido.");
  if (id && !data.distributionRules.some((r) => r.id === id))
    throw new Error("Regra não encontrada.");
  const rule = { ...input, id: id || newId(), name: input.name.trim() };
  const rules = data.distributionRules.map((r) =>
    input.isDefault && r.id !== id ? { ...r, isDefault: false } : r,
  );
  return {
    ...data,
    distributionRules: id
      ? rules.map((r) => (r.id === id ? rule : r))
      : [...rules, rule],
  };
}
export function reorderRule(
  data: CrmData,
  id: string,
  offset: number,
): CrmData {
  const list = [...data.distributionRules],
    index = list.findIndex((r) => r.id === id),
    target = index + offset;
  if (index < 0 || target < 0 || target >= list.length) return data;
  [list[index], list[target]] = [list[target], list[index]];
  return { ...data, distributionRules: list };
}
// Shared pure classification engine: future official webhooks can call this
// without importing React. Default rules are considered only after predicates.
export function resolveDistribution(
  data: CrmData,
  input: { businessTypeId: string; source: string },
) {
  const rule =
    data.distributionRules.find(
      (r) =>
        r.enabled &&
        !r.isDefault &&
        (!r.businessTypeId || r.businessTypeId === input.businessTypeId) &&
        (!r.source || r.source === input.source),
    ) || data.distributionRules.find((r) => r.enabled && r.isDefault);
  const pipeline = data.pipelines.find((p) => p.id === rule?.pipelineId);
  return pipeline && rule
    ? { rule, pipeline, stage: pipeline.stages[0] }
    : null;
}
export function simulateIntake(
  data: CrmData,
  input: { name: string; businessTypeId: string; source: string },
): CrmData {
  const target = resolveDistribution(data, input);
  if (!target)
    throw new Error(
      "Nenhuma regra ativa corresponde. Configure uma regra padrão ou escolha o funil manualmente.",
    );
  const owner = data.sellers.find((s) => s.active)!.name;
  const next = saveCustomer(data, {
    name: input.name,
    company: "Contato fictício do simulador",
    email: "",
    phone: "",
  });
  return saveDeal(next, {
    title: `Simulação · ${input.name}`,
    customerId: next.customers.at(-1)!.id,
    value: 0,
    owner,
    source: input.source,
    businessTypeId: input.businessTypeId,
    pipelineId: target.pipeline.id,
    stageId: target.stage.id,
    status: "open",
    priority: "medium",
    notes:
      "Criada pelo simulador interno. Nenhuma mensagem foi recebida ou enviada.",
    expectedCloseDate: "",
  });
}
export function saveScheduledActivity(
  data: CrmData,
  input: ScheduledActivityInput,
  id?: string,
): CrmData {
  const previous = data.scheduledActivities.find((t) => t.id === id);
  if (id && !previous) throw new Error("Atividade não encontrada.");
  const deal = data.deals.find((d) => d.id === input.dealId);
  const task = {
    ...input,
    customerId: deal?.customerId || input.customerId,
    title: input.title.trim(),
    id: id || newId(),
    createdAt: previous?.createdAt || new Date().toISOString(),
    completedAt: previous?.completedAt || "",
  };
  return {
    ...data,
    scheduledActivities: id
      ? data.scheduledActivities.map((t) => (t.id === id ? task : t))
      : [...data.scheduledActivities, task],
  };
}
export function toggleActivity(data: CrmData, id: string): CrmData {
  return {
    ...data,
    scheduledActivities: data.scheduledActivities.map((t) =>
      t.id === id
        ? { ...t, completedAt: t.completedAt ? "" : new Date().toISOString() }
        : t,
    ),
  };
}
export function activityStatus(
  activity: { dueAt: string; completedAt: string; remindBeforeMinutes: number },
  now = Date.now(),
) {
  if (activity.completedAt) return "completed";
  const due = Date.parse(activity.dueAt);
  if (due < now) return "overdue";
  if (due - now <= activity.remindBeforeMinutes * 60_000) return "reminder";
  return "upcoming";
}
// Local BR numbers get country code 55. Explicit +/00 numbers keep their
// country code. Ambiguous or invalid values never produce an external link.
export function whatsappUrl(phone: string): string | null {
  const trimmed = phone.trim();
  if (!trimmed || !/^[+\d\s().-]+$/.test(trimmed)) return null;
  let digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("00")) digits = digits.slice(2);
  else if (
    !trimmed.startsWith("+") &&
    (digits.length === 10 || digits.length === 11)
  )
    digits = "55" + digits;
  else if (!trimmed.startsWith("+") && !digits.startsWith("55")) return null;
  if (!/^[1-9]\d{7,14}$/.test(digits)) return null;
  if (digits.startsWith("55") && !/^55[1-9]\d{9,10}$/.test(digits)) return null;
  return `https://wa.me/${digits}`;
}
export function results(deals: CrmData["deals"]) {
  const won = deals.filter((d) => d.status === "won"),
    lost = deals.filter((d) => d.status === "lost");
  return {
    open: deals.filter((d) => d.status === "open").length,
    won: won.length,
    lost: lost.length,
    total: deals.reduce((s, d) => s + d.value, 0),
    wonValue: won.reduce((s, d) => s + d.value, 0),
    conversion:
      won.length + lost.length
        ? Math.round((won.length / (won.length + lost.length)) * 100)
        : 0,
  };
}
export function namedCatalog(data: CrmData, catalog: Catalog): CatalogEntry[] {
  return data[catalog];
}
