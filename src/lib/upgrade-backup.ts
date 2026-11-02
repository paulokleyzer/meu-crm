// Backups v1 remain importable. Names are retained verbatim; old browsers and
// the old Netlify site are never read or modified automatically.
export function upgradeBackup(input: unknown): unknown {
  if (
    !input ||
    typeof input !== "object" ||
    !("schemaVersion" in input) ||
    input.schemaVersion !== 1
  )
    return input;
  const legacy = input as Record<string, unknown>;
  if (!Array.isArray(legacy.deals)) return input;
  const legacyDeals = legacy.deals;
  const ids = new Set<string>();
  for (const list of [
    legacy.pipelines,
    legacy.customers,
    legacy.deals,
    legacy.activities,
  ]) {
    if (Array.isArray(list))
      for (const row of list) {
        if (row && typeof row.id === "string") ids.add(row.id);
        if (Array.isArray(row?.stages))
          for (const stage of row.stages) ids.add(stage.id);
      }
  }
  const catalog = (field: string) =>
    [
      ...new Set(
        legacyDeals
          .filter((d) => d && typeof d[field] === "string" && d[field])
          .map((d) => d[field] as string),
      ),
    ]
      .sort()
      .map((name, i) => {
        let id = `legacy-${field}-${i}`;
        while (ids.has(id)) id += "x";
        ids.add(id);
        return { id, name };
      });
  const sellers = catalog("owner").map((s) => ({ ...s, active: true }));
  return {
    ...legacy,
    schemaVersion: 2,
    deals: legacyDeals.map((d) =>
      d && typeof d === "object" ? { ...d, businessTypeId: "" } : d,
    ),
    businessTypes: [],
    sources: catalog("source"),
    sellers: sellers.length
      ? sellers
      : [{ id: "legacy-team", name: "Equipe", active: true }],
    distributionRules: [],
    scheduledActivities: [],
  };
}
