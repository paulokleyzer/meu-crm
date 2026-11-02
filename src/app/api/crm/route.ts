import { z } from "zod";
import { crmSchema } from "@/lib/schema";
import { apiHeaders, protectedApi } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const writeSchema = z.object({
  data: crmSchema,
  baseRevision: z
    .number()
    .int()
    .nonnegative()
    .max(Number.MAX_SAFE_INTEGER - 1),
  requestId: z.uuid(),
  operation: z.enum(["change", "import"]),
});

export function GET(request: Request) {
  return protectedApi(request, async (repository) => {
    const match = /^"revision-(\d+)"$/.exec(
      request.headers.get("if-none-match") || "",
    );
    const revision = match ? Number(match[1]) : -1;
    const result = await repository.loadIfChanged(
      Number.isSafeInteger(revision) ? revision : -1,
    );
    if (!result)
      return new Response(null, {
        status: 304,
        headers: { ...apiHeaders, ETag: `"revision-${revision}"` },
      });
    return Response.json(result, {
      headers: { ...apiHeaders, ETag: `"revision-${result.revision}"` },
    });
  });
}
export function PUT(request: Request) {
  return protectedApi(request, async (repository) => {
    const maxBytes = 4 * 1024 * 1024;
    if (Number(request.headers.get("content-length")) > maxBytes)
      return Response.json(
        { error: "O backup deve ter até 4 MB." },
        { status: 413, headers: apiHeaders },
      );
    let input: unknown;
    try {
      const reader = request.body?.getReader();
      if (!reader) throw new Error();
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > maxBytes) {
          await reader.cancel();
          return Response.json(
            { error: "O backup deve ter até 4 MB." },
            { status: 413, headers: apiHeaders },
          );
        }
        chunks.push(value);
      }
      input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      return Response.json(
        { error: "JSON inválido." },
        { status: 400, headers: apiHeaders },
      );
    }
    const parsed = writeSchema.safeParse(input);
    if (
      input &&
      typeof input === "object" &&
      "operation" in input &&
      input.operation !== "import" &&
      "data" in input &&
      input.data &&
      typeof input.data === "object" &&
      "schemaVersion" in input.data &&
      input.data.schemaVersion !== 2
    )
      return Response.json(
        {
          error:
            "Atualize a página antes de salvar. Backups anteriores devem ser importados pelo menu.",
        },
        { status: 426, headers: apiHeaders },
      );
    if (!parsed.success)
      return Response.json(
        {
          error:
            "Dados inválidos. Verifique os campos e referências do backup.",
        },
        { status: 422, headers: apiHeaders },
      );
    const result = await repository.save(parsed.data);
    return Response.json(result, {
      headers: { ...apiHeaders, ETag: `"revision-${result.revision}"` },
    });
  });
}
