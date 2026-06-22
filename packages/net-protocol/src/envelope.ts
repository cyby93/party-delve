export interface MessageEnvelope<T> {
  type: string;
  payload: T;
}
