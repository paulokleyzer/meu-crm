import { describe, expect, it } from "vitest";
import { createSeedData } from "@/lib/seed";
import { deleteDeal, deletePipeline, filterDeals, saveDeal } from "@/lib/crm";
import { parseCrmData } from "@/lib/schema";
import {
  activityStatus,
  deleteCatalog,
  reorderRule,
  resolveDistribution,
  results,
  saveCatalog,
  saveDistributionRule,
  saveScheduledActivity,
  simulateIntake,
  toggleActivity,
  toggleSeller,
  whatsappUrl,
} from "@/lib/crm-v2";
import type { CrmData } from "@/lib/types";
function configured() {
  const data = saveCatalog(
    createSeedData(),
    "businessTypes",
    "Motos elétricas",
  );
  return saveDistributionRule(data, {
    name: "Motos por indicação",
    businessTypeId: data.businessTypes[0].id,
    source: "Indicação",
    pipelineId: "pipeline-partners",
    enabled: true,
    isDefault: false,
  });
}
import { legacyBackup } from "../legacy-backup";
describe("cadastros configuráveis e compatibilidade", () => {
  it("importa backups v1 preservando nomes livres, IDs e todos os registros", () => {
    const old = legacyBackup();
    old.deals[0].source = "Campanha livre 2026";
    old.deals[0].owner = "Vendedor anterior";
    const migrated = parseCrmData(old);
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.deals[0]).toMatchObject({
      ...old.deals[0],
      businessTypeId: "",
    });
    expect(migrated.sources.some((s) => s.name === "Campanha livre 2026")).toBe(
      true,
    );
    expect(migrated.sellers.some((s) => s.name === "Vendedor anterior")).toBe(
      true,
    );
    expect(migrated.pipelines).toEqual(old.pipelines);
  });
  it("importa um backup anterior vazio com um responsável inicial configurável", () => {
    const old = legacyBackup();
    old.deals = [];
    old.customers = [];
    old.activities = [];
    expect(parseCrmData(old).sellers[0]).toMatchObject({
      name: "Equipe",
      active: true,
    });
  });
  it("renomeia origens e responsáveis propagando referências", () => {
    let data = configured();
    data = saveCatalog(
      data,
      "sources",
      "Indicação personalizada",
      data.sources.find((s) => s.name === "Indicação")!.id,
    );
    expect(data.deals[0].source).toBe("Indicação personalizada");
    expect(data.distributionRules[0].source).toBe("Indicação personalizada");
    const seller = data.sellers.find((s) => s.name === data.deals[0].owner)!;
    data = saveCatalog(data, "sellers", "Equipe comercial", seller.id);
    expect(data.deals[0].owner).toBe("Equipe comercial");
    parseCrmData(data);
  });
  it("remove categoria sem excluir oportunidades e desativa regras afetadas", () => {
    let data = configured();
    data.deals[0].businessTypeId = data.businessTypes[0].id;
    data = deleteCatalog(data, "businessTypes", data.businessTypes[0].id);
    expect(data.deals).toHaveLength(12);
    expect(data.deals[0].businessTypeId).toBe("");
    expect(data.distributionRules[0].enabled).toBe(false);
    parseCrmData(data);
  });
  it("remove origem sem excluir oportunidades nem tornar uma regra genérica ativa", () => {
    const data = deleteCatalog(
      configured(),
      "sources",
      configured().sources.find((s) => s.name === "Indicação")!.id,
    );
    expect(data.deals[0].source).toBe("");
    expect(data.distributionRules[0]).toMatchObject({
      enabled: false,
      source: "",
    });
    parseCrmData(data);
  });
  it("desativa responsáveis preservando os negócios e impede desativar todos", () => {
    let data = createSeedData();
    for (const seller of data.sellers.slice(1))
      data = toggleSeller(data, seller.id);
    expect(data.deals).toHaveLength(12);
    expect(() => toggleSeller(data, data.sellers[0].id)).toThrow(
      "pelo menos um",
    );
    parseCrmData(data);
  });
  it("rejeita nomes repetidos, classificações órfãs e v2 incompleto", () => {
    const data = configured();
    expect(() => saveCatalog(data, "businessTypes", "motos elétricas")).toThrow(
      "Já existe",
    );
    expect(() =>
      parseCrmData({
        ...data,
        distributionRules: [
          { ...data.distributionRules[0], businessTypeId: "missing" },
        ],
      }),
    ).toThrow();
    expect(() => parseCrmData({ ...data, sellers: [] })).toThrow();
  });
});
describe("distribuição automática e escolha manual", () => {
  it("combina tipo e origem de forma independente", () => {
    const data = configured(),
      businessTypeId = data.businessTypes[0].id;
    expect(
      resolveDistribution(data, { businessTypeId, source: "Indicação" })
        ?.pipeline.id,
    ).toBe("pipeline-partners");
    expect(
      resolveDistribution(data, { businessTypeId, source: "Site" }),
    ).toBeNull();
    expect(
      resolveDistribution(data, { businessTypeId: "", source: "Indicação" }),
    ).toBeNull();
  });
  it("respeita prioridade, desativação e regra padrão", () => {
    let data = configured();
    data = saveDistributionRule(data, {
      name: "Padrão",
      businessTypeId: "",
      source: "",
      pipelineId: "pipeline-sales",
      enabled: true,
      isDefault: true,
    });
    data = saveDistributionRule(data, {
      ...data.distributionRules[0],
      name: "Segunda correspondência",
      pipelineId: "pipeline-sales",
    });
    const input = {
      businessTypeId: data.businessTypes[0].id,
      source: "Indicação",
    };
    expect(resolveDistribution(data, input)?.rule.name).toBe(
      "Motos por indicação",
    );
    data = reorderRule(data, data.distributionRules[2].id, -2);
    expect(resolveDistribution(data, input)?.rule.name).toBe(
      "Segunda correspondência",
    );
    data.distributionRules = data.distributionRules.map((r) =>
      r.isDefault ? r : { ...r, enabled: false },
    );
    expect(resolveDistribution(data, input)?.rule.name).toBe("Padrão");
  });
  it("permite apenas uma regra padrão e mantém a seleção manual do funil", () => {
    let data = configured();
    data = saveDistributionRule(data, {
      ...data.distributionRules[0],
      isDefault: true,
      name: "Padrão A",
    });
    data = saveDistributionRule(data, {
      ...data.distributionRules[0],
      isDefault: true,
      name: "Padrão B",
    });
    expect(data.distributionRules.filter((r) => r.isDefault)).toHaveLength(1);
    const next = saveDeal(
      data,
      {
        ...data.deals[0],
        businessTypeId: data.businessTypes[0].id,
        pipelineId: "pipeline-sales",
        stageId: "stage-qualified",
      },
      "deal-0",
    );
    expect(next.deals[0].stageId).toBe("stage-qualified");
    parseCrmData(next);
  });
  it("simula um contato e cria cliente e oportunidade no destino correto", () => {
    const data = configured(),
      next = simulateIntake(data, {
        name: "Contato de teste",
        businessTypeId: data.businessTypes[0].id,
        source: "Indicação",
      });
    expect(next.customers).toHaveLength(11);
    expect(next.deals.at(-1)).toMatchObject({
      pipelineId: "pipeline-partners",
      stageId: "partner-contact",
      source: "Indicação",
      businessTypeId: data.businessTypes[0].id,
    });
    parseCrmData(next);
  });
  it("desativa regras do funil excluído preservando oportunidades e configuração", () => {
    const next = deletePipeline(
      configured(),
      "pipeline-partners",
      "pipeline-sales",
    );
    expect(next.distributionRules[0]).toMatchObject({
      enabled: false,
      pipelineId: "pipeline-sales",
    });
    expect(next.deals).toHaveLength(12);
    parseCrmData(next);
  });
  it("filtra simultaneamente por tipo e origem", () => {
    const data = configured();
    data.deals[0].businessTypeId = data.businessTypes[0].id;
    expect(
      filterDeals(data, "pipeline-sales", {
        query: "",
        status: "all",
        owner: "",
        priority: "",
        due: "",
        businessTypeId: data.businessTypes[0].id,
        source: "Indicação",
      }).map((d) => d.id),
    ).toEqual(["deal-0"]);
  });
});
function scheduled(data: CrmData) {
  return saveScheduledActivity(data, {
    title: "Retorno de teste",
    type: "follow_up",
    dueAt: "2026-01-02T12:00:00.000Z",
    dealId: "deal-0",
    customerId: "",
    owner: data.deals[0].owner,
    notes: "Ligar para confirmar",
    remindBeforeMinutes: 15,
  });
}
describe("agenda, lembretes e indicadores", () => {
  it("agenda, conclui e reabre sem apagar a oportunidade", () => {
    let data = scheduled(createSeedData());
    const id = data.scheduledActivities[0].id;
    expect(data.scheduledActivities[0].customerId).toBe("customer-0");
    data = toggleActivity(data, id);
    expect(data.scheduledActivities[0].completedAt).not.toBe("");
    data = toggleActivity(data, id);
    expect(data.scheduledActivities[0].completedAt).toBe("");
    parseCrmData(data);
  });
  it("preserva o compromisso vinculado ao cliente ao excluir o negócio", () => {
    const data = deleteDeal(scheduled(createSeedData()), "deal-0");
    expect(data.scheduledActivities[0]).toMatchObject({
      dealId: "",
      customerId: "customer-0",
    });
    parseCrmData(data);
  });
  it("atualiza o cliente da atividade quando o cliente do negócio muda", () => {
    const data = scheduled(createSeedData());
    const next = saveDeal(
      data,
      { ...data.deals[0], customerId: "customer-1" },
      "deal-0",
    );
    expect(next.scheduledActivities[0].customerId).toBe("customer-1");
    parseCrmData(next);
  });
  it("distingue futuras, lembretes, atrasadas e concluídas pelo horário", () => {
    const task = scheduled(createSeedData()).scheduledActivities[0],
      due = Date.parse(task.dueAt);
    expect(activityStatus(task, due - 3600000)).toBe("upcoming");
    expect(activityStatus(task, due - 600000)).toBe("reminder");
    expect(activityStatus(task, due + 1)).toBe("overdue");
    expect(activityStatus({ ...task, completedAt: task.dueAt }, due + 1)).toBe(
      "completed",
    );
  });
  it("calcula ganhos, perdas, valor e conversão com denominador explícito", () => {
    const data = createSeedData();
    data.deals[0].status = "lost";
    const r = results(data.deals);
    expect(r).toMatchObject({ won: 1, lost: 1, open: 10, conversion: 50 });
    expect(r.total).toBe(data.deals.reduce((s, d) => s + d.value, 0));
  });
  it("gera links oficiais com DDI e rejeita telefones ambíguos ou inválidos", () => {
    expect(whatsappUrl("(11) 99910-2040")).toBe("https://wa.me/5511999102040");
    expect(whatsappUrl("+1 (415) 555-0123")).toBe("https://wa.me/14155550123");
    expect(whatsappUrl("0044 20 7946 0958")).toBe("https://wa.me/442079460958");
    expect(whatsappUrl("5511999102040")).toBe("https://wa.me/5511999102040");
    for (const value of [
      "",
      "abc123",
      "123",
      "javascript:alert(1)",
      "+55 01 99999-0000",
    ])
      expect(whatsappUrl(value)).toBeNull();
  });
});
