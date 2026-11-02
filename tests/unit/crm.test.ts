import { describe, expect, it } from "vitest";
import {
  createPipeline,
  deleteDeal,
  deletePipeline,
  duplicatePipeline,
  filterDeals,
  moveDeal,
  saveCustomer,
  saveDeal,
  updatePipeline,
} from "@/lib/crm";
import { createSeedData } from "@/lib/seed";
import { parseCrmData } from "@/lib/schema";
import { LocalCrmRepository, STORAGE_KEY } from "@/lib/repository";
import { localDate, money } from "@/lib/format";
import type { CrmData, DealFilters, DealInput } from "@/lib/types";

const filters: DealFilters = {
  query: "",
  owner: "",
  status: "open",
  priority: "",
  due: "",
};
function input(data: CrmData): DealInput {
  const {
    id: _id,
    position: _position,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...fields
  } = data.deals[0];
  void [_id, _position, _createdAt, _updatedAt];
  return fields;
}

describe("funis e integridade das oportunidades", () => {
  it("inicia com dados de demonstração íntegros", () => {
    const d = createSeedData();
    expect(parseCrmData(d)).toEqual(d);
    expect(d.deals.length).toBeGreaterThan(0);
  });
  it("cria um funil sem modificar os dados originais", () => {
    const d = createSeedData();
    const n = createPipeline(d, {
      name: "Pós-venda",
      description: "",
      stages: [{ id: "new-stage", name: "Onboarding", probability: 10 }],
    });
    expect(n.pipelines).toHaveLength(3);
    expect(d.pipelines).toHaveLength(2);
    expect(parseCrmData(n)).toEqual(n);
  });
  it("duplica apenas a estrutura com identificadores novos e nomes únicos", () => {
    const d = createSeedData();
    const n = duplicatePipeline(
      duplicatePipeline(d, d.pipelines[0].id),
      d.pipelines[0].id,
    );
    expect(n.pipelines[2].name).toBe("Funil de vendas (cópia)");
    expect(n.pipelines[3].name).toBe("Funil de vendas (cópia 2)");
    expect(n.pipelines[2].stages[0].id).not.toBe(d.pipelines[0].stages[0].id);
    expect(n.deals).toEqual(d.deals);
    parseCrmData(n);
  });
  it("renomeia e reordena etapas preservando as referências dos cartões", () => {
    const d = createSeedData(),
      p = d.pipelines[0];
    const n = updatePipeline(d, p.id, {
      ...p,
      stages: [...p.stages]
        .reverse()
        .map((s) => ({ ...s, name: `Etapa ${s.name}` })),
    });
    expect(n.pipelines[0].stages[0].id).toBe(p.stages.at(-1)!.id);
    expect(n.deals).toEqual(d.deals);
  });
  it("transfere negócios de uma etapa excluída e registra o movimento", () => {
    const d = createSeedData(),
      p = d.pipelines[0];
    const n = updatePipeline(d, p.id, { ...p, stages: p.stages.slice(1) });
    expect(n.deals).toHaveLength(d.deals.length);
    expect(n.deals.filter((x) => x.stageId === "stage-lead")).toHaveLength(0);
    expect(n.deals.find((x) => x.id === "deal-0")!.stageId).toBe(
      "stage-qualified",
    );
    expect(n.activities.length).toBeGreaterThan(d.activities.length);
    parseCrmData(n);
  });
  it("impede um funil sem etapas", () => {
    const d = createSeedData();
    expect(() =>
      updatePipeline(d, d.pipelines[0].id, { ...d.pipelines[0], stages: [] }),
    ).toThrow("pelo menos uma etapa");
  });
  it("exclui funil transferindo todos os negócios, inclusive ganhos", () => {
    const d = createSeedData();
    const n = deletePipeline(d, "pipeline-sales", "pipeline-partners");
    expect(n.deals).toHaveLength(d.deals.length);
    expect(n.deals.every((x) => x.pipelineId === "pipeline-partners")).toBe(
      true,
    );
    expect(n.deals.find((x) => x.id === "deal-won")!.status).toBe("won");
    expect(n.pipelines).toHaveLength(1);
    parseCrmData(n);
  });
  it("impede excluir o último funil ou usar destino inválido", () => {
    const d = createSeedData();
    expect(() => deletePipeline(d, "pipeline-sales", "pipeline-sales")).toThrow(
      "destino",
    );
    const n = deletePipeline(d, "pipeline-sales", "pipeline-partners");
    expect(() => deletePipeline(n, "pipeline-partners", "none")).toThrow(
      "pelo menos um funil",
    );
  });
});

