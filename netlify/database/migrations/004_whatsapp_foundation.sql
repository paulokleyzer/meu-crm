-- Server-only foundation; no public webhook or real WhatsApp connection.
CREATE TABLE crm_conversations (
 id uuid PRIMARY KEY, channel text NOT NULL CHECK(channel='whatsapp_business'),
 external_contact_id text NOT NULL,customer_id text REFERENCES crm_customers(id) ON DELETE SET NULL,
 deal_id text REFERENCES crm_deals(id) ON DELETE SET NULL,
 ai_paused boolean NOT NULL DEFAULT true,ai_pause_reason text NOT NULL DEFAULT 'awaiting_activation',
 version bigint NOT NULL DEFAULT 0,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(channel,external_contact_id)
);
CREATE TABLE crm_messages (
 id uuid PRIMARY KEY,conversation_id uuid NOT NULL REFERENCES crm_conversations(id),
 provider_event_id text NOT NULL UNIQUE,provider_message_id text NOT NULL,
 direction text NOT NULL CHECK(direction IN('incoming','outgoing')),
 sender_kind text NOT NULL CHECK(sender_kind IN('customer','human','ai')),
 body text NOT NULL,occurred_at timestamptz NOT NULL,
 UNIQUE(conversation_id,provider_message_id)
);
CREATE INDEX crm_messages_conversation ON crm_messages(conversation_id,occurred_at);
