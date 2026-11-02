-- Additive upgrade. Existing pipelines, stages, deals and audit history survive.
CREATE TABLE crm_business_types (
 id text PRIMARY KEY, name text NOT NULL, position integer NOT NULL CHECK(position>=0),
 UNIQUE(name) DEFERRABLE INITIALLY DEFERRED, UNIQUE(position) DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE crm_sources (
 id text PRIMARY KEY, name text NOT NULL, position integer NOT NULL CHECK(position>=0),
 UNIQUE(name) DEFERRABLE INITIALLY DEFERRED, UNIQUE(position) DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE crm_sellers (
 id text PRIMARY KEY, name text NOT NULL, active boolean NOT NULL DEFAULT true,
 position integer NOT NULL CHECK(position>=0),
 UNIQUE(name) DEFERRABLE INITIALLY DEFERRED, UNIQUE(position) DEFERRABLE INITIALLY DEFERRED
);
INSERT INTO crm_sources(id,name,position)
 SELECT 'migrated-source-'||md5(source),source,row_number() OVER(ORDER BY source)-1
 FROM (SELECT DISTINCT source FROM crm_deals WHERE source<>'') names;
INSERT INTO crm_sellers(id,name,active,position)
 SELECT 'migrated-seller-'||md5(owner),owner,true,row_number() OVER(ORDER BY owner)-1
 FROM (SELECT DISTINCT owner FROM crm_deals) names;
INSERT INTO crm_sellers(id,name,active,position)
 SELECT 'seller-team','Equipe',true,0 WHERE NOT EXISTS(SELECT 1 FROM crm_sellers);
ALTER TABLE crm_deals ADD COLUMN business_type_id text REFERENCES crm_business_types(id) DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX crm_deals_business_type ON crm_deals(business_type_id);
CREATE INDEX crm_deals_source ON crm_deals(source);
CREATE INDEX crm_deals_owner ON crm_deals(owner);
CREATE TABLE crm_distribution_rules (
 id text PRIMARY KEY,name text NOT NULL,business_type_id text REFERENCES crm_business_types(id) DEFERRABLE INITIALLY DEFERRED,
 source text NOT NULL DEFAULT '',pipeline_id text NOT NULL REFERENCES crm_pipelines(id) DEFERRABLE INITIALLY DEFERRED,
 enabled boolean NOT NULL,is_default boolean NOT NULL,position integer NOT NULL CHECK(position>=0),
 UNIQUE(position) DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE crm_scheduled_activities (
 id text PRIMARY KEY,title text NOT NULL,type text NOT NULL CHECK(type IN('task','call','meeting','follow_up')),
 due_at timestamptz NOT NULL,customer_id text REFERENCES crm_customers(id) DEFERRABLE INITIALLY DEFERRED,
 deal_id text REFERENCES crm_deals(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
 owner text NOT NULL,completed_at timestamptz,notes text NOT NULL DEFAULT '',
 remind_before_minutes integer NOT NULL CHECK(remind_before_minutes BETWEEN 0 AND 1440),created_at timestamptz NOT NULL,
 CHECK(customer_id IS NOT NULL OR deal_id IS NOT NULL)
);
CREATE INDEX crm_scheduled_due ON crm_scheduled_activities(due_at) WHERE completed_at IS NULL;
CREATE INDEX crm_scheduled_deal ON crm_scheduled_activities(deal_id);
CREATE TABLE crm_demo_limits(bucket text PRIMARY KEY,window_start timestamptz NOT NULL,hits integer NOT NULL CHECK(hits>0));
CREATE INDEX crm_demo_limits_expiry ON crm_demo_limits(window_start);

ALTER FUNCTION crm_build_snapshot() RENAME TO crm_build_snapshot_v1;
CREATE FUNCTION crm_build_snapshot() RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT crm_build_snapshot_v1() || jsonb_build_object(
 'schemaVersion',2,
 'businessTypes',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'name',name) ORDER BY position) FROM crm_business_types),'[]'::jsonb),
 'sources',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'name',name) ORDER BY position) FROM crm_sources),'[]'::jsonb),
 'sellers',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'name',name,'active',active) ORDER BY position) FROM crm_sellers),'[]'::jsonb),
 'distributionRules',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'name',name,'businessTypeId',COALESCE(business_type_id,''),'source',source,'pipelineId',pipeline_id,'enabled',enabled,'isDefault',is_default) ORDER BY position) FROM crm_distribution_rules),'[]'::jsonb),
 'scheduledActivities',COALESCE((SELECT jsonb_agg(jsonb_build_object(
   'id',id,'title',title,'type',type,'dueAt',to_char(due_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
   'customerId',COALESCE(customer_id,''),'dealId',COALESCE(deal_id,''),'owner',owner,
   'completedAt',COALESCE(to_char(completed_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),''),
   'notes',notes,'remindBeforeMinutes',remind_before_minutes,
   'createdAt',to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) ORDER BY created_at,id) FROM crm_scheduled_activities),'[]'::jsonb),
 'deals',COALESCE((SELECT jsonb_agg(old.value || jsonb_build_object('businessTypeId',COALESCE(d.business_type_id,'')) ORDER BY d.position,d.id)
   FROM jsonb_array_elements(crm_build_snapshot_v1()->'deals') old(value) JOIN crm_deals d ON d.id=old.value->>'id'),'[]'::jsonb)
 );
$$;
UPDATE crm_state SET snapshot=crm_build_snapshot();
