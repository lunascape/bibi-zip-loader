import 'core-js/features/promise';
import 'regenerator-runtime/runtime';
import { MessageType, RequestMessage, InitRequestMessage, GetDataRequestMessage, AbortDataRequestMessage } from '../types';
import LSZRWrapper from "./lszr-wrapper";
import { Resolver, createResolver } from '../resolver';

const dataHandlers: {
  [entryName: string]: {
    abort: AbortController,
    promise: Promise<Uint8Array>
  }
} = {};

function postPromise<T>(type: string, promise: Promise<T>, meta?: any) {
  promise.then((payload) => {
    postMessage({ type, payload, meta }, undefined);
  }, (error) => {
    postMessage({ type, error: true, payload: error && error.toString(), meta }, undefined);
  });
}

type TransferablePromise<T> = Promise<{ payload: T, transferable: Transferable }>;
function postTransferable<T>(type: string, promise: TransferablePromise<T>, meta?: any) {
  promise.then(({ payload, transferable }) => {
    postMessage({ type, payload, meta }, [transferable] as any);
  }, (error) => {
    postMessage({ type, error: true, payload: error && error.toString(), meta }, undefined);
  });
}

const prepare: Resolver<LSZRWrapper> = createResolver();

onmessage = (ev: MessageEvent) => {
  const message = ev.data as RequestMessage;
  const { type, meta } = message;

  if (type === MessageType.INIT) {
    const { payload: { url, forceInMemoryCache, forceKeepCache } } = message as InitRequestMessage;
    prepare.attachPromise((async () => {
      const lsuzrw = new LSZRWrapper({
        url,
        forceInMemoryCache,
        forceKeepCache,
        onUpdateState: (state) => {
          postMessage({ type: MessageType.UPDATE_STATE, state, meta }, undefined);
        },
      });
      postPromise(MessageType.INIT, lsuzrw.getState(), meta);
      return lsuzrw;
    })());
  } else if (type === MessageType.GET_DATA) {
    const { payload: entryName } = message as GetDataRequestMessage;
    const exists = dataHandlers[entryName];
    if (exists) {
      return;
    }
    const abort = new AbortController();
    const promise = prepare.then((lsuzrw) => lsuzrw.getBuffer(entryName, abort.signal));
    dataHandlers[entryName] = {
      promise,
      abort,
    };
    promise.then(() => {
      delete dataHandlers[entryName];
    }, () => {
      delete dataHandlers[entryName];
    });
    postTransferable(type, promise.then((u8a) => ({
      payload: u8a.buffer,
      transferable: u8a.buffer
    })), entryName)
  } else if (type === MessageType.ABORT_DATA) {
    const { payload: entryName } = message as AbortDataRequestMessage;
    const exists = dataHandlers[entryName];
    exists && exists.abort.abort();
    // NO RESPONSE
  }
};
