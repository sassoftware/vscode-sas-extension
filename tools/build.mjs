import concurrently from "concurrently";
import esbuild from "esbuild";
import fs from "fs";
import path from "path";

console.log("start");
const dev = process.argv[2];

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

const commonBuildOptions = {
  bundle: true,
  outdir: ".",
  external: ["vscode"],
  loader: {
    ".properties": "text",
    ".node": "copy",
    ".svg": "dataurl",
  },
  sourcemap: !!dev,
  minify: !dev,
  plugins: dev ? plugins : [],
  define: {
    "process.env.NODE_ENV": dev ? `"development"` : `"production"`,
  },
};

const nodeBuildOptions = {
  ...commonBuildOptions,
  entryPoints: {
    "./client/dist/node/extension": "./client/src/node/extension.ts",
    "./server/dist/node/server": "./server/src/node/server.ts",
  },
  platform: "node",
};

const browserBuildOptions = {
  ...commonBuildOptions,
  format: "esm",
  entryPoints: {
    "./client/dist/webview/DataViewer": "./client/src/webview/DataViewer.tsx",
    "./client/dist/notebook/LogRenderer":
      "./client/src/components/notebook/renderers/LogRenderer.ts",
    "./client/dist/notebook/HTMLRenderer":
      "./client/src/components/notebook/renderers/HTMLRenderer.ts",
  },
};

if (process.env.npm_config_webviews || process.env.npm_config_client) {
  const ctx = await esbuild.context(
    process.env.npm_config_webviews ? browserBuildOptions : nodeBuildOptions,
  );
  await ctx.rebuild();

  if (dev) {
    await ctx.watch();
  } else {
    await ctx.dispose();
  }
} else {
  const { result } = concurrently([
    {
      command: `npm run ${process.env.npm_lifecycle_event} --webviews`,
      name: "browser",
    },
    {
      command: `npm run ${process.env.npm_lifecycle_event} --client`,
      name: "node",
    },
  ]);

  await result.then(
    () => {
      const foldersToCopy = [
        {
          src: "./server/node_modules/jsonc-parser/lib/umd/impl",
          dest: "./server/dist/node/impl",
        },
        {
          src: "./server/node_modules/pyright-internal-node/dist/packages/pyright-internal/typeshed-fallback",
          dest: "./server/dist/node/typeshed-fallback",
        },
        {
          src: "./server/src/python/sas",
          dest: "./server/dist/node/typeshed-fallback/stubs/sas",
        },
      ];
      for (const item of foldersToCopy) {
        fs.cpSync(item.src, item.dest, { recursive: true });
        console.log(`${item.src} was copied to ${item.dest}`);
      }
    },
    () => console.error("Assets failed to build successfully"),
  );
}
