import { apiHeaders, protectedApi } from "@/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  return protectedApi(request, async (repository) =>
    Response.json(
      { history: await repository.history() },
      { headers: apiHeaders },
    ),
  );
}
