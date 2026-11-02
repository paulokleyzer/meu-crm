import { createHash } from "node:crypto";
import type { Pool } from "pg";
import { accessMode } from "./access";

export class DemoLimitExceeded extends Error {}
// Shared PostgreSQL counters work across Netlify Function instances. Never
// trust arbitrary x-forwarded-for values supplied by a browser.
export async function enforceDemoLimit(pool: Pool, request: Request) {
  if (accessMode() !== "demo") return;
  const writing = !["GET", "HEAD", "OPTIONS"].includes(request.method);
  const ip =
    process.env.NETLIFY === "true"
      ? request.headers.get("x-nf-client-connection-ip") || "shared"
      : "local";
  const actor = createHash("sha256")
    .update(`${process.env.SITE_ID || "local"}:${ip}`)
    .digest("hex");
  const prefix = writing ? "write" : "read";
  const keys = [`${prefix}:${actor}`, `${prefix}:global`];
  const result = await pool.query(
    `
    WITH limits(bucket,cap) AS (VALUES ($1::text,$3::int),($2::text,$4::int)),
    pruned AS (DELETE FROM crm_demo_limits WHERE window_start < now()-interval '10 minutes' AND bucket NOT IN ($1,$2)),
    counted AS (
      INSERT INTO crm_demo_limits(bucket,window_start,hits) SELECT bucket,now(),1 FROM limits
      ON CONFLICT(bucket) DO UPDATE SET
        hits=CASE WHEN crm_demo_limits.window_start <= now()-interval '60 seconds' THEN 1 ELSE crm_demo_limits.hits+1 END,
        window_start=CASE WHEN crm_demo_limits.window_start <= now()-interval '60 seconds' THEN now() ELSE crm_demo_limits.window_start END
      RETURNING bucket,hits
    ) SELECT bool_and(counted.hits<=limits.cap) AS allowed FROM counted JOIN limits USING(bucket)
  `,
    [...keys, writing ? 120 : 300, writing ? 600 : 2400],
  );
  if (!result.rows[0]?.allowed) throw new DemoLimitExceeded();
}
