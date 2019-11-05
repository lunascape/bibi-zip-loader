LSZL
====

Lunascape Zip Loader

Requiements
-----------

- Rust 1.34
- Binaryen `brew install binaryen --HEAD`
- wasm-pack `cargo install wasm-pack`
- Node 8

Usage
-----

``` javascript
// LSZL is used as ES6 Class.
const lszl = new LSZL({
  url: 'https://example.com/pass/to/book.epub'
});

const promise = lsld.getBuffer('mimetype'); // returns a promise that will be resolved with an ArrayBuffer.

promise.then((buffer) => {
   // use buffer
});

```

Development
-----------

``` sh
npm bootstrap # prepare submodules
npm install   # install dependencies
npm start     # start webpack-dev-server
npm pack      # build package
```