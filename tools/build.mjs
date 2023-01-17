/* eslint-disable @typescript-eslint/no-var-requires */
console.log("start");
const dev = process.argv[2];
import esbuild from "esbuild";

const plugins = [
  {
    name: "watch-plugin",
    setup(build) {
      build.onEnd((result) => {
        // for VS Code task tracking
        console.log("start");
        console.log("end");
      });
    },
  },
];

const buildOptions = {
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
  },
  sourcemap: !!dev,
  minify: !dev,
  plugins: dev ? plugins : [],
};

const ctx = await esbuild.context(buildOptions);
if (dev) {
  await ctx.watch();
}

await ctx.dispose();
