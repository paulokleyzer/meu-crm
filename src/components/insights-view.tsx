import {
  ArrowUpRight,
  CircleDollarSign,
  Target,
  Trophy,
  TrendingUp,
} from "lucide-react";
import { results } from "@/lib/crm-v2";
import type { CrmData, Deal } from "@/lib/types";
import { money } from "@/lib/format";

export function InsightsView({ data }: { data: CrmData }) {
  const open = data.deals.filter((d) => d.status === "open");
  const won = data.deals.filter((d) => d.status === "won");
  const closed = data.deals.filter((d) => d.status !== "open");
  return (
    <div className="insights-view">
      <div className="page-intro">
        <div>
          <span className="eyebrow">VISÃO GERAL</span>
          <h1>Clareza para o próximo passo.</h1>
          <p>Uma visão dos seus resultados em todos os funis.</p>
        </div>
        <span className="period-pill">Todos os períodos</span>
      </div>
      <div className="insight-stats v2-stats">
        <div className="insight-stat">
          <CircleDollarSign />
          <span>Em oportunidades</span>
          <strong>{money(open.reduce((s, d) => s + d.value, 0))}</strong>
          <small>{open.length} negócios em aberto</small>
        </div>
        <div className="insight-stat">
          <Trophy />
          <span>Receita conquistada</span>
          <strong>{money(won.reduce((s, d) => s + d.value, 0))}</strong>
          <small>{won.length} negócios ganhos</small>
        </div>
        <div className="insight-stat">
          <Target />
          <span>Taxa de conversão</span>
          <strong>
            {closed.length ? Math.round((won.length / closed.length) * 100) : 0}
            %
          </strong>
          <small>Ganhos ÷ negócios encerrados</small>
        </div>
        <div className="insight-stat">
          <Target />
          <span>Negócios perdidos</span>
          <strong>
            {data.deals.filter((d) => d.status === "lost").length}
          </strong>
          <small>
            Valor total da base:{" "}
            {money(data.deals.reduce((sum, d) => sum + d.value, 0))}
          </small>
        </div>
      </div>
      <div className="insights-panel">
        <div className="panel-heading">
          <TrendingUp size={19} />
          <h2>Oportunidades por funil</h2>
          <span>Valores em aberto</span>
        </div>
        {data.pipelines.map((p) => {
          const deals = open.filter((d) => d.pipelineId === p.id);
          const total = deals.reduce((s, d) => s + d.value, 0);
          const maximum = Math.max(
            1,
            ...data.pipelines.map((p) =>
              open
                .filter((d) => d.pipelineId === p.id)
                .reduce((s, d) => s + d.value, 0),
            ),
          );
          return (
            <div className="pipeline-insight" key={p.id}>
              <div>
                <h3>{p.name}</h3>
                <span>{deals.length} oportunidades</span>
                <strong>{money(total)}</strong>
              </div>
              <div className="insight-bar">
                <span style={{ width: `${(total / maximum) * 100}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <ResultsTable
        title="Conversão por funil"
        groups={data.pipelines.map((p) => ({
          id: p.id,
          name: p.name,
          deals: data.deals.filter((d) => d.pipelineId === p.id),
        }))}
      />
      <ResultsTable
        title="Resultados por origem"
        groups={[
          ...data.sources.map((s) => ({
            id: s.id,
            name: s.name,
            deals: data.deals.filter((d) => d.source === s.name),
          })),
          {
            id: "without-source",
            name: "Sem origem",
            deals: data.deals.filter((d) => !d.source),
          },
        ]}
      />
      <ResultsTable
        title="Resultados por tipo de negócio"
        groups={[
          ...data.businessTypes.map((b) => ({
            id: b.id,
            name: b.name,
            deals: data.deals.filter((d) => d.businessTypeId === b.id),
          })),
          {
            id: "without-type",
            name: "Sem classificação",
            deals: data.deals.filter((d) => !d.businessTypeId),
          },
        ]}
      />
      <ResultsTable
        title="Resultados por responsável"
        groups={data.sellers.map((s) => ({
          id: s.id,
          name: `${s.name}${s.active ? "" : " (inativo)"}`,
          deals: data.deals.filter((d) => d.owner === s.name),
        }))}
      />
      <div className="insight-note">
        <ArrowUpRight size={20} />
        <div>
          <h3>O próximo resultado começa no funil.</h3>
          <p>
            Mantenha as etapas atualizadas e registre suas oportunidades para
            acompanhar sua evolução.
          </p>
        </div>
      </div>
    </div>
  );
}

function ResultsTable({
  title,
  groups,
}: {
  title: string;
  groups: { id: string; name: string; deals: Deal[] }[];
}) {
  return (
    <section className="insights-panel">
      <div className="panel-heading">
        <h2>{title}</h2>
      </div>
      <div className="results-scroll">
        <table className="results-table">
          <caption className="sr-only">
            {title}. Conversão: ganhos divididos pelos negócios encerrados.
          </caption>
          <thead>
            <tr>
              <th>Grupo</th>
              <th>Abertas</th>
              <th>Ganhos</th>
              <th>Perdidos</th>
              <th>Valor total</th>
              <th>Valor ganho</th>
              <th>Conversão</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => {
              const r = results(g.deals);
              return (
                <tr key={g.id}>
                  <th scope="row">{g.name}</th>
                  <td>{r.open}</td>
                  <td>{r.won}</td>
                  <td>{r.lost}</td>
                  <td>{money(r.total)}</td>
                  <td>{money(r.wonValue)}</td>
                  <td>{r.conversion}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted">
        Conversão = ganhos ÷ (ganhos + perdidos). Todos os períodos.
      </p>
    </section>
  );
}
