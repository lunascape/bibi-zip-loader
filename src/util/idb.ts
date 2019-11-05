export function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((res, rej) => {
    request.onerror = () => rej(request.error);
    request.onsuccess = () => res(request.result);
  });
}

export function promisifyWithCursor<C extends IDBCursor>(request: IDBRequest<C>, ondata: (target: C) => void | boolean): Promise<void> {
  return new Promise((res, rej) => {
    request.onerror = () => rej(request.error);
    request.onsuccess = () => {
      if (request.result) {
        const ret = ondata(request.result);
        if (ret) {
          res();
        } else {
          request.result.continue();
        }
      } else {
        res();
      }
    }
  });
}