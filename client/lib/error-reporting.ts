export function reportRuntimeError(error: unknown, context: Record<string, unknown> = {}) {
  console.error("[Runtime Error]", error, context);
}
