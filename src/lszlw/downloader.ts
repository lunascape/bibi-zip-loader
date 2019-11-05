import 'abortcontroller-polyfill/dist/abortcontroller-polyfill-only';
import { fetch } from 'whatwg-fetch'
import { throwIfAbort } from '../util/abort';
import { RangeNotSupportedError } from '../error';

export type DataChunk = [ArrayBuffer, number];

const abortableFetch = ('signal' in new Request(self.location.href)) ? self.fetch : fetch

export async function downloadRange(url: string, range: string, signal?: AbortSignal): Promise<DataChunk> {
  throwIfAbort(signal);
  const controller = new AbortController();
  if (signal) {
    signal.addEventListener('abort', () => {
      controller.abort();
    });
  }

  const res = await abortableFetch(url, {
    headers: { 'Range': range },
    mode: 'cors',
    credentials: 'omit',
    signal: controller.signal,
  });
  if (res.status !== 206) {
    controller.abort();
    throw new RangeNotSupportedError();
  }

  const contentRange = res.headers.get('Content-Range');

  const byteRange = contentRange && contentRange.match(/bytes (\d+)/);
  if (!byteRange || !byteRange[1]) {
    controller.abort();
    throw new Error('Content-Range not found.')
  }
  const offset = parseInt(byteRange[1]);
  const buffer = await res.arrayBuffer();
  const chunk: DataChunk = [buffer, offset];

  return chunk;
}

export async function downloadAll(url: string, signal?: AbortSignal): Promise<ArrayBuffer> {
  throwIfAbort(signal);
  const res = await abortableFetch(url, {
    mode: 'cors',
    credentials: 'omit',
    signal,
  });
  if (!res.ok) {
    throw new Error('Get request failed. status code: ' + res.status);
  }
  return res.arrayBuffer();
}
