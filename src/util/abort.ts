
export function throwIfAbort(signal?: AbortSignal) {
  if (!signal || !signal.aborted) {
    return;
  }
  throw new AbortError();
}

export class AbortError {
  public name = 'AbortError';
  constructor() {}
}
