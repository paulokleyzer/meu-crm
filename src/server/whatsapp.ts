// Future official integration only. This module exposes no HTTP endpoint and
// never sends messages. A future adapter MUST verify Meta's signature before
// calling it and map supported business-app echoes explicitly as human events.
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { z } from "zod";
import { transaction } from "./database";

const eventSchema = z
  .object({
    eventId: z.string().min(1).max(200),
    messageId: z.string().min(1).max(200),
    externalContactId: z.string().min(1).max(200),
    direction: z.enum(["incoming", "outgoing"]),
    senderKind: z.enum(["customer", "human", "ai"]),
    body: z.string().max(10000),
    occurredAt: z.iso.datetime(),
  })
  .refine(
    (e) =>
      e.direction === "incoming"
        ? e.senderKind === "customer"
        : e.senderKind !== "customer",
    "Direção e remetente incompatíveis.",
  );
export type VerifiedWhatsAppEvent = z.infer<typeof eventSchema>;
export class ConversationVersionConflict extends Error {}
export async function recordVerifiedWhatsAppEvent(
  pool: Pool,
  input: VerifiedWhatsAppEvent,
) {
  const event = eventSchema.parse(input);
  return transaction(pool, async (client) => {
    await client.query(
      "INSERT INTO crm_conversations(id,channel,external_contact_id) VALUES ($1,'whatsapp_business',$2) ON CONFLICT(channel,external_contact_id) DO NOTHING",
      [randomUUID(), event.externalContactId],
    );
    const conversation = (
      await client.query(
        "SELECT id,ai_paused,version FROM crm_conversations WHERE channel='whatsapp_business' AND external_contact_id=$1 FOR UPDATE",
        [event.externalContactId],
      )
    ).rows[0];
    const inserted = await client.query(
      `INSERT INTO crm_messages(id,conversation_id,provider_event_id,provider_message_id,direction,sender_kind,body,occurred_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING RETURNING id`,
      [
        randomUUID(),
        conversation.id,
        event.eventId,
        event.messageId,
        event.direction,
        event.senderKind,
        event.body,
        event.occurredAt,
      ],
    );
    if (!inserted.rows.length)
      return { conversationId: conversation.id, duplicate: true };
    // Incoming messages never resume the AI. Only explicit server-side resume
    // can do so; a human reply increments the revision under the same row lock.
    await client.query(
      "UPDATE crm_conversations SET version=version+1,ai_paused=CASE WHEN $2 THEN true ELSE ai_paused END,ai_pause_reason=CASE WHEN $2 THEN 'human_reply' ELSE ai_pause_reason END WHERE id=$1",
      [
        conversation.id,
        event.direction === "outgoing" && event.senderKind === "human",
      ],
    );
    return { conversationId: conversation.id, duplicate: false };
  });
}
export async function resumeConversationAI(
  pool: Pool,
  conversationId: string,
  expectedVersion: number,
) {
  z.uuid().parse(conversationId);
  z.number().int().nonnegative().parse(expectedVersion);
  const result = await pool.query(
    "UPDATE crm_conversations SET ai_paused=false,ai_pause_reason='',version=version+1 WHERE id=$1 AND version=$2 RETURNING version",
    [conversationId, expectedVersion],
  );
  if (!result.rows.length) throw new ConversationVersionConflict();
  return Number(result.rows[0].version);
}
