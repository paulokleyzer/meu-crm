export type DealStatus = "open" | "won" | "lost";
export type Priority = "low" | "medium" | "high";

export interface Stage {
  id: string;
  name: string;
  probability: number;
}
export interface Pipeline {
  id: string;
  name: string;
  description: string;
  stages: Stage[];
}
export interface Customer {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  createdAt: string;
}
export interface Deal {
  id: string;
  title: string;
  value: number;
  customerId: string;
  pipelineId: string;
  stageId: string;
  status: DealStatus;
  priority: Priority;
  owner: string;
  source: string;
  expectedCloseDate: string;
  notes: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}
export interface Activity {
  id: string;
  dealId: string;
  text: string;
  createdAt: string;
}
export interface CrmData {
  schemaVersion: 1;
  pipelines: Pipeline[];
  customers: Customer[];
  deals: Deal[];
  activities: Activity[];
}

export type DealInput = Omit<
  Deal,
  "id" | "createdAt" | "updatedAt" | "position"
>;
export type CustomerInput = Omit<Customer, "id" | "createdAt">;
export type PipelineInput = Omit<Pipeline, "id">;
export interface DealFilters {
  query: string;
  owner: string;
  priority: string;
  status: DealStatus | "all";
  due: string;
}

export const OWNERS = ["Paulo Kleyzer", "Marina Costa", "Lucas Santos"];
export const SOURCES = [
  "Site",
  "Indicação",
  "Prospecção",
  "Redes sociais",
  "Evento",
  "Outro",
];
export const STATUS_LABELS: Record<DealStatus, string> = {
  open: "Em aberto",
  won: "Ganho",
  lost: "Perdido",
};
export const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
};
