export function syncInterval(
  visible: boolean,
  inactiveForMs: number,
): number | null {
  if (!visible || inactiveForMs > 300_000) return null;
  return inactiveForMs > 60_000 ? 120_000 : 30_000;
}
