export class AiRequestAbortedError extends Error {
  constructor(message = "AI request cancelled.") {
    super(message);
    this.name = "AiRequestAbortedError";
  }
}

export function isAiRequestAborted(error: unknown): boolean {
  if (error instanceof AiRequestAbortedError) return true;
  if (error instanceof DOMException && error.name === "AbortError") return true;
  return error instanceof Error && error.name === "AbortError";
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new AiRequestAbortedError();
}
