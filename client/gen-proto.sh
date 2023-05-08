#!/bin/bash

PROTO_DEST=./src/connection/local/api

mkdir -p ${PROTO_DEST}

# JavaScript/Typescript code generation
./node_modules/.bin/grpc_tools_node_protoc \
    --plugin=protoc-gen-ts=./node_modules/.bin/protoc-gen-ts \
    --ts_out=grpc_js:${PROTO_DEST} \
    --js_out=import_style=commonjs,binary:${PROTO_DEST} \
    --grpc_out=grpc_js:${PROTO_DEST} \
    -I ./src/connection/local/api\
    ./src/connection/local/api/*.proto