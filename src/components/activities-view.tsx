"use client";

import { useState } from "react";
import { CalendarDays, Check, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { CrmData, ScheduledActivity } from "@/lib/types";
import { ACTIVITY_LABELS } from "@/lib/types";
import type { UpdateCrm } from "@/lib/api-types";
import { getEditToken } from "@/hooks/use-crm";
import {
  activityStatus,
  saveScheduledActivity,
  toggleActivity,
} from "@/lib/crm-v2";
import { Button, Field, IconButton, Modal } from "./ui";

export function ActivitiesView({
  data,
  update,
  now,
  onSchedule,
}: {
  data: CrmData;
  update: UpdateCrm;
  now: number;
  onSchedule: (activity?: ScheduledActivity) => void;
}) {
  const [filter, setFilter] = useState("pending"),
    [owner, setOwner] = useState("");
  const [remove, setRemove] = useState<{ id: string; token: number } | null>(
    null,
  );
  const list = data.scheduledActivities
    .filter(
      (t) =>
        (!owner || t.owner === owner) &&
        (filter === "all" ||
          (filter === "pending" && !t.completedAt) ||
          (filter === "overdue" && activityStatus(t, now) === "overdue") ||
          (filter === "upcoming" &&
            !t.completedAt &&
            Date.parse(t.dueAt) >= now) ||
          (filter === "completed" && !!t.completedAt)),
    )
    .sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
  const reminders = data.scheduledActivities.filter((t) =>
    ["overdue", "reminder"].includes(activityStatus(t, now)),
  );
  return (
    <div className="customers-view activities-view">
      <div className="page-intro">
        <div>
          <span className="eyebrow">PRÓXIMOS PASSOS</span>
          <h1>Atividades</h1>
          <p>
            Sua agenda de tarefas, ligações, reuniões e retornos comerciais.
          </p>
        </div>
        <Button variant="primary" onClick={() => onSchedule()}>
          <Plus size={17} />
          Nova atividade
        </Button>
      </div>
      <div className="notice">
        <CalendarDays size={18} />
        <span>
          {reminders.length
            ? `${reminders.length} atividade(s) com lembrete ou atraso.`
            : "Nenhum lembrete pendente agora."}{" "}
          Os lembretes aparecem dentro do CRM enquanto ele estiver aberto.
        </span>
      </div>
      <div className="activity-filters form-grid">
        <Field label="Visualizar atividades">
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="pending">Pendentes</option>
            <option value="upcoming">Futuras</option>
            <option value="overdue">Vencidas</option>
            <option value="completed">Concluídas</option>
            <option value="all">Todas</option>
          </select>
        </Field>
        <Field label="Filtrar atividades por responsável">
          <select value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="">Todos os responsáveis</option>
            {data.sellers.map((s) => (
              <option key={s.id}>{s.name}</option>
            ))}
          </select>
        </Field>
      </div>
      <div className="settings-list">
        {list.map((task) => {
          const status = activityStatus(task, now);
          return (
            <article
              key={task.id}
              className={`settings-row agenda-row ${status}`}
              data-testid={`activity-${task.id}`}
            >
              <div>
                <h2>{task.title}</h2>
                <p>
                  {ACTIVITY_LABELS[task.type]} · {task.owner}
                </p>
                <time dateTime={task.dueAt}>
                  {new Intl.DateTimeFormat("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  }).format(new Date(task.dueAt))}
                </time>
                <p>
                  {data.customers.find((c) => c.id === task.customerId)?.name}{" "}
                  {task.dealId &&
                    `· ${data.deals.find((d) => d.id === task.dealId)?.title}`}
                </p>
                <span className={`activity-badge ${status}`}>
                  {status === "completed"
                    ? "Concluída"
                    : status === "overdue"
                      ? "Atividade atrasada"
                      : status === "reminder"
                        ? "Lembrete: está chegando"
                        : "Agendada"}
                </span>
                {task.notes && <p>{task.notes}</p>}
              </div>
              <div className="row-actions">
                <Button
                  onClick={() =>
                    void update((d) => toggleActivity(d, task.id), {
                      editToken: getEditToken(),
                    })
                  }
                >
                  <Check size={16} />
                  {task.completedAt ? "Reabrir" : "Concluir"}
                </Button>
                <IconButton
                  label={`Editar atividade ${task.title}`}
                  onClick={() => onSchedule(task)}
                >
                  <Pencil size={16} />
                </IconButton>
                <IconButton
                  label={`Excluir atividade ${task.title}`}
                  onClick={() =>
                    setRemove({ id: task.id, token: getEditToken() })
                  }
                >
                  <Trash2 size={16} />
                </IconButton>
              </div>
            </article>
          );
        })}
      </div>
      {!list.length && (
        <div className="empty-state">
          <CalendarDays size={32} />
          <h2>Nenhuma atividade neste filtro</h2>
          <p>Agende seu próximo contato para manter o negócio em movimento.</p>
        </div>
      )}
      {remove && (
        <Modal
          open
          onOpenChange={(open) => !open && setRemove(null)}
          title="Excluir atividade?"
          description="Clientes e oportunidades serão preservados."
        >
          <div className="dialog-footer">
            <Button onClick={() => setRemove(null)}>Cancelar</Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (
                  await update(
                    (d) => ({
                      ...d,
                      scheduledActivities: d.scheduledActivities.filter(
                        (t) => t.id !== remove.id,
                      ),
                    }),
                    { editToken: remove.token },
                  )
                )
                  setRemove(null);
              }}
            >
              Excluir atividade
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
function localDateTime(value: string) {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
export function ActivityDialog({
  data,
  activity,
  dealId: initialDeal,
  onClose,
  update,
}: {
  data: CrmData;
  activity?: ScheduledActivity;
  dealId?: string;
  onClose: () => void;
  update: UpdateCrm;
}) {
  const [initialDue] = useState(() =>
    localDateTime(
      activity?.dueAt || new Date(Date.now() + 3600000).toISOString(),
    ),
  );
  const [token] = useState(getEditToken),
    [saving, setSaving] = useState(false);
  const [dealId, setDeal] = useState(activity?.dealId || initialDeal || "");
  const [customerId, setCustomer] = useState(
    activity?.customerId ||
      data.deals.find((d) => d.id === initialDeal)?.customerId ||
      "",
  );
  return (
    <Modal
      open
      onOpenChange={(open) => !open && onClose()}
      title={activity ? "Editar atividade" : "Nova atividade"}
      description="Data e horário seguem o fuso do seu navegador. Lembretes somente dentro do CRM."
      wide
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setSaving(true);
          try {
            const input = {
              title: String(f.get("title")),
              type: String(f.get("type")) as ScheduledActivity["type"],
              dueAt: new Date(String(f.get("due"))).toISOString(),
              customerId,
              dealId,
              owner: String(f.get("owner")),
              notes: String(f.get("notes")),
              remindBeforeMinutes: Number(f.get("reminder")),
            };
            if (
              await update(
                (d) => saveScheduledActivity(d, input, activity?.id),
                { editToken: token },
              )
            ) {
              onClose();
              toast.success("Atividade salva");
            }
          } catch {
            toast.error(
              "Confira a data e o horário da atividade antes de salvar.",
            );
          } finally {
            setSaving(false);
          }
        }}
      >
        <div className="dialog-body form-stack">
          <Field label="Título da atividade">
            <input
              name="title"
              defaultValue={activity?.title}
              required
              maxLength={120}
              autoFocus
            />
          </Field>
          <div className="form-grid">
            <Field label="Tipo de atividade">
              <select name="type" defaultValue={activity?.type || "task"}>
                {Object.entries(ACTIVITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Data e horário">
              <input
                type="datetime-local"
                max="9999-12-31T23:59"
                name="due"
                defaultValue={initialDue}
                required
              />
            </Field>
          </div>
          <Field label="Cliente da atividade">
            <select
              value={customerId}
              onChange={(e) => {
                setCustomer(e.target.value);
                setDeal("");
              }}
              required={!dealId}
            >
              <option value="">Selecione um cliente</option>
              {data.customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Oportunidade da atividade">
            <select
              value={dealId}
              onChange={(e) => {
                setDeal(e.target.value);
                const deal = data.deals.find((d) => d.id === e.target.value);
                if (deal) setCustomer(deal.customerId);
              }}
            >
              <option value="">Sem oportunidade vinculada</option>
              {data.deals
                .filter((d) => !customerId || d.customerId === customerId)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
            </select>
          </Field>
          <div className="form-grid">
            <Field label="Responsável da atividade">
              <select
                name="owner"
                defaultValue={
                  activity?.owner || data.sellers.find((s) => s.active)?.name
                }
              >
                {data.sellers
                  .filter((s) => s.active || s.name === activity?.owner)
                  .map((s) => (
                    <option key={s.id}>{s.name}</option>
                  ))}
              </select>
            </Field>
            <Field label="Lembrar dentro do CRM">
              <select
                name="reminder"
                defaultValue={activity?.remindBeforeMinutes ?? 15}
              >
                <option value="0">No horário</option>
                <option value="5">5 minutos antes</option>
                <option value="15">15 minutos antes</option>
                <option value="30">30 minutos antes</option>
                <option value="60">1 hora antes</option>
                <option value="1440">1 dia antes</option>
              </select>
            </Field>
          </div>
          <Field label="Notas da atividade">
            <textarea
              name="notes"
              defaultValue={activity?.notes}
              maxLength={4000}
              rows={3}
            />
          </Field>
        </div>
        <div className="dialog-footer">
          <Button onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="primary" disabled={saving}>
            Salvar atividade
          </Button>
        </div>
      </form>
    </Modal>
  );
}
