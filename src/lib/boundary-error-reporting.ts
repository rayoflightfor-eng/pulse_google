export function reportBoundaryError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  console.error("[boundary]", error, context);
}
