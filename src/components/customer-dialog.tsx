"use client";

import { getEditToken } from "@/hooks/use-crm";

import { useState } from "react";
import type { Customer, CustomerInput } from "@/lib/types";
import { Button, Field, Modal } from "./ui";

export function CustomerDialog({
  customer,
  onClose,
  onSave,
}: {
  customer?: Customer;
  onClose: () => void;
  onSave: (
    input: CustomerInput,
    id?: string,
    editToken?: number,
  ) => Promise<unknown>;
}) {
  const [editToken] = useState(getEditToken);
  const [saving, setSaving] = useState(false);
  return (
    <Modal
      open
      onOpenChange={(open) => !open && onClose()}
      title={customer ? "Editar cliente" : "Cadastrar cliente"}
      description="Pessoas e empresas por trás de grandes oportunidades."
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setSaving(true);
          try {
            await onSave(
              {
                name: String(f.get("name")).trim(),
                company: String(f.get("company")).trim(),
                email: String(f.get("email")).trim(),
                phone: String(f.get("phone")).trim(),
              },
              customer?.id,
              editToken,
            );
          } finally {
            setSaving(false);
          }
        }}
      >
        <div className="dialog-body form-stack">
          <Field label="Nome do contato *">
            <input
              name="name"
              autoFocus
              defaultValue={customer?.name}
              required
              maxLength={120}
              autoComplete="name"
              placeholder="Ex.: Ana Oliveira"
            />
          </Field>
          <Field label="Empresa">
            <input
              name="company"
              defaultValue={customer?.company}
              maxLength={160}
              autoComplete="organization"
              placeholder="Nome da empresa"
            />
          </Field>
          <div className="form-grid">
            <Field label="E-mail">
              <input
                name="email"
                type="email"
                defaultValue={customer?.email}
                autoComplete="email"
                placeholder="contato@empresa.com"
              />
            </Field>
            <Field label="Telefone">
              <input
                name="phone"
                type="tel"
                defaultValue={customer?.phone}
                maxLength={40}
                autoComplete="tel"
                placeholder="(11) 99999-9999"
              />
            </Field>
          </div>
        </div>
        <div className="dialog-footer">
          <Button onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving} variant="primary">
            {customer ? "Salvar cliente" : "Cadastrar cliente"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
