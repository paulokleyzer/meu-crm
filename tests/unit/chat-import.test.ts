import { describe, expect, it } from "vitest";
import { createSeedData } from "../../src/lib/seed";
import {
  importApprovedChats,
  matchCustomer,
  parseWhatsAppText,
  reviewLocally,
  type ChatProposal,
} from "../../src/lib/chat-import";

const demo = [
  "[08/11/2026, 11:23:19] Vendedor: Olá, consigo mandar o orçamento amanhã.",
  "[08/11/2026, 11:24:03] João Silva: Quero um orçamento para energia solar.",
  "[09/11/2026, 13:02:51] João Silva: Ainda tenho interesse, pode mandar.",
].join("\n");
const prepare = () => {
  const data = createSeedData();
  const thread = parseWhatsAppText("Conversa do WhatsApp com João Silva.txt", demo);
  const review = reviewLocally(thread);
  const proposal: ChatProposal = {
    thread, review: { ...review, category: "lead", situation: "recoverable", partial: false },
    selected: true, customerName: "João Silva", phone: "+55 19 98999-1010",
    pipelineId: data.pipelines[0].id,
    stageId: data.pipelines[0].stages[0].id,
    businessTypeId: "",
  };
  return { data, proposal };
};

describe("importação segura de conversas", () => {
  it("interpreta datas do iPhone e mensagens com várias linhas", () => {
    const thread = parseWhatsAppText(
      "WhatsApp Chat with Cliente.txt",
      "[01/02/2026, 10:30:00] Cliente: Quanto custa?\nUma segunda linha.\n" +
        "[01/02/2026, 10:31:00] Você: Vou verificar.",
    );
    expect(thread.messages).toHaveLength(2);
    expect(thread.messages[0].at).toBe("2026-02-01 10:30:00");
    expect(thread.messages[0].text).toContain("Uma segunda linha.");
    expect(thread.name).toBe("Cliente");
  });

  it("interpreta exportação de Android", () => {
    const thread = parseWhatsAppText(
      "Conversa do WhatsApp com Ana.txt",
      "09/11/2026, 14:01 - Ana: Boa tarde\n09/11/2026, 14:02 - Eu: Olá",
    );
    expect(thread.name).toBe("Ana");
    expect(thread.messages[1].sender).toBe("Eu");
    expect(thread.isGroup).toBe(false);
  });

  it("não transforma grupos de integradores em clientes", () => {
    const chat = parseWhatsAppText("Grupo Integradores.zip", [
      "[09/11/2026, 10:30:00] Bruno: Alguém tem inversor?",
      "[09/11/2026, 10:31:00] Clara: Tenho estoque.",
      "[09/11/2026, 10:32:00] Diego: Me passa preço.",
    ].join("\n"));
    expect(chat.isGroup).toBe(true);
    expect(reviewLocally(chat).category).toBe("group");
  });

  it("não decide desistência definitiva por palavra-chave", () => {
    const chat = parseWhatsAppText("Cliente.txt",
      "[09/11/2026, 10:30:00] Cliente: Não tenho mais interesse em energia solar."
    );
    const review = reviewLocally(chat);
    expect(review.situation).toBe("possible_loss");
    expect(review.confidence).toBe("low");
  });

  it("nunca importa sem aprovação ou quando a análise é parcial", () => {
    const { data, proposal } = prepare();
    expect(importApprovedChats(data, [{ ...proposal, selected: false }]).created).toBe(0);
    expect(importApprovedChats(data, [{
      ...proposal, review: { ...proposal.review, partial: true },
    }]).created).toBe(0);
  });

  it("cria cliente e oportunidade aprovados sem salvar transcrição integral", () => {
    const { data, proposal } = prepare();
    const result = importApprovedChats(data, [proposal]);
    expect(result.created).toBe(1);
    const customer = result.data.customers.at(-1)!;
    expect(customer.name).toBe("João Silva");
    const deal = result.data.deals.at(-1)!;
    expect(deal.customerId).toBe(customer.id);
    expect(deal.source).toBe("WhatsApp histórico");
    expect(deal.notes).toContain("Importação revisada");
    expect(deal.notes).not.toContain("Olá, consigo mandar o orçamento amanhã");
  });

  it("reutiliza clientes existentes e impede duplicar negociação aberta", () => {
    const { data, proposal } = prepare();
    const first = importApprovedChats(data, [proposal]).data;
    const second = importApprovedChats(first, [proposal]);
    expect(second.created).toBe(0);
    expect(second.skipped).toBe(1);
    expect(second.data.customers).toHaveLength(first.customers.length);
    expect(second.data.deals).toHaveLength(first.deals.length);
    expect(matchCustomer(first, "João Silva", "")?.name).toBe("João Silva");
  });
});
