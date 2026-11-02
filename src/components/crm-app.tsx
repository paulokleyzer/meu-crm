"use client";

import { useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  BarChart3,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  HardDrive as CloudCheck,
  Copy,
  Filter,
  FolderKanban,
  LayoutGrid,
  List,
  LoaderCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingUp,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type {
  CrmData,
  Customer,
  CustomerInput,
  Deal,
  DealFilters,
  DealInput,
  Pipeline,
  PipelineInput,
} from "@/lib/types";
import { OWNERS } from "@/lib/types";
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
import { money } from "@/lib/format";
import { parseCrmData } from "@/lib/schema";
import { useCrm, getEditToken } from "@/hooks/use-crm";
import type { UpdateCrm, UpdateOptions } from "@/lib/api-types";
import {
  Button,
  Field,
  IconButton,
  Menu,
  MenuItem,
  MenuSeparator,
  Modal,
} from "./ui";
import { KanbanBoard } from "./kanban-board";
import { PipelineEditor } from "./pipeline-editor";
import { DealDialog } from "./deal-dialog";
import { CustomerDialog } from "./customer-dialog";
import { CustomersView } from "./customers-view";
import { DealList } from "./deal-list";
import { InsightsView } from "./insights-view";

const defaultFilters: DealFilters = {
  query: "",
  owner: "",
  priority: "",
  status: "open",
  due: "",
};
type Section = "deals" | "customers" | "insights";
type Update = UpdateCrm;

export function CrmApp() {
  const { data, update, storageError, saving, refresh } = useCrm();
  if (!data)
    return (
      <div className="app-loading">
        <span className="brand-mark">
          <i />
          <i />
          <i />
        </span>
        <LoaderCircle className="spin" size={22} />
        <p>{storageError || "Preparando seu espaço de trabalho…"}</p>
        {storageError && (
          <Button onClick={() => void refresh()}>Tentar novamente</Button>
        )}
      </div>
    );
  return (
    <Workspace
      data={data}
      update={update}
      storageError={storageError}
      saving={saving}
    />
  );
}

function Workspace({
  data,
  update,
  storageError,
  saving,
}: {
  data: CrmData;
  update: Update;
  storageError: string;
  saving: boolean;
}) {
  const [section, setSection] = useState<Section>("deals");
  const [pipelineId, setPipelineId] = useState(data.pipelines[0].id);
  const [view, setView] = useState<"board" | "list">("board");
  const [filters, setFilters] = useState<DealFilters>(defaultFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [pipelineEditor, setPipelineEditor] = useState<Pipeline | "new" | null>(
    null,
  );
  const [managing, setManaging] = useState(false);
  const [dealDialog, setDealDialog] = useState<{
    id?: string;
    stageId?: string;
  } | null>(null);
  const [customerDialog, setCustomerDialog] = useState<Customer | "new" | null>(
    null,
  );
  const [confirm, setConfirm] = useState<{
    kind: "pipeline" | "deal";
    id: string;
    editToken: number;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState("");
  const [help, setHelp] = useState(false);
  const [importData, setImportData] = useState<CrmData | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const importToken = useRef(0);
  const pipeline =
    data.pipelines.find((p) => p.id === pipelineId) || data.pipelines[0];
  const deals = filterDeals(data, pipeline.id, filters);
  const activeFilters =
    Number(!!filters.owner) +
    Number(!!filters.priority) +
    Number(!!filters.due) +
    Number(filters.status !== "open");
  const won = data.deals.filter(
    (d) => d.pipelineId === pipeline.id && d.status === "won",
  );
  const total = deals.reduce((s, d) => s + d.value, 0);
  const weighted = deals.reduce(
    (s, d) =>
      s +
      d.value *
        (d.status === "won"
          ? 1
          : d.status === "lost"
            ? 0
            : (pipeline.stages.find((stage) => stage.id === d.stageId)
                ?.probability || 0) / 100),
    0,
  );

  const apply = async (
    recipe: (d: CrmData) => CrmData,
    message: string,
    options: UpdateOptions = {},
  ) => {
    const ok = await update(recipe, options);
    if (ok) toast.success(message);
    return ok;
  };
  const openDeal = (deal: Deal) => setDealDialog({ id: deal.id });
  const newPipeline = () => {
    setManaging(false);
    setPipelineEditor("new");
  };
  const editPipeline = (p: Pipeline) => {
    setManaging(false);
    setPipelineEditor(p);
  };
  const duplicate = async (p: Pipeline) => {
    let created = "";
    if (
      await apply((d) => {
        const next = duplicatePipeline(d, p.id);
        created = next.pipelines.at(-1)!.id;
        return next;
      }, "Funil duplicado com suas etapas. As oportunidades permanecem no original.")
    ) {
      setPipelineId(created);
      setManaging(false);
    }
  };
  const askDeletePipeline = (p: Pipeline) => {
    setManaging(false);
    setDeleteTarget(data.pipelines.find((x) => x.id !== p.id)?.id || "");
    setConfirm({ kind: "pipeline", id: p.id, editToken: getEditToken() });
  };
  const handlePipelineSave = async (
    input: PipelineInput,
    id?: string,
    editToken?: number,
  ) => {
    let selected = id;
    if (
      await apply(
        (d) => {
          const next = id
            ? updatePipeline(d, id, input)
            : createPipeline(d, input);
          selected ||= next.pipelines.at(-1)!.id;
          return next;
        },
        id ? "Funil atualizado" : "Seu novo funil está pronto",
        { editToken },
      )
    ) {
      setPipelineEditor(null);
      setPipelineId(selected!);
      setSection("deals");
    }
  };
  const handleCustomerSave = async (
    input: CustomerInput,
    id?: string,
    editToken?: number,
  ): Promise<string | undefined> => {
    let saved = id;
    if (
      await apply(
        (d) => {
          const next = saveCustomer(d, input, id);
          saved ||= next.customers.at(-1)!.id;
          return next;
        },
        id ? "Cliente atualizado" : "Cliente cadastrado",
        { editToken },
      )
    ) {
      setCustomerDialog(null);
      return saved;
    }
  };
  const handleDealSave = async (
    input: DealInput,
    id?: string,
    editToken?: number,
  ) => {
    if (
      await apply(
        (d) => saveDeal(d, input, id),
        id ? "Oportunidade atualizada" : "Nova oportunidade criada",
        { editToken },
      )
    ) {
      setDealDialog(null);
      setPipelineId(input.pipelineId);
    }
  };
  const exportBackup = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `meu-crm-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Backup exportado");
  };
  const confirmedPipeline = data.pipelines.find((p) => p.id === confirm?.id);
  const confirmedDeal = data.deals.find((d) => d.id === confirm?.id);
  const transferCount = data.deals.filter(
    (d) => d.pipelineId === confirm?.id,
  ).length;

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Navegação principal">
        <button
          className="brand-button"
          aria-label="Meu CRM — início"
          onClick={() => setSection("deals")}
        >
          <span className="brand-mark">
            <i />
            <i />
            <i />
          </span>
        </button>
        <nav>
          {(
            [
              { id: "deals", icon: FolderKanban, label: "Funis" },
              { id: "customers", icon: Users, label: "Clientes" },
              { id: "insights", icon: BarChart3, label: "Visão geral" },
            ] as const
          ).map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              className={`nav-item ${section === id ? "active" : ""}`}
              aria-current={section === id ? "page" : undefined}
              onClick={() => setSection(id)}
            >
              <Icon size={22} strokeWidth={1.7} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button
            className="nav-item"
            onClick={() => setHelp(true)}
            aria-label="Ajuda e atalhos"
          >
            <CircleHelp size={21} />
            <span>Ajuda</span>
          </button>
          <div className="sidebar-divider" />
          <Menu
            trigger={
              <button
                className="profile-button"
                aria-label="Menu do espaço de trabalho"
              >
                <span className="avatar profile-avatar">PK</span>
              </button>
            }
            align="start"
          >
            <div className="menu-profile">
              <strong>Meu espaço de trabalho</strong>
              <span>PostgreSQL · acesso protegido</span>
            </div>
            <MenuSeparator />
            <MenuItem onSelect={exportBackup}>
              <ArrowDownToLine size={16} /> Exportar backup
            </MenuItem>
            <MenuItem onSelect={() => fileInput.current?.click()}>
              <ArrowUpFromLine size={16} /> Importar backup
            </MenuItem>
            <MenuSeparator />
            <MenuItem onSelect={() => setHelp(true)}>
              <CircleHelp size={16} /> Sobre esta versão
            </MenuItem>
          </Menu>
        </div>
      </aside>
      <div className="workspace">
        <a className="skip-link" href="#main">
          Ir para o conteúdo
        </a>
        <header className="topbar">
          <div className="workspace-breadcrumb">
            <span className="workspace-name">
              meu<span>crm</span>
              <span className="brand-period">.</span>
            </span>
            <span className="breadcrumb-divider" />
            <span>Meu espaço de trabalho</span>
            <ChevronRight size={14} />
            <strong>
              {section === "deals"
                ? "Funis"
                : section === "customers"
                  ? "Clientes"
                  : "Visão geral"}
            </strong>
          </div>
          <div className="topbar-actions">
            <span className="demo-badge">
              <span /> Modo demonstração
            </span>
            <IconButton
              label="Sobre o CRM e ajuda"
              onClick={() => setHelp(true)}
            >
              <CircleHelp size={19} />
            </IconButton>
            <Menu
              trigger={
                <button
                  className="avatar topbar-avatar"
                  aria-label="Menu do perfil"
                >
                  PK
                </button>
              }
            >
              <MenuItem onSelect={exportBackup}>
                <ArrowDownToLine size={16} /> Exportar backup
              </MenuItem>
              <MenuItem onSelect={() => fileInput.current?.click()}>
                <ArrowUpFromLine size={16} /> Importar backup
              </MenuItem>
              <MenuSeparator />
              <MenuItem onSelect={() => setHelp(true)}>
                <CircleHelp size={16} /> Sobre esta versão
              </MenuItem>
            </Menu>
          </div>
        </header>
        <main id="main">
          {storageError && (
            <div className="notice warning storage-warning" role="alert">
              {storageError}
              <button onClick={exportBackup}>Exportar backup</button>
            </div>
          )}
          {section === "deals" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="heading-eyebrow">
                    <span className="green-dash" /> SEU PRÓXIMO GRANDE NEGÓCIO
                  </div>
                  <h1>
                    Oportunidades
                    <span className="heading-count">
                      {
                        data.deals.filter(
                          (d) =>
                            d.pipelineId === pipeline.id && d.status === "open",
                        ).length
                      }
                    </span>
                  </h1>
                  <p>Conecte conversas. Faça negócios avançarem.</p>
                </div>
                <div className="heading-actions">
                  <Button onClick={() => setManaging(true)}>
                    <Settings2 size={16} />
                    <span>Gerenciar funis</span>
                  </Button>
                  <Button variant="primary" onClick={() => setDealDialog({})}>
                    <Plus size={18} /> Nova oportunidade
                  </Button>
                </div>
              </div>
              <div className="metrics-row">
                <div className="metric">
                  <span className="metric-icon mint">
                    <Wallet size={19} />
                  </span>
                  <div>
                    <span>Valor no filtro atual</span>
                    <strong>{money(total)}</strong>
                  </div>
                </div>
                <div className="metric">
                  <span className="metric-icon blue">
                    <FolderKanban size={19} />
                  </span>
                  <div>
                    <span>Oportunidades no filtro</span>
                    <strong>
                      {deals.length}
                      <small> negócios</small>
                    </strong>
                  </div>
                </div>
                <div className="metric">
                  <span className="metric-icon lilac">
                    <TrendingUp size={19} />
                  </span>
                  <div>
                    <span>
                      Receita ponderada{" "}
                      <span
                        className="info-dot"
                        title="Valor × probabilidade da etapa. Negócios ganhos contam 100%; perdidos, 0%."
                      >
                        i
                      </span>
                    </span>
                    <strong>{money(weighted)}</strong>
                  </div>
                </div>
                <div className="metric metric-won">
                  <span className="metric-icon peach">
                    <ShieldCheck size={19} />
                  </span>
                  <div>
                    <span>Ganhos neste funil</span>
                    <strong>
                      {money(won.reduce((s, d) => s + d.value, 0))}
                      <small className="won-count">
                        {won.length} negócio{won.length !== 1 ? "s" : ""}
                      </small>
                    </strong>
                  </div>
                </div>
              </div>
              <div className="pipeline-workspace">
                <div className="board-toolbar">
                  <div className="pipeline-controls">
                    <Menu
                      align="start"
                      trigger={
                        <button
                          className="pipeline-selector"
                          aria-label={`Selecionar funil: ${pipeline.name}`}
                        >
                          <FolderKanban size={17} />
                          <span>{pipeline.name}</span>
                          <ChevronDown size={16} />
                        </button>
                      }
                    >
                      <div className="menu-label">SEUS FUNIS</div>
                      {data.pipelines.map((p) => (
                        <MenuItem
                          key={p.id}
                          onSelect={() => setPipelineId(p.id)}
                        >
                          <span className="pipeline-menu-name">{p.name}</span>
                          {pipeline.id === p.id && <Check size={16} />}
                        </MenuItem>
                      ))}
                      <MenuSeparator />
                      <MenuItem onSelect={newPipeline}>
                        <Plus size={16} /> Criar novo funil
                      </MenuItem>
                      <MenuItem onSelect={() => setManaging(true)}>
                        <Settings2 size={16} /> Gerenciar funis
                      </MenuItem>
                    </Menu>
                    <Menu
                      trigger={
                        <IconButton label="Ações do funil">
                          <MoreHorizontal size={20} />
                        </IconButton>
                      }
                      align="start"
                    >
                      <MenuItem onSelect={() => editPipeline(pipeline)}>
                        <Pencil size={15} /> Editar funil e etapas
                      </MenuItem>
                      <MenuItem onSelect={() => duplicate(pipeline)}>
                        <Copy size={15} /> Duplicar funil
                      </MenuItem>
                      <MenuSeparator />
                      <MenuItem
                        danger
                        disabled={data.pipelines.length <= 1}
                        onSelect={() => askDeletePipeline(pipeline)}
                      >
                        <Trash2 size={15} /> Excluir funil
                      </MenuItem>
                    </Menu>
                  </div>
                  <div className="board-tools">
                    <label className="search-field">
                      <Search size={16} />
                      <input
                        value={filters.query}
                        onChange={(e) =>
                          setFilters({ ...filters, query: e.target.value })
                        }
                        placeholder="Buscar oportunidade..."
                        aria-label="Buscar oportunidades"
                      />
                      {filters.query && (
                        <button
                          type="button"
                          aria-label="Limpar busca"
                          onClick={() => setFilters({ ...filters, query: "" })}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </label>
                    <Button
                      className={
                        showFilters || activeFilters ? "filter-active" : ""
                      }
                      aria-expanded={showFilters}
                      onClick={() => setShowFilters(!showFilters)}
                    >
                      <Filter size={16} /> Filtros
                      {activeFilters > 0 && (
                        <span className="filter-count">{activeFilters}</span>
                      )}
                    </Button>
                    <div
                      className="view-switch"
                      role="group"
                      aria-label="Visualização"
                    >
                      <button
                        className={view === "board" ? "selected" : ""}
                        aria-label="Visualização em funil"
                        aria-pressed={view === "board"}
                        onClick={() => setView("board")}
                      >
                        <LayoutGrid size={17} />
                      </button>
                      <button
                        className={view === "list" ? "selected" : ""}
                        aria-label="Visualização em lista"
                        aria-pressed={view === "list"}
                        onClick={() => setView("list")}
                      >
                        <List size={18} />
                      </button>
                    </div>
                  </div>
                </div>
                {showFilters && (
                  <div className="filters-panel">
                    <Field label="Responsável">
                      <select
                        value={filters.owner}
                        onChange={(e) =>
                          setFilters({ ...filters, owner: e.target.value })
                        }
                      >
                        <option value="">Todos os responsáveis</option>
                        {Array.from(
                          new Set([
                            ...OWNERS,
                            ...data.deals.map((d) => d.owner),
                          ]),
                        ).map((o) => (
                          <option key={o}>{o}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Prioridade">
                      <select
                        value={filters.priority}
                        onChange={(e) =>
                          setFilters({ ...filters, priority: e.target.value })
                        }
                      >
                        <option value="">Todas as prioridades</option>
                        <option value="high">Alta</option>
                        <option value="medium">Média</option>
                        <option value="low">Baixa</option>
                      </select>
                    </Field>
                    <Field label="Status">
                      <select
                        value={filters.status}
                        onChange={(e) =>
                          setFilters({
                            ...filters,
                            status: e.target.value as DealFilters["status"],
                          })
                        }
                      >
                        <option value="open">Em aberto</option>
                        <option value="won">Ganhos</option>
                        <option value="lost">Perdidos</option>
                        <option value="all">Todos os status</option>
                      </select>
                    </Field>
                    <Field label="Fechamento">
                      <select
                        value={filters.due}
                        onChange={(e) =>
                          setFilters({ ...filters, due: e.target.value })
                        }
                      >
                        <option value="">Todas as datas</option>
                        <option value="overdue">Em atraso</option>
                      </select>
                    </Field>
                    <Button
                      variant="ghost"
                      onClick={() => setFilters(defaultFilters)}
                    >
                      Limpar filtros
                    </Button>
                  </div>
                )}
                <div className="board-context">
                  <span>
                    {pipeline.description ||
                      "Cada etapa é um passo para uma nova conquista."}
                  </span>
                  <span>
                    <span className="live-dot" />
                    {deals.length} oportunidade{deals.length !== 1 ? "s" : ""} ·{" "}
                    {filters.status === "open"
                      ? "em aberto"
                      : filters.status === "all"
                        ? "todos os status"
                        : filters.status === "won"
                          ? "ganhas"
                          : "perdidas"}
                  </span>
                </div>
                {!deals.length && (
                  <div className="no-results">
                    <Search size={17} />
                    <span>Nenhuma oportunidade encontrada.</span>
                    {(activeFilters > 0 || filters.query) && (
                      <button onClick={() => setFilters(defaultFilters)}>
                        Limpar busca e filtros
                      </button>
                    )}
                  </div>
                )}
                {view === "board" ? (
                  <KanbanBoard
                    data={data}
                    pipeline={pipeline}
                    deals={deals}
                    onOpen={openDeal}
                    onAdd={(stageId) => setDealDialog({ stageId })}
                    onMove={async (id, stageId, beforeId, editToken) => {
                      await apply(
                        (d) => moveDeal(d, id, stageId, beforeId),
                        `Oportunidade atualizada · ${pipeline.stages.find((s) => s.id === stageId)?.name}`,
                        { editToken },
                      );
                    }}
                  />
                ) : (
                  <DealList
                    deals={deals}
                    pipeline={pipeline}
                    data={data}
                    onOpen={openDeal}
                  />
                )}
              </div>
              <footer className="workspace-footer">
                <span>
                  <span className="footer-drag-icon">⠿</span> Arraste para
                  avançar. Clique para ver os detalhes.
                </span>
                <span>
                  <CloudCheck size={14} />
                  {storageError
                    ? "Gravação não confirmada"
                    : saving
                      ? "Salvando no PostgreSQL…"
                      : "Salvo no PostgreSQL"}
                </span>
              </footer>
            </>
          )}
          {section === "customers" && (
            <CustomersView
              data={data}
              onAdd={() => setCustomerDialog("new")}
              onEdit={setCustomerDialog}
            />
          )}
          {section === "insights" && <InsightsView data={data} />}
        </main>
      </div>
      {pipelineEditor && (
        <PipelineEditor
          key={typeof pipelineEditor === "string" ? "new" : pipelineEditor.id}
          pipeline={pipelineEditor === "new" ? undefined : pipelineEditor}
          data={data}
          onClose={() => setPipelineEditor(null)}
          onSave={handlePipelineSave}
        />
      )}
      {dealDialog && (
        <DealDialog
          key={dealDialog.id || `new-${dealDialog.stageId}`}
          data={data}
          deal={data.deals.find((d) => d.id === dealDialog.id)}
          pipelineId={pipeline.id}
          stageId={dealDialog.stageId}
          onClose={() => setDealDialog(null)}
          onSave={handleDealSave}
          onDelete={(deal) =>
            setConfirm({ kind: "deal", id: deal.id, editToken: getEditToken() })
          }
          onSaveCustomer={(input, token) =>
            handleCustomerSave(input, undefined, token)
          }
        />
      )}
      {customerDialog && (
        <CustomerDialog
          key={customerDialog === "new" ? "new" : customerDialog.id}
          customer={customerDialog === "new" ? undefined : customerDialog}
          onClose={() => setCustomerDialog(null)}
          onSave={handleCustomerSave}
        />
      )}
      {managing && (
        <Modal
          open
          onOpenChange={setManaging}
          title="Seus funis"
          description="Processos diferentes. A mesma visão do que importa."
          wide
        >
          <div className="dialog-body">
            <div className="manage-intro">
              <span>{data.pipelines.length} funis no seu espaço</span>
              <Button variant="primary" onClick={newPipeline}>
                <Plus size={16} /> Criar funil
              </Button>
            </div>
            <div className="pipeline-list">
              {data.pipelines.map((p) => (
                <div key={p.id} className="pipeline-manage-row">
                  <span className="pipeline-manage-icon">
                    <FolderKanban size={21} />
                  </span>
                  <button
                    className="pipeline-manage-name"
                    onClick={() => {
                      setPipelineId(p.id);
                      setManaging(false);
                    }}
                  >
                    <strong>{p.name}</strong>
                    <span>
                      {p.stages.length} etapas ·{" "}
                      {data.deals.filter((d) => d.pipelineId === p.id).length}{" "}
                      oportunidades
                    </span>
                  </button>
                  <IconButton
                    label={`Editar funil ${p.name}`}
                    onClick={() => editPipeline(p)}
                  >
                    <Pencil size={16} />
                  </IconButton>
                  <IconButton
                    label={`Duplicar funil ${p.name}`}
                    onClick={() => duplicate(p)}
                  >
                    <Copy size={16} />
                  </IconButton>
                  <IconButton
                    label={
                      data.pipelines.length <= 1
                        ? "Mantenha pelo menos um funil"
                        : `Excluir funil ${p.name}`
                    }
                    disabled={data.pipelines.length <= 1}
                    onClick={() => askDeletePipeline(p)}
                  >
                    <Trash2 size={16} />
                  </IconButton>
                </div>
              ))}
            </div>
            <p className="muted small">
              Ao duplicar, somente a estrutura e as etapas são copiadas. As
              oportunidades continuam no funil original.
            </p>
          </div>
          <div className="dialog-footer">
            <Button onClick={() => setManaging(false)}>Concluir</Button>
          </div>
        </Modal>
      )}
      {confirm && (
        <Modal
          open
          onOpenChange={(open) => !open && setConfirm(null)}
          title={
            confirm.kind === "pipeline"
              ? "Excluir este funil?"
              : "Excluir oportunidade?"
          }
          description={
            confirm.kind === "pipeline"
              ? `O funil “${confirmedPipeline?.name}” e suas etapas serão removidos.`
              : `“${confirmedDeal?.title}” será excluída junto com seu histórico.`
          }
        >
          <div className="dialog-body form-stack">
            {confirm.kind === "pipeline" ? (
              <>
                {transferCount > 0 && (
                  <div className="notice warning">
                    As {transferCount} oportunidade(s) serão preservadas e
                    movidas para a primeira etapa do funil de destino.
                  </div>
                )}
                <Field label="Transferir oportunidades para">
                  <select
                    value={deleteTarget}
                    onChange={(e) => setDeleteTarget(e.target.value)}
                  >
                    {data.pipelines
                      .filter((p) => p.id !== confirm.id)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} · {p.stages[0].name}
                        </option>
                      ))}
                  </select>
                </Field>
              </>
            ) : (
              <p className="muted">
                Esta ação não pode ser desfeita. O cadastro do cliente será
                mantido.
              </p>
            )}
          </div>
          <div className="dialog-footer">
            <Button onClick={() => setConfirm(null)}>Cancelar</Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (
                  await apply(
                    (d) =>
                      confirm.kind === "pipeline"
                        ? deletePipeline(d, confirm.id, deleteTarget)
                        : deleteDeal(d, confirm.id),
                    confirm.kind === "pipeline"
                      ? "Funil excluído; oportunidades preservadas"
                      : "Oportunidade excluída",
                    { editToken: confirm.editToken },
                  )
                ) {
                  if (confirm.kind === "pipeline") setPipelineId(deleteTarget);
                  else setDealDialog(null);
                  setConfirm(null);
                }
              }}
            >
              {confirm.kind === "pipeline"
                ? "Excluir funil"
                : "Excluir oportunidade"}
            </Button>
          </div>
        </Modal>
      )}
      {help && (
        <Modal
          open
          onOpenChange={setHelp}
          title="Seu CRM, em movimento."
          description="Uma primeira versão funcional para explorar suas possibilidades."
        >
          <div className="dialog-body help-body">
            <div className="help-hero">
              <Sparkles size={25} />
              <p>
                Menos planilhas.
                <br />
                <strong>Mais próximos passos.</strong>
              </p>
            </div>
            <h3>Um fluxo simples</h3>
            <p>
              Crie funis para seus processos, configure as etapas e cadastre
              clientes e oportunidades. Clique em um cartão para editar os
              detalhes ou atualizar o status para ganho ou perdido.
            </p>
            <h3>Arrastar, soltar, avançar</h3>
            <p>
              Arraste o cartão até outra etapa, mesmo vazia. No celular,
              mantenha pressionado por um instante. Pelo teclado, use Tab para
              focar um cartão, Espaço para pegar, setas para mover e Espaço para
              soltar. Escape cancela.
            </p>
            <div className="notice">
              <ShieldCheck size={18} />
              <span>
                Os dados são compartilhados pelo PostgreSQL e sincronizados
                entre dispositivos. O servidor confirma cada gravação e informa
                conflitos. Exporte backups pelo menu do seu avatar. Use dados de
                teste nesta versão.
              </span>
            </div>
            <Button onClick={exportBackup}>
              <ArrowDownToLine size={16} /> Exportar meus dados
            </Button>
          </div>
          <div className="dialog-footer">
            <Button variant="primary" onClick={() => setHelp(false)}>
              Vamos começar <ArrowRight size={16} />
            </Button>
          </div>
        </Modal>
      )}
      <input
        ref={fileInput}
        className="sr-only"
        type="file"
        accept="application/json,.json"
        aria-label="Importar backup JSON"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          if (file.size > 10 * 1024 * 1024) {
            toast.error("O backup deve ter no máximo 10 MB.");
            return;
          }
          try {
            setImportData(parseCrmData(JSON.parse(await file.text())));
            importToken.current = getEditToken();
          } catch {
            toast.error(
              "Backup inválido ou de uma versão incompatível. Nenhum dado foi alterado.",
            );
          }
        }}
      />
      {importData && (
        <Modal
          open
          onOpenChange={(open) => !open && setImportData(null)}
          title="Restaurar este backup?"
          description="Os dados compartilhados no banco serão substituídos pelos dados do arquivo. Exporte um backup antes de continuar."
        >
          <div className="dialog-body form-stack">
            <p>
              {importData.pipelines.length} funis, {importData.customers.length}{" "}
              clientes e {importData.deals.length} oportunidades.
            </p>
            <Button onClick={exportBackup}>
              <ArrowDownToLine size={16} /> Exportar dados atuais antes de
              continuar
            </Button>
          </div>
          <div className="dialog-footer">
            <Button onClick={() => setImportData(null)}>Cancelar</Button>
            <Button
              variant="primary"
              onClick={async () => {
                if (
                  await apply(() => importData, "Backup restaurado", {
                    operation: "import",
                    editToken: importToken.current,
                  })
                ) {
                  setPipelineId(importData.pipelines[0].id);
                  setImportData(null);
                  setDealDialog(null);
                  setFilters(defaultFilters);
                }
              }}
            >
              Restaurar backup
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
