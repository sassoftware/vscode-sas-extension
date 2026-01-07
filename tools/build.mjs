import concurrently from "concurrently";
import esbuild from "esbuild";
import fs from "fs";

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
    ".ps1": "text",
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
    "./client/dist/webview/TablePropertiesViewer":
      "./client/src/webview/TablePropertiesViewer.ts",
    "./client/dist/notebook/LogRenderer":
      "./client/src/components/notebook/renderers/LogRenderer.ts",
    "./client/dist/notebook/HTMLRenderer":
      "./client/src/components/notebook/renderers/HTMLRenderer.ts",
  },
};

const copyFiles = () => {
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
    {
      src: "./client/src/components/notebook/exporters/templates",
      dest: "./client/dist/notebook/exporters/templates",
    },
    {
      src: "./client/src/connection/itc/env.json",
      dest: "./client/dist/node/env.json",
    },
    {
      src: "./client/src/connection/itc/GetInteropDirectory.psm1",
      dest: "./client/dist/node/GetInteropDirectory.psm1",
    },
    {
      src: "./client/src/connection/itc/itc.ps1",
      dest: "./client/dist/node/itc.ps1",
    },
  ];
  foldersToCopy.forEach((item) =>
    fs.cpSync(item.src, item.dest, { recursive: true }),
  );
};

if (process.env.npm_config_webviews || process.env.npm_config_client) {
  const ctx = await esbuild.context(
    process.env.npm_config_webviews ? browserBuildOptions : nodeBuildOptions,
  );
  await ctx.rebuild();

  if (dev) {
    process.env.npm_config_client && copyFiles();
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
  await result.then(copyFiles, () =>
    console.error("Assets failed to build successfully"),
  );
}
