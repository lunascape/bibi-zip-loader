// polyfill manually for IE11
import 'core-js/modules/es.math.clz32';
import 'core-js/modules/es.math.fround';
import 'core-js/modules/es.math.imul';
import 'core-js/features/array/fill';
import 'core-js/features/typed-array/slice';
import 'fast-text-encoding';

import { LSZR } from '../../wasm/pkg/lszr';
import { downloadRange, DataChunk, downloadAll } from './downloader';
import FragmentStorage from './fragment-storage';
import { throwIfAbort } from '../util/abort';
import { RangeNotSupportedError } from '../error';
import { WorkerState } from '../types';

const EOCD_ENTRY_NAME = ':eocd';
const CD_ENTRY_NAME = ':cd';

export default class LSZRWrapper {
  private state: WorkerState;
  private init: Promise<LSZR>;
  private inMemoryCache: Promise<ArrayBuffer>;
  private storage: FragmentStorage;

  public constructor(
    private params: {
      url: string,
      forceKeepCache?: boolean,
      forceInMemoryCache?: boolean,
      onUpdateState: (state: WorkerState) => void;
    }) {
    this.state = {
      entryNames: [],
      fallback: false
    };
    this.storage = new FragmentStorage({
      url: params.url, 
      forceKeepCache: params.forceKeepCache,
    });
    this.prepare();
  }

  private prepare(): Promise<LSZR> {
    if (this.init) {
      return this.init;
    }
    const promise = (async () => {
      const eocdCacheData = await this.storage.getFragment(EOCD_ENTRY_NAME);
      const cdCacheData = await this.storage.getFragment(CD_ENTRY_NAME);
      let eocdData = eocdCacheData;
      let cdData = cdCacheData;
      let lastChunk: DataChunk;
      let inMemoryCache: ArrayBuffer;

      if (!eocdData) {
        try {
          if (this.params.forceInMemoryCache) {
            // force fallback
            throw new RangeNotSupportedError();
          }
          lastChunk = await downloadRange(this.params.url, 'bytes=-65557');
          eocdData = lastChunk[0];
        } catch (err) {
          if (!(err instanceof RangeNotSupportedError)) {
            throw err;
          }
          inMemoryCache = await this.cacheInMemory();
          const start = inMemoryCache.byteLength - 65557;
          eocdData = inMemoryCache.slice(inMemoryCache.byteLength - 65557);
          lastChunk = [eocdData, start];
        }
      }
      const uzr = new LSZR(new Uint8Array(eocdData));

      if (!eocdCacheData) {
        const eocdRange = uzr.eocdRange;
        const { offset, size } = eocdRange;
        const start = offset;
        const end = start + size;
        eocdRange.free();

        eocdData = lastChunk[0].slice(start, end);
        await this.storage.putFragment(EOCD_ENTRY_NAME, eocdData).catch(console.warn);
      }

      if (!cdData) {
        const subRange = uzr.cdRange;
        const { offset, size } = subRange;
        subRange.free();

        if (lastChunk && offset > lastChunk[1]) {
          const start = offset - lastChunk[1];
          const end = start + size;
          cdData = lastChunk[0].slice(start, end);
        } else {
          const start = offset;
          const end = offset + size;

          if (inMemoryCache) {
            cdData = inMemoryCache.slice(start, end + 1);
          } else {
            try {
              [cdData] = await downloadRange(this.params.url, `bytes=${start}-${end}`);
            } catch (err) {
              if (!(err instanceof RangeNotSupportedError)) {
                throw err;
              }
              inMemoryCache = await this.cacheInMemory();
              cdData = inMemoryCache.slice(start, end + 1);
            }
          }
        }
        await this.storage.putFragment(CD_ENTRY_NAME, cdData).catch(console.warn);
      }

      const entryNames = uzr.parseCD(new Uint8Array(cdData));
      let fallback = !!inMemoryCache;

      this.state = {
        entryNames,
        fallback,
      };

      return uzr;
    })();
    promise.catch(() => this.init = undefined);
    return this.init = promise;
  }

  public getState(): Promise<WorkerState> {
    return this.prepare().then(() => this.state);
  }

  public getBuffer(name: string, signal: AbortSignal): Promise<Uint8Array> {
    const promise = this.prepare().then(async (uzr) => {
      throwIfAbort(signal);
      const exists = await this.storage.getFragment(name, signal);
      if (exists) {
        throwIfAbort(signal);
        const data = uzr.getData(name, new Uint8Array(exists));
        throwIfAbort(signal);
        return data;
      }
      const range = uzr.getRange(name);
      const start = range.offset;
      const end = start + range.size;
      range.free();
      let buff: ArrayBuffer;

      if (this.state.fallback) {
        const inMemoryCache = await this.inMemoryCache;
        buff = inMemoryCache.slice(start, end + 1);
      } else {
        try {
          [buff] = await downloadRange(this.params.url, `bytes=${start}-${end}`, signal);
        } catch (err) {
          if (!(err instanceof RangeNotSupportedError)) {
            throw err;
          }
          const inMemoryCache = await this.cacheInMemory();
          buff = inMemoryCache.slice(start, end + 1);
        }
      }
      this.storage.putFragment(name, buff).catch(console.warn);
      throwIfAbort(signal);
      const data = uzr.getData(name, new Uint8Array(buff));
      throwIfAbort(signal);
      return data;
    });

    return promise;
  }

  private cacheInMemory(): Promise<ArrayBuffer> {
    if (this.inMemoryCache) {
      return this.inMemoryCache;
    }
    this.setState({
      ...this.state,
      fallback: true
    });
    const promise = downloadAll(this.params.url);
    promise.catch((err) => {
      console.warn(err);
      this.inMemoryCache = undefined;
    });
    promise.then(async (inMemoryCache) => {
      const uzr = await this.prepare();
      this.state.entryNames.forEach((name) => {
        const range = uzr.getRange(name);
        const start = range.offset;
        const end = start + range.size;
        range.free();
        const buff = inMemoryCache.slice(start, end + 1);
        this.storage.putFragment(name, buff).catch(console.warn);
      });
    });
    return this.inMemoryCache = promise;
  }

  private setState(state: WorkerState) {
    this.state = state;
    this.params.onUpdateState(state);
  }
}
