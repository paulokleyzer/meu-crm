import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { Pool } from "pg";
import { transaction } from "./database";

export async function migrate(
  pool: Pool,
  directory = join(process.cwd(), "netlify/database/migrations"),
) {
  await transaction(pool, async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(74382910)");
    const official = await client.query(
      "SELECT to_regclass('netlify.migrations') AS tracking",
    );
    if (official.rows[0].tracking)
      throw new Error("NETLIFY_MIGRATIONS_USE_OFFICIAL_RUNNER");
    await client.query(
      "CREATE TABLE IF NOT EXISTS crm_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())",
    );
    const files = (await readdir(directory))
      .filter((f) => /^\d+_[a-z0-9_]+\.sql$/.test(f))
      .sort();
    for (const name of files) {
      const sql = await readFile(join(directory, name), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const previous = await client.query(
        "SELECT checksum FROM crm_migrations WHERE name=$1",
        [name],
      );
      if (previous.rows.length) {
        if (previous.rows[0].checksum !== checksum)
          throw new Error(`MIGRATION_CHECKSUM_MISMATCH: ${name}`);
      } else {
        await client.query(sql);
        await client.query(
          "INSERT INTO crm_migrations(name,checksum) VALUES ($1,$2)",
          [name, checksum],
        );
      }
    }
  });
}
