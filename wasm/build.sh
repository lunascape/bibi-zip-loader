#!/bin/sh

set -ex

cd `dirname $0`

rm -rf pkg

wasm-pack build --release
wasm-opt -O3 pkg/lszr_bg.wasm -o pkg/lszr_bg_opt.wasm
wasm2js -O3 pkg/lszr_bg_opt.wasm -o pkg/lszr_bg.js
rm pkg/lszr_bg.wasm pkg/lszr_bg_opt.wasm
