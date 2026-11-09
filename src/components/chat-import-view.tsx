"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, BrainCircuit, Check, FileUp, RotateCcw, Search } from "lucide-react";
import { toast } from "sonner";
import type { CrmData } from "@/lib/types";
import type { UpdateCrm } from "@/lib/api-types";
import {
  importApprovedChats,
  matchCustomer,
  parseWhatsAppText,
  reviewLocally,
  type BusinessArea,
  type ChatCategory,
  type ChatProposal,
  type ChatReview,
  type ChatSituation,
} from "@/lib/chat-import";
import { readWhatsAppExport } from "@/lib/chat-zip";
import { Button } from "./ui";

const CATEGORY: Record<ChatCategory, string> = {
  lead: "Potencial cliente",
  supplier: "Fornecedor",
  group: "Grupo",
  personal: "Pessoal",
  irrelevant: "Sem interesse comercial",
  uncertain: "Revisar",
};
const SITUATION: Record<ChatSituation, string> = {
  active: "Interesse ativo",
  recoverable: "Possível recuperação",
  possible_loss: "Possível desistência",
  won: "Negócio concluído",
  unknown: "Indefinido",
};
const AREA: Record<BusinessArea, string> = {
  solar: "Energia solar",
  motos: "Motos elétricas",
  construction: "Construção",
  licitacao: "Licitações",
  other: "Não identificado",
};

function suggestedPipeline(data: CrmData, area: BusinessArea) {
  const keyword = {
    solar: /solar|energia/i,
    motos: /moto|bike/i,
    construction: /constru|obra/i,
    licitacao: /licita|preg[aã]o/i,
    other: /^$/,
  }[area];
  return data.pipelines.find((p) => keyword.test(p.name)) || data.pipelines[0];
}
function suggestedStage(data: CrmData, pipelineId: string) {
  return data.pipelines.find((p) => p.id === pipelineId)?.stages[0]?.id || "";
}
function suggestedType(data: CrmData, area: BusinessArea) {
  const keyword = {
    solar: /solar|energia/i,
    motos: /moto|bike/i,
    construction: /constru|obra/i,
    licitacao: /licita/i,
    other: /^$/,
  }[area];
  return data.businessTypes.find((b) => keyword.test(b.name))?.id || "";
}
function eligible(proposal: ChatProposal) {
  return !proposal.thread.isGroup &&
    !proposal.review.partial &&
    proposal.review.category === "lead" &&
    ["active", "recoverable"].includes(proposal.review.situation);
}

