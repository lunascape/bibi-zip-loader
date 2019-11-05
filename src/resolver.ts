import { RequestMessage, ResponseMessage } from "./types";

export type AnyMessage<P = any> = RequestMessage<string, P, any> | ResponseMessage<string, P, any>;

export enum ResolverStatus {
  PENDING,
  RESOLVED,
  REJECTED,
}

export interface Resolver<T> extends Promise<T> {
  status: ResolverStatus;
  attachPromise(promise: Promise<T>): void;
  attachMessage(message: AnyMessage): void;
}

export function createResolver<T>(): Resolver<T> {
  let resolve: (result: T) => void, reject: (error: any) => void;
  const resolver = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  }) as Resolver<T>;
  resolver.status = ResolverStatus.PENDING;
  resolver.attachPromise = (promise: Promise<T>) => {
    promise.then((result) => {
      resolver.status = ResolverStatus.RESOLVED;
      resolve(result);
    }, (error) => {
      resolver.status = ResolverStatus.REJECTED;
      reject(error);
    });
  };
  resolver.attachMessage = (message: AnyMessage<T>) => {
    const { error, payload } = message;
    if (!error) {
      resolver.status = ResolverStatus.RESOLVED;
      resolve(payload);
    } else {
      resolver.status = ResolverStatus.REJECTED;
      reject(payload);
    }
  };
  return resolver;
}
