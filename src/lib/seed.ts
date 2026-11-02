import type { CrmData, Deal, Pipeline } from "./types";
import { localDate } from "./format";

export function createSeedData(): CrmData {
  const now = new Date().toISOString();
  const date = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return localDate(d);
  };
  const pipelines: Pipeline[] = [
    {
      id: "pipeline-sales",
      name: "Funil de vendas",
      description: "Da primeira conversa ao próximo grande negócio.",
      stages: [
        { id: "stage-lead", name: "Novo lead", probability: 10 },
        { id: "stage-qualified", name: "Qualificação", probability: 25 },
        { id: "stage-proposal", name: "Proposta enviada", probability: 50 },
        { id: "stage-negotiation", name: "Negociação", probability: 75 },
        { id: "stage-closing", name: "Fechamento", probability: 90 },
      ],
    },
    {
      id: "pipeline-partners",
      name: "Parcerias",
      description: "Conexões que fazem o negócio crescer.",
      stages: [
        { id: "partner-contact", name: "Primeiro contato", probability: 15 },
        { id: "partner-meeting", name: "Reunião", probability: 50 },
        { id: "partner-agreement", name: "Acordo", probability: 85 },
      ],
    },
  ];
  const customers = [
    ["Ana Oliveira", "Aurora Design", "ana@aurora.example", "(11) 99910-2040"],
    [
      "Rafael Martins",
      "Órbita Tecnologia",
      "rafael@orbita.example",
      "(11) 99920-3010",
    ],
    [
      "Camila Souza",
      "Lumina Saúde",
      "camila@lumina.example",
      "(21) 99810-4420",
    ],
    ["Pedro Almeida", "Nexo Digital", "pedro@nexo.example", "(31) 99770-1230"],
    [
      "Juliana Lima",
      "Casa Verde",
      "juliana@casaverde.example",
      "(11) 99980-5540",
    ],
    [
      "Bruno Costa",
      "Horizonte Educação",
      "bruno@horizonte.example",
      "(41) 99800-6600",
    ],
    [
      "Mariana Santos",
      "Vértice Arquitetura",
      "mariana@vertice.example",
      "(21) 99940-7700",
    ],
    ["Felipe Rocha", "Café Origem", "felipe@origem.example", "(19) 99850-8810"],
    [
      "Beatriz Ribeiro",
      "Alma Studio",
      "beatriz@alma.example",
      "(11) 99830-9920",
    ],
    [
      "Lucas Ferreira",
      "Atlas Logística",
      "lucas@atlas.example",
      "(51) 99910-1020",
    ],
  ].map(([name, company, email, phone], i) => ({
    id: `customer-${i}`,
    name,
    company,
    email,
    phone,
    createdAt: now,
  }));
  const rows: [
    string,
    number,
    number,
    string,
    Deal["priority"],
    number,
    string,
  ][] = [
    [
      "Nova identidade e website",
      8500,
      0,
      "stage-lead",
      "high",
      7,
      "Paulo Kleyzer",
    ],
    [
      "Expansão do plano Enterprise",
      28000,
      1,
      "stage-lead",
      "medium",
      12,
      "Marina Costa",
    ],
    [
      "Plataforma de agendamentos",
      15800,
      2,
      "stage-lead",
      "medium",
      15,
      "Lucas Santos",
    ],
    [
      "Consultoria de crescimento",
      12000,
      3,
      "stage-qualified",
      "high",
      5,
      "Paulo Kleyzer",
    ],
    [
      "E-commerce Casa Verde",
      24500,
      4,
      "stage-qualified",
      "low",
      20,
      "Marina Costa",
    ],
    [
      "Portal de cursos online",
      32000,
      5,
      "stage-proposal",
      "high",
      -2,
      "Paulo Kleyzer",
    ],
    [
      "Site e portfólio digital",
      9800,
      6,
      "stage-proposal",
      "medium",
      8,
      "Lucas Santos",
    ],
    [
      "Programa de fidelidade",
      6500,
      7,
      "stage-negotiation",
      "medium",
      3,
      "Marina Costa",
    ],
    [
      "Gestão de projetos criativos",
      14200,
      8,
      "stage-negotiation",
      "high",
      4,
      "Paulo Kleyzer",
    ],
    [
      "Automação de operações",
      42000,
      9,
      "stage-closing",
      "high",
      2,
      "Lucas Santos",
    ],
  ];
  const deals: Deal[] = rows.map(
    ([title, value, c, stageId, priority, offset, owner], i) => ({
      id: `deal-${i}`,
      title,
      value,
      customerId: `customer-${c}`,
      pipelineId: "pipeline-sales",
      stageId,
      status: "open",
      priority,
      owner,
      source: i % 2 === 0 ? "Indicação" : "Site",
      businessTypeId: "",
      expectedCloseDate: date(offset),
      notes:
        "Oportunidade fictícia para explorar o CRM. Edite os detalhes e acompanhe a evolução nas etapas.",
      position: i,
      createdAt: now,
      updatedAt: now,
    }),
  );
  deals.push({
    ...deals[0],
    id: "deal-won",
    title: "Diagnóstico de marca",
    value: 4500,
    stageId: "stage-closing",
    status: "won",
    position: 11,
  });
  deals.push({
    ...deals[1],
    id: "deal-partner",
    title: "Parceria de soluções digitais",
    pipelineId: "pipeline-partners",
    stageId: "partner-contact",
    value: 18000,
    position: 0,
  });
  return {
    schemaVersion: 2,
    businessTypes: [],
    sources: [...new Set(deals.map((d) => d.source))]
      .sort()
      .map((name, i) => ({ id: `seed-source-${i}`, name })),
    sellers: [...new Set(deals.map((d) => d.owner))]
      .sort()
      .map((name, i) => ({ id: `seed-seller-${i}`, name, active: true })),
    distributionRules: [],
    scheduledActivities: [],
    pipelines,
    customers,
    deals,
    activities: deals.map((d, i) => ({
      id: `activity-seed-${i}`,
      dealId: d.id,
      text: "Oportunidade criada",
      createdAt: now,
    })),
  };
}
