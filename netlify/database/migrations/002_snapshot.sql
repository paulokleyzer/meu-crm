-- Read cache updated atomically with normalized rows and audit history.
-- One indexed row read is enough to answer conditional synchronization requests.
CREATE FUNCTION crm_build_snapshot() RETURNS jsonb LANGUAGE sql STABLE AS $$
SELECT jsonb_build_object(
 'schemaVersion',1,
 'pipelines', COALESCE((SELECT jsonb_agg(jsonb_build_object(
   'id',p.id,'name',p.name,'description',p.description,
   'stages',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'probability',s.probability) ORDER BY s.position) FROM crm_stages s WHERE s.pipeline_id=p.id),'[]'::jsonb)
 ) ORDER BY p.position) FROM crm_pipelines p),'[]'::jsonb),
 'customers', COALESCE((SELECT jsonb_agg(jsonb_build_object(
   'id',c.id,'name',c.name,'company',c.company,'email',c.email,'phone',c.phone,
   'createdAt',to_char(c.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
 ) ORDER BY c.created_at,c.id) FROM crm_customers c),'[]'::jsonb),
 'deals', COALESCE((SELECT jsonb_agg(jsonb_build_object(
   'id',d.id,'title',d.title,'value',d.value,'customerId',d.customer_id,'pipelineId',d.pipeline_id,'stageId',d.stage_id,
   'status',d.status,'priority',d.priority,'owner',d.owner,'source',d.source,
   'expectedCloseDate',COALESCE(to_char(d.expected_close_date,'YYYY-MM-DD'),''),'notes',d.notes,'position',d.position,
   'createdAt',to_char(d.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
   'updatedAt',to_char(d.updated_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
 ) ORDER BY d.position,d.id) FROM crm_deals d),'[]'::jsonb),
 'activities', COALESCE((SELECT jsonb_agg(jsonb_build_object(
   'id',a.id,'dealId',a.deal_id,'text',a.text,'createdAt',to_char(a.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
 ) ORDER BY a.position) FROM crm_activities a),'[]'::jsonb)
);
$$;
ALTER TABLE crm_state ADD COLUMN snapshot jsonb;
UPDATE crm_state SET snapshot=crm_build_snapshot();
ALTER TABLE crm_state ALTER COLUMN snapshot SET NOT NULL;

-- Reordering/upserting a batch may transiently share positions. Check the final
-- state at COMMIT, while keeping primary IDs usable as ON CONFLICT targets.
ALTER TABLE crm_pipelines DROP CONSTRAINT crm_pipelines_position_key;
ALTER TABLE crm_pipelines ADD UNIQUE(position) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE crm_stages DROP CONSTRAINT crm_stages_pipeline_id_position_key;
ALTER TABLE crm_stages ADD UNIQUE(pipeline_id,position) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE crm_activities DROP CONSTRAINT crm_activities_position_key;
ALTER TABLE crm_activities ADD UNIQUE(position) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE crm_stages ALTER CONSTRAINT crm_stages_pipeline_id_fkey DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE crm_deals ALTER CONSTRAINT crm_deals_customer_id_fkey DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE crm_deals ALTER CONSTRAINT crm_deals_pipeline_id_fkey DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE crm_deals ALTER CONSTRAINT crm_deals_stage_id_pipeline_id_fkey DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE crm_activities ALTER CONSTRAINT crm_activities_deal_id_fkey DEFERRABLE INITIALLY DEFERRED;
