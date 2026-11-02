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
  businessTypeId: string;
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
  schemaVersion: 2;
  pipelines: Pipeline[];
  customers: Customer[];
  deals: Deal[];
  activities: Activity[];
  businessTypes: CatalogEntry[];
  sources: CatalogEntry[];
  sellers: Seller[];
  distributionRules: DistributionRule[];
  scheduledActivities: ScheduledActivity[];
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
  businessTypeId?: string;
  source?: string;
}

export interface CatalogEntry {
  id: string;
  name: string;
}
export interface Seller extends CatalogEntry {
  active: boolean;
}
export interface DistributionRule {
  id: string;
  name: string;
  businessTypeId: string;
  source: string;
  pipelineId: string;
  enabled: boolean;
  isDefault: boolean;
}
export interface ScheduledActivity {
  id: string;
  title: string;
  type: "task" | "call" | "meeting" | "follow_up";
  dueAt: string;
  customerId: string;
  dealId: string;
  owner: string;
  completedAt: string;
  notes: string;
  remindBeforeMinutes: number;
  createdAt: string;
}
export type ScheduledActivityInput = Omit<
  ScheduledActivity,
  "id" | "createdAt" | "completedAt"
>;
export const ACTIVITY_LABELS = {
  task: "Tarefa",
  call: "Ligação",
  meeting: "Reunião",
  follow_up: "Retorno comercial",
} as const;
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
