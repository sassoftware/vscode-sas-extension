export interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reject: (reason?: any) => void;
}
export function deferred<T>() {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const deferred = {} as Deferred<T>;
  deferred.promise = new Promise((resolve, reject) => {
    deferred.resolve = resolve;
    deferred.reject = reject;
  });
  return deferred;
}
