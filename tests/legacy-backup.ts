import { createSeedData } from "../src/lib/seed";
export function legacyBackup(data = createSeedData()) {
  const {
    businessTypes: _types,
    sources: _sources,
    sellers: _sellers,
    distributionRules: _rules,
    scheduledActivities: _tasks,
    ...old
  } = data;
  void [_types, _sources, _sellers, _rules, _tasks];
  return {
    ...old,
    schemaVersion: 1,
    deals: data.deals.map((d) => {
      const { businessTypeId: _type, ...legacy } = d;
      void _type;
      return legacy;
    }),
  };
}
