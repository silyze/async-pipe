import { assert } from "@mojsoski/assert";
import { AsyncStream, AsyncTransform } from "@mojsoski/async-stream";

function createResolverWithPromise<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: any) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

const AbortSymbol = Symbol("abort");
type AbortSymbol = typeof AbortSymbol;
export class AsyncPipe<T> implements AsyncStream<T, T> {
  #resolver: ((value: T | AbortSymbol) => void) | undefined = undefined;
  #writerLocks: ((resolve: (value: T) => void) => void)[] = [];

  async write(value: T) {
    if (this.#resolver === undefined) {
      const { promise, resolve } =
        createResolverWithPromise<(value: T) => void>();
      this.#writerLocks.push(resolve);
      const resolver = await promise;
      resolver(value);
    } else {
      this.#resolver(value);
      this.#resolver = undefined;
    }
  }

  #createReadResolver(signal?: AbortSignal) {
    const { promise, resolve } = createResolverWithPromise<T | AbortSymbol>();

    if (signal) {
      const onAbort = () => {
        signal.removeEventListener("abort", onAbort);
        resolve(AbortSymbol);
      };

      promise.then(() => signal.removeEventListener("abort", onAbort));

      signal.addEventListener("abort", onAbort);
    }

    return { resolve, promise };
  }

  async *read(signal?: AbortSignal): AsyncIterable<T> {
    while (!signal || !signal.aborted) {
      try {
        const locks = this.#writerLocks.splice(0, this.#writerLocks.length);
        if (locks.length) {
          const results = await Promise.all(
            locks.map((releaseLock) => {
              const { resolve, promise } = this.#createReadResolver(signal);
              releaseLock(resolve);
              return promise;
            })
          );

          for (const result of results) {
            if (result === AbortSymbol) {
              return;
            }
            yield result;
          }
        } else {
          assert(
            this.#resolver === undefined,
            "Failed to obtain resolver, make sure that there is a single reader"
          );

          const { resolve, promise } = this.#createReadResolver(signal);
          this.#resolver = resolve;

          const result = await promise;
          if (result === AbortSymbol) {
            return;
          }
          yield result;
        }
      } catch {
        break;
      }
    }
  }

  transform(): AsyncTransform<T> {
    return new AsyncTransform(this);
  }
}