export function ChatImportView({
  data,
  update,
}: {
  data: CrmData;
  update: UpdateCrm;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const cancelled = useRef(false);
  const [candidates, setCandidates] = useState<ChatProposal[]>([]);
  const [config, setConfig] = useState({ protected: false, aiReady: false });
  const [reading, setReading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState("");
  const [consent, setConsent] = useState(false);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/chat-import", { cache: "no-store", credentials: "same-origin" })
      .then((response) => response.json())
      .then((value) => setConfig({
        protected: Boolean(value.protected),
        aiReady: Boolean(value.aiReady),
      }))
      .catch(() => setConfig({ protected: false, aiReady: false }));
  }, []);

  function edit(id: string, patch: Partial<ChatProposal>) {
    setCandidates((list) => list.map((p) => p.thread.id === id ? { ...p, ...patch } : p));
  }
  function revise(id: string, patch: Partial<ChatReview>) {
    setCandidates((list) => list.map((p) => p.thread.id === id ?
      { ...p, review: { ...p.review, ...patch }, selected: false } : p));
  }
  async function load(files: File[]) {
    setError("");
    if (!files.length) return;
    if (candidates.length + files.length > 100) {
      setError("Limite de 100 conversas por lote. Importe em lotes menores.");
      return;
    }
    if (files.reduce((n, file) => n + file.size, 0) > 60_000_000) {
      setError("Lote maior que 60 MB. Separe em lotes menores.");
      return;
    }
    setReading(true);
    const next: ChatProposal[] = [];
    const failures: string[] = [];
    for (const file of files) {
      try {
        const { text, fileName } = await readWhatsAppExport(file);
        const thread = parseWhatsAppText(fileName, text);
        if (!thread.messages.length) throw new Error("Nenhuma mensagem de WhatsApp reconhecida.");
        const review = reviewLocally(thread);
        const pipeline = suggestedPipeline(data, review.area);
        next.push({
          thread, review, selected: false,
          customerName: thread.name.slice(0, 120),
          phone: thread.phone,
          pipelineId: pipeline.id,
          stageId: pipeline.stages[0].id,
          businessTypeId: suggestedType(data, review.area),
        });
      } catch (e) {
        failures.push(file.name + ": " + (e instanceof Error ? e.message : "Falha na leitura"));
      }
    }
    setCandidates((previous) => {
      const known = new Set(previous.map((p) => p.thread.fileName + "|" + p.thread.lastAt));
      return [...previous, ...next.filter((p) => {
        const id = p.thread.fileName + "|" + p.thread.lastAt;
        if (known.has(id)) return false;
        known.add(id);
        return true;
      })].slice(0, 100);
    });
    setError(failures.slice(0, 4).join("\n"));
    setReading(false);
  }

  async function analyze(id: string) {
    const item = candidates.find((p) => p.thread.id === id);
    if (!item || !config.protected || !config.aiReady || !consent) return false;
    const size = item.thread.messages.reduce((sum, m) => sum + m.text.length, 0);
    if (size > 100_000 || item.thread.messages.length > 5_000 || item.review.partial) {
      revise(id, { partial: true });
      setError("Histórico muito longo para uma única análise completa. Não será importado automaticamente.");
      return false;
    }
    try {
      const response = await fetch("/api/chat-import", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: item.thread.name,
          isGroup: item.thread.isGroup,
          participants: item.thread.participants,
          messages: item.thread.messages,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.review) throw new Error(result.error || "Falha na análise.");
      const review = result.review as ChatReview;
      const pipeline = suggestedPipeline(data, review.area);
      setCandidates((list) => list.map((p) => p.thread.id === id ? {
        ...p, review, selected: false,
        pipelineId: pipeline.id, stageId: pipeline.stages[0].id,
        businessTypeId: suggestedType(data, review.area),
      } : p));
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "A análise não foi concluída.");
      return false;
    }
  }

  async function analyzeAll() {
    if (!config.aiReady || !config.protected || !consent) return;
    cancelled.current = false;
    setAnalyzing(true);
    setError("");
    const queue = candidates.filter((p) => p.review.method !== "ai");
    let ok = 0;
    for (let i = 0; i < queue.length; i++) {
      if (cancelled.current) break;
      setProgress((i + 1) + "/" + queue.length);
      if (await analyze(queue[i].thread.id)) ok++;
    }
    setProgress("");
    setAnalyzing(false);
    toast.info(ok + " conversa(s) analisada(s) com IA. Revise cada resultado.");
  }

  async function importSelection() {
    if (!config.protected) {
      toast.error("Proteja o CRM antes de importar dados reais.");
      return;
    }
    const approved = candidates.filter((p) => p.selected);
    if (!approved.length) return;
    if (approved.length > 30) {
      toast.error("Importe no máximo 30 oportunidades por operação.");
      return;
    }
    let result = { created: 0, skipped: 0 };
    const saved = await update((current) => {
      const output = importApprovedChats(current, approved);
      result = { created: output.created, skipped: output.skipped };
      return output.data;
    }, { operation: "chat_import" });
    if (saved) {
      toast.success(result.created + " oportunidades importadas; " + result.skipped + " ignoradas por segurança.");
      setCandidates((list) => list.map((p) =>
        approved.some((a) => a.thread.id === p.thread.id) ? { ...p, selected: false } : p
      ));
    }
  }

  const shown = candidates.filter((p) =>
    filter === "all" ||
    (filter === "recover" && p.review.category === "lead") ||
    (filter === "other" && p.review.category !== "lead")
  );
  const approvedCount = candidates.filter((p) => p.selected && eligible(p)).length;
  return (
    <div className="chat-import-view">
      <div className="page-intro">
        <div className="heading-eyebrow"><span className="green-dash" /> TRIAGEM COMERCIAL</div>
        <h1>Recuperação de leads</h1>
        <p>Leia exportações do WhatsApp, encontre conversas promissoras e escolha o que entra nos funis.</p>
      </div>
      {!config.protected ? (
        <div className="notice warning" role="alert">
          <AlertTriangle size={20} />
          <div>
            <strong>Modo demonstração público: não carregue conversas reais aqui.</strong>
            <p>O processamento preliminar ocorre no navegador. A análise por IA e a gravação de contatos importados só estarão disponíveis após configurar CRM_ACCESS_MODE=basic com senha segura.</p>
          </div>
        </div>
      ) : (
        <div className="notice" role="status">
          <Check size={18} /> CRM protegido. Os arquivos são lidos no navegador; o histórico completo não é gravado no CRM.
        </div>
      )}
      <div className="import-actions">
        <div>
          <strong>Importar exportações .TXT ou .ZIP</strong>
          <p>Até 100 arquivos por lote. ZIP com mídia: só o texto é lido. Nenhum contato é cadastrado automaticamente.</p>
        </div>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept=".zip,.txt"
          aria-label="Selecionar conversas do WhatsApp"
          onChange={(event) => {
            const files = Array.from(event.currentTarget.files || []);
            event.currentTarget.value = "";
            void load(files);
          }}
        />
        <Button onClick={() => fileRef.current?.click()} disabled={reading}>
          <FileUp size={17} /> {reading ? "Lendo arquivos..." : "Selecionar conversas"}
        </Button>
      </div>
      <div className="import-ai-strip">
        <label>
          <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} disabled={!config.protected} />
          Autorizo o envio do texto das conversas selecionadas à API da OpenAI para análise comercial.
        </label>
        <Button
          variant="primary"
          disabled={!config.aiReady || !config.protected || !consent || !candidates.length || analyzing}
          onClick={() => void analyzeAll()}
        >
          <BrainCircuit size={17} /> {analyzing ? "Analisando " + progress : "Analisar com IA"}
        </Button>
        {analyzing && <Button onClick={() => { cancelled.current = true; }}>Interromper após esta conversa</Button>}
        {!config.aiReady && <span className="import-hint">IA indisponível até configurar acesso protegido e chave no servidor. A triagem por regras não substitui a leitura completa.</span>}
      </div>
      {error && <p className="import-error" role="alert">{error}</p>}
      {candidates.length > 0 && (
        <>
          <div className="import-toolbar">
            <strong>{candidates.length} conversa(s) carregada(s)</strong>
            <label>
              <Search size={15} />
              <select aria-label="Filtrar conversas" value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="all">Todas</option>
                <option value="recover">Potenciais leads</option>
                <option value="other">Outras conversas</option>
              </select>
            </label>
            <Button onClick={() => { cancelled.current = true; setCandidates([]); setError(""); }}>
              <RotateCcw size={15} /> Limpar análise local
            </Button>
          </div>
          <div className="import-list">
            {shown.map((proposal) => {
              const existing = matchCustomer(data, proposal.customerName, proposal.phone);
              const target = data.pipelines.find((p) => p.id === proposal.pipelineId);
              const conflict = existing && data.deals.some((d) =>
                d.customerId === existing.id && d.pipelineId === proposal.pipelineId && d.status === "open"
              );
              return (
                <article className="import-row" key={proposal.thread.id}>
                  <div className="import-row-head">
                    <label className="import-select">
                      <input
                        type="checkbox"
                        aria-label={"Aprovar importação: " + proposal.customerName}
                        checked={proposal.selected}
                        disabled={!eligible(proposal) || Boolean(conflict)}
                        onChange={(event) => edit(proposal.thread.id, { selected: event.target.checked })}
                      />
                      <strong>{proposal.thread.name}</strong>
                    </label>
                    <span className="activity-badge">{CATEGORY[proposal.review.category]}</span>
                    <span className="import-subtle">{proposal.thread.messages.length} mensagens · última {proposal.thread.lastAt || "desconhecida"}</span>
                  </div>
                  <div className="import-row-grid">
                    <label>Classificação
                      <select
                        value={proposal.review.category}
                        onChange={(event) => revise(proposal.thread.id, { category: event.target.value as ChatCategory, method: "rules", confidence: "low" })}
                      >{Object.entries(CATEGORY).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
                    </label>
                    <label>Situação
                      <select
                        value={proposal.review.situation}
                        onChange={(event) => revise(proposal.thread.id, { situation: event.target.value as ChatSituation, method: "rules", confidence: "low" })}
                      >{Object.entries(SITUATION).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
                    </label>
                    <label>Nome do contato
                      <input value={proposal.customerName} maxLength={120} onChange={(e) => edit(proposal.thread.id, { customerName: e.target.value, selected: false })} />
                    </label>
                    <label>Telefone (se conhecido)
                      <input value={proposal.phone} maxLength={40} onChange={(e) => edit(proposal.thread.id, { phone: e.target.value, selected: false })} />
                    </label>
                    <label>Funil
                      <select
                        value={proposal.pipelineId}
                        onChange={(event) => {
                          const pipelineId = event.target.value;
                          edit(proposal.thread.id, {
                            pipelineId, stageId: suggestedStage(data, pipelineId), selected: false,
                          });
                        }}
                      >{data.pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                    </label>
                    <label>Etapa
                      <select
                        value={proposal.stageId}
                        onChange={(e) => edit(proposal.thread.id, { stageId: e.target.value, selected: false })}
                      >{target?.stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                    </label>
                    <label>Tipo de negócio
                      <select
                        value={proposal.businessTypeId}
                        onChange={(e) => edit(proposal.thread.id, { businessTypeId: e.target.value, selected: false })}
                      ><option value="">Não informado</option>
                        {data.businessTypes.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </label>
                  </div>
                  <div className="import-summary">
                    <strong>{proposal.review.method === "ai" ? "Análise por IA" : "Triagem preliminar"} · {AREA[proposal.review.area]} · Confiança {proposal.review.confidence}</strong>
                    <p>{proposal.review.summary}</p>
                    <p><b>Por quê:</b> {proposal.review.reason}</p>
                    <p><b>Ação sugerida:</b> {proposal.review.nextStep}</p>
                    {proposal.review.partial && <p className="import-error">Histórico parcial: revisão completa necessária. Não pode ser importado automaticamente.</p>}
                    {existing && <p className="import-duplicate">Contato existente: {existing.name}. Será reutilizado.</p>}
                    {conflict && <p className="import-duplicate">Já existe oportunidade aberta neste funil. Não será duplicada.</p>}
                    <details><summary>Ver evidências e contexto</summary>
                      {proposal.review.evidence.length ?
                        <ul>{proposal.review.evidence.map((evidence, i) => <li key={i}>{evidence}</li>)}</ul> :
                        <p>Não foram identificadas evidências suficientes.</p>}
                    </details>
                  </div>
                  {!eligible(proposal) && <span className="import-subtle">Não sugerida para importação. Corrija a classificação somente depois de ler a conversa.</span>}
                </article>
              );
            })}
          </div>
          <div className="import-footer">
            <p>{approvedCount} aprovada(s). Importação limitada a 30 por operação, sem envio de mensagens.</p>
            <Button variant="primary" disabled={!config.protected || !approvedCount || analyzing} onClick={() => void importSelection()}>
              <Check size={17} /> Importar oportunidades aprovadas
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
