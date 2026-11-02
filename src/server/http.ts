import { checkAccess } from "./access";
import { getPool, releaseRequestPool } from "./database";
import { DemoLimitExceeded, enforceDemoLimit } from "./demo-limit";
import {
  IdempotencyConflict,
  PostgresCrmRepository,
  RevisionConflict,
} from "./postgres-repository";

export const apiHeaders = {
  "Cache-Control": "no-store",
  Vary: "Authorization",
};
export async function protectedApi(
  request: Request,
  action: (repository: PostgresCrmRepository) => Promise<Response>,
) {
  const rejected = checkAccess(request);
  if (rejected) return rejected;
  let pool: ReturnType<typeof getPool> | undefined;
  try {
    pool = getPool();
    await enforceDemoLimit(pool, request);
    return await action(new PostgresCrmRepository(pool));
  } catch (error) {
    if (error instanceof DemoLimitExceeded)
      return Response.json(
        {
          error:
            "Limite da demonstração atingido. Aguarde um minuto e tente novamente.",
          code: "DEMO_RATE_LIMIT",
        },
        { status: 429, headers: { ...apiHeaders, "Retry-After": "60" } },
      );
    if (error instanceof RevisionConflict)
      return Response.json(
        {
          error:
            "Os dados foram alterados por outro dispositivo. Atualize e revise sua alteração.",
          code: "REVISION_CONFLICT",
        },
        { status: 409, headers: apiHeaders },
      );
    if (error instanceof IdempotencyConflict)
      return Response.json(
        {
          error: "Identificador de gravação já utilizado com outro conteúdo.",
          code: "IDEMPOTENCY_CONFLICT",
        },
        { status: 409, headers: apiHeaders },
      );
    // Never expose connection strings, submitted data or database error details.
    return Response.json(
      {
        error:
          "O banco de dados está indisponível. Nenhuma gravação foi confirmada. Tente novamente.",
        code: "DATABASE_UNAVAILABLE",
      },
      { status: 503, headers: apiHeaders },
    );
  } finally {
    if (pool) await releaseRequestPool(pool).catch(() => undefined);
  }
}
