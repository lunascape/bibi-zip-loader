export default class LSZL {
  private params;
  readonly url: string;
  private readonly debug;
  private setupWorkers;
  private prefetching;
  constructor(params: {
      url: string;
      worker?: string;
  });
  prefetchAll: () => Promise<void>;
  private getMostFreeWorker;
  abort: (entryName: string) => Promise<void>;
  getEntryNames: () => Promise<string[]>;
  getBuffer: (entryName: string) => Promise<ArrayBuffer>;
  private throwIfAbort;
  private fallback;
}