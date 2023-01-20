/* eslint-disable @typescript-eslint/no-var-requires */
console.log("start");
const dev = process.argv[2];
require("esbuild")
  .build({
    entryPoints: {
      "./client/dist/node/extension": "./client/src/node/extension.ts",
      "./server/dist/node/server": "./server/src/node/server.ts",
    },
    bundle: true,
    outdir: ".",
    platform: "node",
    external: ["vscode"],
    loader: {
      ".properties": "text",
      ".node": "copy",
    },
    sourcemap: !!dev,
    watch: dev
      ? {
          onRebuild() {
            // for VS Code task tracking
            console.log("start");
            console.log("end");
          },
        }
      : false,
    minify: !dev,
  })
  .finally(() => console.log("end"));
