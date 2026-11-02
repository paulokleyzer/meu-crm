"use client";

import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Pencil,
  Plus,
  Settings2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { CrmData, DistributionRule } from "@/lib/types";
import type { UpdateCrm } from "@/lib/api-types";
import { getEditToken } from "@/hooks/use-crm";
import {
  deleteCatalog,
  reorderRule,
  resolveDistribution,
  saveCatalog,
  saveDistributionRule,
  simulateIntake,
  toggleSeller,
  type Catalog,
} from "@/lib/crm-v2";
import { Button, Field, IconButton, Modal } from "./ui";

const labels = {
  businessTypes: "Tipo de negócio",
  sources: "Origem comercial",
  sellers: "Responsável",
};
type Tab = Catalog | "rules" | "simulator";
export function SettingsView({
  data,
  update,
}: {
  data: CrmData;
  update: UpdateCrm;
}) {
  const [tab, setTab] = useState<Tab>("businessTypes");
  return (
    <div className="settings-view customers-view">
      <div className="page-intro">
        <div>
          <span className="eyebrow">SEU ESPAÇO</span>
          <h1>Configurações</h1>
          <p>Personalize os cadastros e os caminhos das oportunidades.</p>
        </div>
        <Settings2 size={25} />
      </div>
      <div
        className="section-tabs"
        role="group"
        aria-label="Configurações comerciais"
      >
        {(
          [
            ["businessTypes", "Tipos de negócio"],
            ["sources", "Origens comerciais"],
            ["sellers", "Responsáveis"],
            ["rules", "Regras de distribuição"],
            ["simulator", "Simulador"],
          ] as const
        ).map(([id, label]) => (
          <Button
            key={id}
            variant={tab === id ? "primary" : "secondary"}
            aria-pressed={tab === id}
            onClick={() => setTab(id)}
          >
            {label}
          </Button>
        ))}
      </div>
      {tab === "rules" ? (
        <RulesSettings data={data} update={update} />
      ) : tab === "simulator" ? (
        <DistributionSimulator data={data} update={update} />
      ) : (
        <CatalogSettings key={tab} catalog={tab} data={data} update={update} />
      )}
    </div>
  );
}
function CatalogSettings({
  catalog,
  data,
  update,
}: {
  catalog: Catalog;
  data: CrmData;
  update: UpdateCrm;
}) {
  const [editing, setEditing] = useState<{
    id?: string;
    name: string;
    token: number;
  } | null>(null);
  const [removing, setRemoving] = useState<{
    id: string;
    name: string;
    token: number;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const label = labels[catalog];
  return (
    <section className="settings-panel">
      <div className="panel-heading">
        <h2>
          {catalog === "businessTypes"
            ? "Tipos de negócio"
            : catalog === "sources"
              ? "Origens comerciais"
              : "Vendedores e responsáveis"}
        </h2>
        <Button
          variant="primary"
          onClick={() => setEditing({ name: "", token: getEditToken() })}
        >
          <Plus size={16} />
          Adicionar {label.toLowerCase()}
        </Button>
      </div>
      <p className="muted">
        {catalog === "sellers"
          ? "Desativar preserva os negócios e atividades anteriores. Não cria usuários ou permissões."
          : "Os nomes são livres. Ao remover, as oportunidades permanecem e as regras relacionadas são desativadas."}
      </p>
      <div className="settings-list">
        {data[catalog].map((entry) => (
          <div className="settings-row" key={entry.id}>
            <strong>{entry.name}</strong>
            {"active" in entry && (
              <span className="period-pill">
                {entry.active ? "Ativo" : "Inativo"}
              </span>
            )}
            <div className="row-actions">
              <IconButton
                label={`Editar ${entry.name}`}
                onClick={() =>
                  setEditing({
                    id: entry.id,
                    name: entry.name,
                    token: getEditToken(),
                  })
                }
              >
                <Pencil size={16} />
              </IconButton>
              {catalog === "sellers" ? (
                <Button
                  onClick={async () => {
                    if (
                      await update((d) => toggleSeller(d, entry.id), {
                        editToken: getEditToken(),
                      })
                    )
                      toast.success("Responsável atualizado");
                  }}
                >
                  {"active" in entry && entry.active ? "Desativar" : "Ativar"}
                </Button>
              ) : (
                <IconButton
                  label={`Excluir ${entry.name}`}
                  onClick={() =>
                    setRemoving({ ...entry, token: getEditToken() })
                  }
                >
                  <Trash2 size={16} />
                </IconButton>
              )}
            </div>
          </div>
        ))}
        {!data[catalog].length && (
          <div className="empty-state">
            <p>Nenhum cadastro. Adicione o primeiro para começar.</p>
          </div>
        )}
      </div>
      {editing && (
        <Modal
          open
          onOpenChange={(open) => !open && setEditing(null)}
          title={`${editing.id ? "Editar" : "Adicionar"} ${label.toLowerCase()}`}
          description="A alteração será salva no banco compartilhado."
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const name = String(new FormData(e.currentTarget).get("name"));
              setSaving(true);
              try {
                if (
                  await update(
                    (d) => saveCatalog(d, catalog, name, editing.id),
                    { editToken: editing.token },
                  )
                ) {
                  setEditing(null);
                  toast.success("Cadastro salvo");
                }
              } finally {
                setSaving(false);
              }
            }}
          >
            <div className="dialog-body">
              <Field
                label={`Nome ${catalog === "sources" ? "da" : "do"} ${label.toLowerCase()}`}
              >
                <input
                  name="name"
                  defaultValue={editing.name}
                  required
                  maxLength={120}
                  autoFocus
                />
              </Field>
            </div>
            <div className="dialog-footer">
              <Button onClick={() => setEditing(null)}>Cancelar</Button>
              <Button type="submit" variant="primary" disabled={saving}>
                Salvar cadastro
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {removing && catalog !== "sellers" && (
        <Modal
          open
          onOpenChange={(open) => !open && setRemoving(null)}
          title={`Excluir ${removing.name}?`}
          description="As oportunidades serão preservadas sem esta classificação. Regras relacionadas ficarão inativas."
        >
          <div className="dialog-footer">
            <Button onClick={() => setRemoving(null)}>Cancelar</Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (
                  await update((d) => deleteCatalog(d, catalog, removing.id), {
                    editToken: removing.token,
                  })
                ) {
                  setRemoving(null);
                  toast.success("Cadastro removido");
                }
              }}
            >
              Confirmar exclusão
            </Button>
          </div>
        </Modal>
      )}
    </section>
  );
}
function RulesSettings({ data, update }: { data: CrmData; update: UpdateCrm }) {
  const [editing, setEditing] = useState<{
    rule?: DistributionRule;
    token: number;
  } | null>(null);
  const [remove, setRemove] = useState<{
    rule: DistributionRule;
    token: number;
  } | null>(null);
  return (
    <section className="settings-panel">
      <div className="panel-heading">
        <h2>Regras de distribuição</h2>
        <Button
          variant="primary"
          onClick={() => setEditing({ token: getEditToken() })}
        >
          <Plus size={16} />
          Nova regra
        </Button>
      </div>
      <p className="muted">
        A primeira regra ativa que corresponder vence. A regra padrão é usada
        quando nenhuma condição corresponder. O destino é sempre a primeira
        etapa do funil.
      </p>
      <div className="settings-list">
        {data.distributionRules.map((rule, i) => (
          <div className="settings-row rule-row" key={rule.id}>
            <div>
              <strong>
                {i + 1}. {rule.name}
              </strong>
              <p>
                {rule.isDefault
                  ? "Regra padrão"
                  : `${data.businessTypes.find((b) => b.id === rule.businessTypeId)?.name || "Qualquer tipo"} + ${rule.source || "Qualquer origem"}`}{" "}
                → {data.pipelines.find((p) => p.id === rule.pipelineId)?.name}
              </p>
              <span>{rule.enabled ? "Ativa" : "Inativa"}</span>
            </div>
            <div className="row-actions">
              <IconButton
                label={`Subir regra ${rule.name}`}
                disabled={i === 0}
                onClick={() =>
                  void update((d) => reorderRule(d, rule.id, -1), {
                    editToken: getEditToken(),
                  })
                }
              >
                <ArrowUp size={16} />
              </IconButton>
              <IconButton
                label={`Descer regra ${rule.name}`}
                disabled={i === data.distributionRules.length - 1}
                onClick={() =>
                  void update((d) => reorderRule(d, rule.id, 1), {
                    editToken: getEditToken(),
                  })
                }
              >
                <ArrowDown size={16} />
              </IconButton>
              <IconButton
                label={`Editar regra ${rule.name}`}
                onClick={() => setEditing({ rule, token: getEditToken() })}
              >
                <Pencil size={16} />
              </IconButton>
              <Button
                onClick={() =>
                  void update(
                    (d) => ({
                      ...d,
                      distributionRules: d.distributionRules.map((r) =>
                        r.id === rule.id ? { ...r, enabled: !r.enabled } : r,
                      ),
                    }),
                    { editToken: getEditToken() },
                  )
                }
              >
                {rule.enabled ? "Desativar" : "Ativar"}
              </Button>
              <IconButton
                label={`Excluir regra ${rule.name}`}
                onClick={() => setRemove({ rule, token: getEditToken() })}
              >
                <Trash2 size={16} />
              </IconButton>
            </div>
          </div>
        ))}
      </div>
      {!data.distributionRules.length && (
        <div className="empty-state">
          <p>Crie uma regra ou use a escolha manual do funil.</p>
        </div>
      )}
      {editing && (
        <RuleDialog
          data={data}
          rule={editing.rule}
          onClose={() => setEditing(null)}
          onSave={async (input) => {
            const ok = await update(
              (d) => saveDistributionRule(d, input, editing.rule?.id),
              { editToken: editing.token },
            );
            if (ok) {
              setEditing(null);
              toast.success("Regra salva");
            }
            return ok;
          }}
        />
      )}
      {remove && (
        <Modal
          open
          onOpenChange={(open) => !open && setRemove(null)}
          title="Excluir regra?"
          description={`A regra ${remove.rule.name} será removida. As oportunidades existentes permanecem no funil atual.`}
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
                      distributionRules: d.distributionRules.filter(
                        (r) => r.id !== remove.rule.id,
                      ),
                    }),
                    { editToken: remove.token },
                  )
                )
                  setRemove(null);
              }}
            >
              Excluir regra
            </Button>
          </div>
        </Modal>
      )}
    </section>
  );
}
function RuleDialog({
  data,
  rule,
  onClose,
  onSave,
}: {
  data: CrmData;
  rule?: DistributionRule;
  onClose: () => void;
  onSave: (input: Omit<DistributionRule, "id">) => Promise<boolean>;
}) {
  const [saving, setSaving] = useState(false),
    [isDefault, setDefault] = useState(rule?.isDefault || false);
  return (
    <Modal
      open
      onOpenChange={(open) => !open && onClose()}
      title={rule ? "Editar regra" : "Nova regra"}
      description="Combine tipo de negócio e origem, sem impedir a movimentação manual."
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setSaving(true);
          try {
            await onSave({
              name: String(f.get("name")),
              businessTypeId: isDefault ? "" : String(f.get("type")),
              source: isDefault ? "" : String(f.get("source")),
              pipelineId: String(f.get("pipeline")),
              enabled: f.has("enabled"),
              isDefault,
            });
          } finally {
            setSaving(false);
          }
        }}
      >
        <div className="dialog-body form-stack">
          <Field label="Nome da regra">
            <input
              name="name"
              defaultValue={rule?.name}
              required
              maxLength={120}
              autoFocus
            />
          </Field>
          <label className="check-field">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setDefault(e.target.checked)}
            />
            Usar como regra padrão
          </label>
          <Field label="Se tipo de negócio">
            <select
              name="type"
              defaultValue={rule?.businessTypeId || ""}
              disabled={isDefault}
            >
              <option value="">Qualquer tipo</option>
              {data.businessTypes.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="E origem comercial">
            <select
              name="source"
              defaultValue={rule?.source || ""}
              disabled={isDefault}
            >
              <option value="">Qualquer origem</option>
              {data.sources.map((s) => (
                <option key={s.id}>{s.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Então enviar para o funil">
            <select
              name="pipeline"
              defaultValue={rule?.pipelineId || data.pipelines[0].id}
            >
              {data.pipelines.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <label className="check-field">
            <input
              type="checkbox"
              name="enabled"
              defaultChecked={rule?.enabled ?? true}
            />
            Regra ativa
          </label>
        </div>
        <div className="dialog-footer">
          <Button onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="primary" disabled={saving}>
            Salvar regra
          </Button>
        </div>
      </form>
    </Modal>
  );
}
function DistributionSimulator({
  data,
  update,
}: {
  data: CrmData;
  update: UpdateCrm;
}) {
  const [businessTypeId, setType] = useState(""),
    [source, setSource] = useState("");
  const [saving, setSaving] = useState(false);
  const target = resolveDistribution(data, { businessTypeId, source });
  return (
    <section className="settings-panel simulator">
      <h2>Simulador de distribuição</h2>
      <p className="muted">
        Classifique um contato fictício. Nenhuma conexão ou mensagem do WhatsApp
        está ativa.
      </p>
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          const name = String(new FormData(e.currentTarget).get("name"));
          setSaving(true);
          try {
            if (
              await update(
                (d) => simulateIntake(d, { name, businessTypeId, source }),
                { editToken: getEditToken() },
              )
            )
              toast.success(
                "Cliente e oportunidade fictícios criados no funil indicado",
              );
          } finally {
            setSaving(false);
          }
        }}
      >
        <Field label="Nome fictício do contato">
          <input
            name="name"
            defaultValue="Contato fictício"
            required
            maxLength={100}
          />
        </Field>
        <Field label="Tipo para simular">
          <select
            value={businessTypeId}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="">Não informado</option>
            {data.businessTypes.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Origem para simular">
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">Não informada</option>
            {data.sources.map((s) => (
              <option key={s.id}>{s.name}</option>
            ))}
          </select>
        </Field>
        <div className="notice" role="status">
          {target
            ? `Regra: ${target.rule.name}. Destino: ${target.pipeline.name} → ${target.stage.name}.`
            : "Nenhuma regra corresponde. O funil pode ser escolhido manualmente ou por uma regra padrão."}
        </div>
        <Button type="submit" variant="primary" disabled={!target || saving}>
          Criar oportunidade fictícia
        </Button>
      </form>
    </section>
  );
}
