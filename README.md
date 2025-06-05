# Async Pipe

An asynchronous, single-producer single-consumer channel implementation built on top of `@mojsoski/async-stream`.

`AsyncPipe<T>` allows you to write data asynchronously into the pipe and asynchronously read it out in order. Internally, it manages flow control using promises and resolver locks, providing a backpressure-aware, event-driven mechanism to stream data between asynchronous producers and consumers.

This makes it ideal for scenarios where you want to:

- Connect asynchronous data producers and consumers with minimal overhead
- Stream data in an ordered, sequential fashion
- Use async iteration (`for await`) to process streamed items
- Integrate smoothly with `@mojsoski/async-stream` transforms and utilities

---

## Install

```bash
npm install @silyze/async-pipe
```

## Usage

```ts
import { AsyncPipe } from "@silyze/async-pipe";

const pipe = new AsyncPipe<string>();

pipe.transform().forEach((item) => console.log(item));

pipe.write("Hello, World!");
```

## Notes on Readers

`AsyncPipe<T>` implements the interface `AsyncStream<T>`, combining:

- `write(input: T): Promise<void>` to push data into the pipe
- `read(signal?: AbortSignal): AsyncIterable<T>` to consume data asynchronously
- `transform(): AsyncTransform<T>` to get a transform stream wrapper over the pipe

### Single Reader Limitation

`AsyncPipe` is designed for **a single active reader**. Only one consumer should call `.read()` or consume `.transform()` at a time.

Multiple simultaneous readers will cause internal resolver conflicts and potentially lost or duplicated data.

### Supporting Multiple Readers

To safely share the data stream with multiple readers, use `.buffer()` on the transform stream:

```ts
const buffered = pipe.transform().buffer({
  clear: "all-read", // clears buffer only after all readers have consumed
});

buffered.forEach((item) => {
  console.log("Reader 1:", item);
});

buffered.forEach((item) => {
  console.log("Reader 2:", item);
});

buffered.forEach((item) => {
  console.log("Reader 3:", item);
});
```

- `.buffer()` creates a buffered stream that caches data internally for multiple consumers.
- You can configure buffering and clearing policies with `AsyncBufferConfig`.

Using `.buffer()` enables multiple consumers to independently and concurrently read from the pipe without conflicts, at the cost of extra memory to hold buffered data.
