let fallbackSequence = 0;

/** UI-only identity for one run; independent of deterministic engine seeds. */
export function newRunObservationId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid ?? `run-${Date.now().toString(36)}-${++fallbackSequence}`;
}

export function normalizeRunObservationId(value: unknown): string {
  return typeof value === 'string' && value.length > 0 ? value : newRunObservationId();
}
