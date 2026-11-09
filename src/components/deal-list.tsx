import { ArrowUpRight, Building2 } from "lucide-react";
import type { CrmData, Deal, Pipeline } from "@/lib/types";
import { STATUS_LABELS } from "@/lib/types";
import { initials, money } from "@/lib/format";

export function DealList({
  deals,
  pipeline,
  data,
  onOpen,
}: {
  deals: Deal[];
  pipeline: Pipeline;
  data: CrmData;
  onOpen: (deal: Deal) => void;
}) {
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>Oportunidade</th>
            <th>Cliente</th>
            <th>Valor</th>
            <th>Etapa</th>
            <th>Responsável</th>
            <th>Status</th>
            <th>
              <span className="sr-only">Ações</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {deals.map((deal) => {
            const customer = data.customers.find(
              (c) => c.id === deal.customerId,
            );
            return (
              <tr key={deal.id}>
                <td>
                  <button className="table-link" onClick={() => onOpen(deal)}>
                    {deal.title}
                  </button>
                </td>
                <td>
                  <span className="table-company">
                    <Building2 size={14} />
                    {customer?.company || customer?.name}
                  </span>
                </td>
                <td className="value-cell">{money(deal.value)}</td>
                <td>
                  <span className="stage-pill">
                    {pipeline.stages.find((s) => s.id === deal.stageId)?.name}
                  </span>
                </td>
                <td>
                  <span className="owner-cell">
                    <span className="avatar avatar-small">
                      {initials(deal.owner)}
                    </span>
                    {deal.owner.split(" ")[0]}
                  </span>
                </td>
                <td>
                  <span className={`status-badge ${deal.status}`}>
                    {STATUS_LABELS[deal.status]}
                  </span>
                </td>
                <td>
                  <button
                    className="icon-button"
                    aria-label={`Editar ${deal.title}`}
                    onClick={() => onOpen(deal)}
                  >
                    <ArrowUpRight size={17} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