describe("movimentação e cadastro", () => {
  it("preserva os centavos na apresentação dos valores", () => {
    expect(money(14990.5)).toContain("14.990,50");
    expect(money(14990)).toContain("14.990");
    expect(money(14990, true)).toContain("14.990,00");
  });
  it("move uma oportunidade para uma coluna vazia sem perder os detalhes", () => {
    const d = createSeedData();
    const n = moveDeal(d, "deal-0", "partner-agreement");
    const deal = n.deals.find((x) => x.id === "deal-0")!;
    expect(deal).toMatchObject({
      stageId: "partner-agreement",
      pipelineId: "pipeline-partners",
      title: d.deals[0].title,
      value: d.deals[0].value,
    });
    expect(deal.position).toBe(0);
    expect(d.deals[0].stageId).toBe("stage-lead");
    parseCrmData(n);
  });
  it("reordena negócios na mesma etapa sem duplicar cartões", () => {
    const d = createSeedData();
    const n = moveDeal(d, "deal-2", "stage-lead", "deal-0");
    expect(
      n.deals
        .filter((x) => x.stageId === "stage-lead")
        .sort((a, b) => a.position - b.position)
        .map((d) => d.id),
    ).toEqual(["deal-2", "deal-0", "deal-1"]);
    expect(n.deals).toHaveLength(d.deals.length);
    expect(n.activities).toHaveLength(d.activities.length);
  });
  it("rejeita destinos inexistentes", () => {
    expect(() => moveDeal(createSeedData(), "deal-0", "missing")).toThrow();
  });
  it("acrescenta novos negócios depois dos existentes mesmo com posições espaçadas", () => {
    const d = createSeedData();
    const n = saveDeal(d, {
      ...input(d),
      title: "Novo negócio",
      stageId: "stage-qualified",
    });
    const deal = n.deals.at(-1)!;
    expect(deal.position).toBeGreaterThan(
      Math.max(
        ...d.deals
          .filter((x) => x.stageId === "stage-qualified")
          .map((x) => x.position),
      ),
    );
    expect(n.activities.at(-1)!.dealId).toBe(deal.id);
  });
  it("edita valor, responsável, notas e status", () => {
    const d = createSeedData();
    const n = saveDeal(
      d,
      {
        ...input(d),
        value: 1234.56,
        status: "won",
        notes: "Contrato assinado",
        owner: "Marina Costa",
      },
      "deal-0",
    );
    expect(n.deals[0]).toMatchObject({
      value: 1234.56,
      status: "won",
      notes: "Contrato assinado",
      owner: "Marina Costa",
    });
    expect(n.deals[0].createdAt).toBe(d.deals[0].createdAt);
    expect(n.deals).toHaveLength(d.deals.length);
  });
  it("rejeita um negócio sem cliente ou em uma etapa de outro funil", () => {
    const d = createSeedData();
    expect(() => saveDeal(d, { ...input(d), customerId: "missing" })).toThrow(
      "cliente",
    );
    expect(() =>
      saveDeal(d, { ...input(d), stageId: "partner-contact" }),
    ).toThrow("etapa");
  });
  it("cadastra e edita clientes preservando negócios vinculados", () => {
    const d = createSeedData();
    const customer = {
      name: "Novo cliente",
      company: "Empresa",
      email: "teste@example.com",
      phone: "11999999999",
    };
    const n = saveCustomer(d, customer);
    expect(n.customers).toHaveLength(d.customers.length + 1);
    const edited = saveCustomer(
      n,
      { ...customer, name: "Outro nome" },
      "customer-0",
    );
    expect(edited.customers[0].name).toBe("Outro nome");
    expect(edited.deals).toEqual(d.deals);
  });
  it("exclui oportunidade e histórico, mantendo o cliente", () => {
    const d = createSeedData();
    const n = deleteDeal(d, "deal-0");
    expect(n.deals.some((x) => x.id === "deal-0")).toBe(false);
    expect(n.activities.some((x) => x.dealId === "deal-0")).toBe(false);
    expect(n.customers).toEqual(d.customers);
  });
});

describe("pesquisa e filtros", () => {
  it("busca empresa ignorando acentos e maiúsculas", () => {
    const d = createSeedData();
    expect(
      filterDeals(d, "pipeline-sales", { ...filters, query: "ORBITA" }).map(
        (d) => d.id,
      ),
    ).toEqual(["deal-1"]);
  });
  it("combina responsável, prioridade e status", () => {
    const d = createSeedData();
    const result = filterDeals(d, "pipeline-sales", {
      ...filters,
      owner: "Paulo Kleyzer",
      priority: "high",
    });
    expect(result.length).toBeGreaterThan(0);
    expect(
      result.every(
        (d) =>
          d.owner === "Paulo Kleyzer" &&
          d.priority === "high" &&
          d.status === "open",
      ),
    ).toBe(true);
  });
  it("filtra apenas negócios em aberto com fechamento em atraso", () => {
    const result = filterDeals(createSeedData(), "pipeline-sales", {
      ...filters,
      due: "overdue",
      status: "all",
    });
    expect(result).toHaveLength(1);
    expect(result[0].expectedCloseDate < localDate()).toBe(true);
  });
});

describe("persistência e backups", () => {
  function memory() {
    const values = new Map<string, string>();
    return {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };
  }
  it("salva e restaura dados com movimentos e edições", () => {
    const storage = memory(),
      repo = new LocalCrmRepository(storage);
    expect(repo.load()).toBeNull();
    const d = moveDeal(createSeedData(), "deal-0", "stage-closing");
    repo.save(d);
    expect(new LocalCrmRepository(storage).load()).toEqual(d);
  });
  it("não sobrescreve um backup corrompido ao tentar ler", () => {
    const storage = memory();
    storage.setItem(STORAGE_KEY, "corrompido");
    expect(() => new LocalCrmRepository(storage).load()).toThrow();
    expect(storage.getItem(STORAGE_KEY)).toBe("corrompido");
  });
  it("rejeita versão incompatível, valores inválidos e referências órfãs", () => {
    const d = createSeedData();
    expect(() => parseCrmData({ ...d, schemaVersion: 2 })).toThrow();
    expect(() =>
      parseCrmData({ ...d, deals: [{ ...d.deals[0], value: -1 }] }),
    ).toThrow();
    expect(() => parseCrmData({ ...d, customers: [] })).toThrow();
    expect(() =>
      parseCrmData({ ...d, deals: [...d.deals, d.deals[0]] }),
    ).toThrow();
  });
  it("propaga falhas de gravação para a interface avisar sobre dados não salvos", () => {
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    expect(() =>
      new LocalCrmRepository(storage).save(createSeedData()),
    ).toThrow("QuotaExceededError");
  });
});
