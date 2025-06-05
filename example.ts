import { AsyncPipe } from "./lib";

const pipe = new AsyncPipe<string>();

pipe.transform().forEach((item) => console.log(item));

pipe.write("Hello, World!");
