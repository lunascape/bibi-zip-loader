
export type SuccessMessage<T = string, P = any, M = any> = {
  type: T;
  error?: false;
  payload: P;
  meta: M;
};

export type ErrorMessage<T = any, M = any> = {
  type: T;
  error: true;
  payload: any;
  meta: M;
};

export type RequestMessage<T = string, P = any, M = any> = SuccessMessage<T, P, M>;
export type ResponseMessage<T = string, P = any, M = any> = SuccessMessage<T, P, M> | ErrorMessage<T, M>;

export enum MessageType {
  INIT = 'INIT',
  GET_DATA = 'GET_DATA',
  ABORT_DATA = 'ABORT_DATA',
  UPDATE_STATE = 'UPDATE_STATE',
}

export interface WorkerState {
  entryNames: string[];
  fallback: boolean;
}

export type InitRequestMessage = RequestMessage<MessageType.INIT, {
  url: string,
  worker?: string,
  forceInMemoryCache?: boolean,
  forceKeepCache?: boolean,
}>;
export type InitResponseMessage = RequestMessage<MessageType.INIT, WorkerState>;

export type GetDataRequestMessage = RequestMessage<MessageType.GET_DATA, string, void>;
export type GetDataResponseMessage = ResponseMessage<MessageType.GET_DATA, ArrayBuffer, string>;

export type AbortDataRequestMessage = RequestMessage<MessageType.ABORT_DATA, string, void>;

export type UpdateStateMessage = RequestMessage<MessageType.UPDATE_STATE, WorkerState>;