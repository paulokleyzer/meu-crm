import {
  ArrowUpRight,
  CircleDollarSign,
  Target,
  Trophy,
  TrendingUp,
} from "lucide-react";
import type { CrmData } from "@/lib/types";
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
      <div className="insight-stats">
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
