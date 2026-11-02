import { writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { getPool } from "../src/server/database";
import { migrate } from "../src/server/migrate";
import { PostgresCrmRepository } from "../src/server/postgres-repository";
import { createSeedData } from "../src/lib/seed";

const pool = getPool();
try {
  const command = process.argv[2];
  if (command === "migrate") {
    await migrate(pool);
    console.log("Migrações aplicadas.");
  } else if (command === "seed") {
    const repo = new PostgresCrmRepository(pool),
      current = await repo.load();
    if (
      current.revision !== 0 ||
      current.data.customers.length ||
      current.data.deals.length
    )
      throw new Error("SEED_REQUIRES_EMPTY_DATABASE");
    await repo.save({
      data: createSeedData(),
      baseRevision: 0,
      requestId: randomUUID(),
      operation: "seed",
    });
    console.log("Dados fictícios gravados no PostgreSQL.");
  } else if (command === "export") {
    const file = process.argv[3];
    if (!file) throw new Error("OUTPUT_PATH_REQUIRED");
    const { data } = await new PostgresCrmRepository(pool).load();
    await writeFile(file, JSON.stringify(data, null, 2), {
      mode: 0o600,
      flag: "wx",
    });
    console.log("Backup JSON exportado sem sobrescrever arquivos existentes.");
  } else throw new Error("Use migrate, seed ou export <arquivo>.");
} catch (error) {
  console.error(
    "Operação do banco falhou:",
    error instanceof Error && /^[A-Z_]+$/.test(error.message)
      ? error.message
      : "Verifique a conexão, as permissões e as migrações.",
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
