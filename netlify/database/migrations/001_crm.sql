CREATE TABLE crm_state (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0)
);
INSERT INTO crm_state(singleton) VALUES (true);

CREATE TABLE crm_pipelines (
  id text PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 100),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  description text NOT NULL DEFAULT '',
  position integer NOT NULL UNIQUE CHECK (position >= 0)
);
CREATE TABLE crm_stages (
  id text PRIMARY KEY,
  pipeline_id text NOT NULL REFERENCES crm_pipelines(id),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  probability integer NOT NULL CHECK (probability BETWEEN 0 AND 100),
  position integer NOT NULL CHECK (position >= 0),
  UNIQUE (pipeline_id, position), UNIQUE (id, pipeline_id)
);
CREATE TABLE crm_customers (
  id text PRIMARY KEY, name text NOT NULL,
  company text NOT NULL DEFAULT '', email text NOT NULL DEFAULT '', phone text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL
);
CREATE TABLE crm_deals (
  id text PRIMARY KEY, title text NOT NULL,
  value numeric(14,2) NOT NULL CHECK (value >= 0),
  customer_id text NOT NULL REFERENCES crm_customers(id),
  pipeline_id text NOT NULL REFERENCES crm_pipelines(id),
  stage_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('open','won','lost')),
  priority text NOT NULL CHECK (priority IN ('low','medium','high')),
  owner text NOT NULL, source text NOT NULL DEFAULT '', expected_close_date date,
  notes text NOT NULL DEFAULT '', position integer NOT NULL CHECK (position >= 0),
  created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL,
  FOREIGN KEY (stage_id, pipeline_id) REFERENCES crm_stages(id, pipeline_id)
);
CREATE INDEX crm_deals_stage ON crm_deals(stage_id, position);
CREATE INDEX crm_deals_customer ON crm_deals(customer_id);
CREATE TABLE crm_activities (
  id text PRIMARY KEY, deal_id text NOT NULL REFERENCES crm_deals(id) ON DELETE CASCADE,
  text text NOT NULL, created_at timestamptz NOT NULL, position integer NOT NULL UNIQUE
);
CREATE INDEX crm_activities_deal ON crm_activities(deal_id, created_at);
CREATE TABLE crm_history (
  revision bigint PRIMARY KEY,
  request_id uuid NOT NULL UNIQUE,
  payload_hash text NOT NULL,
  operation text NOT NULL CHECK (operation IN ('change','import','seed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  before_data jsonb NOT NULL, after_data jsonb NOT NULL
);

INSERT INTO crm_pipelines VALUES ('pipeline-sales','Funil de vendas','Da primeira conversa ao próximo grande negócio.',0);
INSERT INTO crm_stages VALUES
 ('stage-lead','pipeline-sales','Novo lead',10,0),
 ('stage-qualified','pipeline-sales','Qualificação',25,1),
 ('stage-proposal','pipeline-sales','Proposta enviada',50,2),
 ('stage-negotiation','pipeline-sales','Negociação',75,3),
 ('stage-closing','pipeline-sales','Fechamento',90,4);
