"use client";

import { useState } from "react";
import {
  ArrowUpRight,
  Building2,
  Mail,
  Plus,
  Search,
  Users,
} from "lucide-react";
import type { CrmData, Customer } from "@/lib/types";
import { initials, money, normalized } from "@/lib/format";
import { whatsappUrl } from "@/lib/crm-v2";
import { Button } from "./ui";

export function CustomersView({
  data,
  onAdd,
  onEdit,
}: {
  data: CrmData;
  onAdd: () => void;
  onEdit: (customer: Customer) => void;
}) {
  const [query, setQuery] = useState("");
  const customers = data.customers.filter((c) =>
    normalized(`${c.name} ${c.company} ${c.email} ${c.phone}`).includes(
      normalized(query),
    ),
  );
  return (
    <div className="customers-view">
      <div className="page-intro">
        <div>
          <span className="eyebrow">RELACIONAMENTOS</span>
          <h1>Boas conexões, grandes negócios.</h1>
          <p>Todos os seus clientes, com o contexto que importa.</p>
        </div>
        <Button variant="primary" onClick={onAdd}>
          <Plus size={17} /> Novo cliente
        </Button>
      </div>
      <div className="customers-toolbar">
        <h2>
          Seus clientes{" "}
          <span className="count-badge">{data.customers.length}</span>
        </h2>
        <label className="search-field">
          <Search size={17} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar clientes..."
            aria-label="Buscar clientes"
          />
        </label>
      </div>
      {customers.length ? (
        <div className="customer-grid">
          {customers.map((c, i) => {
            const deals = data.deals.filter((d) => d.customerId === c.id);
            return (
              <div className="customer-card-wrap" key={c.id}>
                <button
                  className="customer-card"
                  onClick={() => onEdit(c)}
                  aria-label={`Editar cliente ${c.name}`}
                >
                  <div className="customer-card-top">
                    <span className={`avatar customer-avatar avatar-${i % 4}`}>
                      {initials(c.name)}
                    </span>
                    <ArrowUpRight size={18} />
                  </div>
                  <h3>{c.name}</h3>
                  <span className="customer-company">
                    <Building2 size={14} />
                    {c.company || "Cliente pessoa física"}
                  </span>
                  <span className="customer-email">
                    <Mail size={14} />
                    {c.email || "E-mail não informado"}
                  </span>
                  <div className="customer-card-footer">
                    <span>
                      {deals.length} oportunidade{deals.length !== 1 ? "s" : ""}
                    </span>
                    <strong>
                      {money(
                        deals
                          .filter((d) => d.status !== "lost")
                          .reduce((sum, d) => sum + d.value, 0),
                      )}
                    </strong>
                  </div>
                </button>
                {whatsappUrl(c.phone) && (
                  <a
                    className="whatsapp-link"
                    href={whatsappUrl(c.phone)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Conversar no WhatsApp com ${c.name}`}
                  >
                    Abrir WhatsApp ↗
                  </a>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <Users size={32} />
          <h3>Nenhum cliente encontrado</h3>
          <p>Experimente outra busca ou cadastre seu primeiro contato.</p>
          <Button onClick={onAdd}>
            <Plus size={16} /> Cadastrar cliente
          </Button>
        </div>
      )}
    </div>
  );
}
