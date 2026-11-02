"use client";

import { getEditToken } from "@/hooks/use-crm";

import { useState } from "react";
import { Building2, Clock3, Plus, Trash2, UserRound } from "lucide-react";
import type {
  CrmData,
  CustomerInput,
  Deal,
  DealInput,
  DealStatus,
  Priority,
} from "@/lib/types";
import { OWNERS, PRIORITY_LABELS, SOURCES, STATUS_LABELS } from "@/lib/types";
import { money } from "@/lib/format";
import { Button, Field, Modal } from "./ui";
import { CustomerDialog } from "./customer-dialog";

export function DealDialog({
  data,
  deal,
  pipelineId: initialPipeline,
  stageId: initialStage,
  onClose,
  onSave,
  onDelete,
  onSaveCustomer,
}: {
  data: CrmData;
  deal?: Deal;
  pipelineId: string;
  stageId?: string;
  onClose: () => void;
  onSave: (
    input: DealInput,
    id?: string,
    editToken?: number,
  ) => Promise<unknown>;
  onDelete: (deal: Deal) => void;
  onSaveCustomer: (
    input: CustomerInput,
    editToken?: number,
  ) => Promise<string | undefined>;
}) {
  const [editToken] = useState(getEditToken);
  const [saving, setSaving] = useState(false);
  const [pipelineId, setPipelineId] = useState(
    deal?.pipelineId || initialPipeline,
  );
  const pipeline =
    data.pipelines.find((p) => p.id === pipelineId) || data.pipelines[0];
  const [stageId, setStageId] = useState(
    deal?.stageId || initialStage || pipeline.stages[0].id,
  );
  const [customerId, setCustomerId] = useState(deal?.customerId || "");
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [status, setStatus] = useState<DealStatus>(deal?.status || "open");
  const customer = data.customers.find((c) => c.id === customerId);
  const history = data.activities
    .filter((a) => a.dealId === deal?.id)
    .slice(-5)
    .reverse();
  return (
    <>
      <Modal
        open
        onOpenChange={(open) => !open && onClose()}
        title={deal ? "Detalhes da oportunidade" : "Nova oportunidade"}
        description={
          deal
            ? "Toda a informação para dar o próximo passo."
            : "O próximo grande negócio começa com uma conversa."
        }
        drawer={!!deal}
        wide
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setSaving(true);
            try {
              await onSave(
                {
                  title: String(f.get("title")).trim(),
                  value: Number(f.get("value")),
                  customerId,
                  pipelineId: pipeline.id,
                  stageId: pipeline.stages.some((s) => s.id === stageId)
                    ? stageId
                    : pipeline.stages[0].id,
                  status,
                  priority: String(f.get("priority")) as Priority,
                  owner: String(f.get("owner")),
                  source: String(f.get("source")),
                  expectedCloseDate: String(f.get("date")),
                  notes: String(f.get("notes")).trim(),
                },
                deal?.id,
                editToken,
              );
            } finally {
              setSaving(false);
            }
          }}
        >
          <div className="dialog-body form-stack">
            {deal && (
              <div className="deal-detail-summary">
                <span className="eyebrow">VALOR DA OPORTUNIDADE</span>
                <strong>{money(deal.value, true)}</strong>
                <span className={`status-badge ${status}`}>
                  {STATUS_LABELS[status]}
                </span>
              </div>
            )}
            <Field label="Título da oportunidade *">
              <input
                name="title"
                autoFocus
                defaultValue={deal?.title}
                required
                maxLength={120}
                placeholder="Ex.: Projeto de expansão"
              />
            </Field>
            <div className="form-grid">
              <Field label="Valor (R$) *">
                <input
                  name="value"
                  type="number"
                  min={0}
                  max={999999999999}
                  step="0.01"
                  defaultValue={deal?.value ?? ""}
                  placeholder="0,00"
                  required
                />
              </Field>
              <Field label="Previsão de fechamento">
                <input
                  name="date"
                  type="date"
                  defaultValue={deal?.expectedCloseDate}
                />
              </Field>
            </div>
            <div className="client-select">
              <Field label="Cliente *">
                <select
                  required
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                >
                  <option value="">Selecione um cliente</option>
                  {data.customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.company ? ` · ${c.company}` : ""}
                    </option>
                  ))}
                </select>
              </Field>
              <Button variant="ghost" onClick={() => setCreatingCustomer(true)}>
                <Plus size={15} /> Cadastrar cliente
              </Button>
            </div>
            {customer && (
              <div className="customer-mini">
                <UserRound size={16} />
                <span>{customer.name}</span>
                {customer.company && (
                  <>
                    <Building2 size={15} />
                    <span>{customer.company}</span>
                  </>
                )}
              </div>
            )}
            <div className="form-grid">
              <Field label="Funil">
                <select
                  value={pipeline.id}
                  onChange={(e) => {
                    setPipelineId(e.target.value);
                    setStageId(
                      data.pipelines.find((p) => p.id === e.target.value)!
                        .stages[0].id,
                    );
                  }}
                >
                  {data.pipelines.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Etapa">
                <select
                  value={
                    pipeline.stages.some((s) => s.id === stageId)
                      ? stageId
                      : pipeline.stages[0].id
                  }
                  onChange={(e) => setStageId(e.target.value)}
                >
                  {pipeline.stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="form-grid">
              <Field label="Responsável">
                <select name="owner" defaultValue={deal?.owner || OWNERS[0]}>
                  {Array.from(
                    new Set([...OWNERS, ...(deal ? [deal.owner] : [])]),
                  ).map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </Field>
              <Field label="Prioridade">
                <select
                  name="priority"
                  defaultValue={deal?.priority || "medium"}
                >
                  {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="form-grid">
              <Field label="Status">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as DealStatus)}
                >
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Origem">
                <select name="source" defaultValue={deal?.source || SOURCES[0]}>
                  {Array.from(
                    new Set([...SOURCES, ...(deal ? [deal.source] : [])]),
                  ).map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Anotações">
              <textarea
                name="notes"
                rows={3}
                maxLength={10000}
                defaultValue={deal?.notes}
                placeholder="Contexto, próximos passos e o que você precisa lembrar..."
              />
            </Field>
            {deal && history.length > 0 && (
              <section className="activity-section">
                <h3>
                  <Clock3 size={16} /> Últimas atividades
                </h3>
                {history.map((a) => (
                  <div className="activity-item" key={a.id}>
                    <span className="activity-dot" />
                    <div>
                      <p>{a.text}</p>
                      <time>
                        {new Intl.DateTimeFormat("pt-BR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        }).format(new Date(a.createdAt))}
                      </time>
                    </div>
                  </div>
                ))}
              </section>
            )}
          </div>
          <div className="dialog-footer">
            {deal && (
              <Button
                variant="ghost"
                className="danger-text delete-deal"
                onClick={() => onDelete(deal)}
              >
                <Trash2 size={16} />
                <span>Excluir</span>
              </Button>
            )}
            <Button onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving} variant="primary">
              {deal ? "Salvar alterações" : "Criar oportunidade"}
            </Button>
          </div>
        </form>
      </Modal>
      {creatingCustomer && (
        <CustomerDialog
          onClose={() => setCreatingCustomer(false)}
          onSave={async (input, _id, token) => {
            const id = await onSaveCustomer(input, token);
            if (id) {
              setCustomerId(id);
              setCreatingCustomer(false);
            }
          }}
        />
      )}
    </>
  );
}
