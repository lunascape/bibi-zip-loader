import 'regenerator-runtime/runtime';
import WorkerWrapper from './worker-wrapper';

const LANE_MULTIPLY = 4;

export default class LSZL {
  public readonly url: string;
  private readonly debug: boolean;
  private setupWorkers: Promise<WorkerWrapper[]>;
  private prefetching: Promise<void>;
  constructor(private params: {
    url: string,
    worker?: string,
    multiply?: number,
    forceInMemoryCache?: boolean,
    forceKeepCache?: boolean,
  }
  ) {
    const url = new URL(params.url, window.location.href).href;
    this.url = url;
    this.throwIfAbort();

    this.setupWorkers = (async () => {
      const firstWorker = new WorkerWrapper({
        url: this.url,
        worker: this.params.worker,
        forceInMemoryCache: this.params.forceInMemoryCache,
        forceKeepCache: this.params.forceKeepCache,
      });
      const state = await firstWorker.getState();
      if (state.fallback) {
        return [firstWorker];
      }
      firstWorker.onFallback = () => this.fallback(firstWorker);
      const workers = [firstWorker];
      const multiply = params.multiply && Math.max(params.multiply, 1) || LANE_MULTIPLY;
      for (let index = 1; index < multiply; index++) {
        const coworker = new WorkerWrapper({
          url: this.url,
          worker: this.params.worker,
          forceKeepCache: true,
        });
        coworker.onFallback = () => this.fallback(coworker);
        workers.push(coworker);
      }
      return workers;
    })();
  }

  public prefetchAll = (): Promise<void> => {
    if (this.prefetching) {
      return this.prefetching;
    }
    const promise = (async () => {
      const names = await this.getEntryNames();
      for (const name of names) {
        await this.getBuffer(name);
      }
    })();
    promise.catch(() => this.prefetching = undefined);
    return this.prefetching = promise;
  }

  private async getMostFreeWorker(): Promise<WorkerWrapper> {
    const workers = await this.setupWorkers;
    let minCount = Number.POSITIVE_INFINITY;
    let freeWorker: WorkerWrapper = workers[0];
    let maxCount = 0;
    for (let index = 0; index < workers.length; index++) {
      const worker = workers[index];
      const pendingCount = worker.getPendingCount();
      if (minCount > pendingCount) {
        minCount = pendingCount;
        freeWorker = worker;
      }
      maxCount = Math.max(maxCount, pendingCount);
    }
    return freeWorker;
  }

  public abort = async (entryName: string) => {
    const workers = await this.setupWorkers;
    for (let index = 0; index < workers.length; index++) {
      const worker = workers[index];
      worker.abort(entryName);
    }
  }

  public getEntryNames = async (): Promise<string[]> => {
    this.throwIfAbort();
    const workers = await this.setupWorkers;
    const state = await workers[0].getState();
    return state.entryNames;
  }

  public getBuffer = async (entryName: string): Promise<ArrayBuffer> => {
    this.throwIfAbort();
    const workers = await this.setupWorkers;
    for (let index = 0; index < workers.length; index++) {
      const worker = workers[index];
      const exists = worker.getExistsBuffer(entryName);
      if (exists) {
        return exists;
      }
    }
    const worker = await this.getMostFreeWorker();
    return worker.getBuffer(entryName);
  }

  private throwIfAbort() {
    // NOP
  }

  private fallback(worker: WorkerWrapper) {
    this.setupWorkers = this.setupWorkers
      .then((workers) => workers.filter((one) => one !== worker))
      .then((workers) => workers.forEach((one) => one.terminate()))
      .then(() => [worker]);
  }
}