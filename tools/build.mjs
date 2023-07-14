import concurrently from "concurrently";
import esbuild from "esbuild";

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
  entryPoints: {
    "./client/dist/webview/DataViewer": "./client/src/webview/DataViewer.tsx",
  },
};

if (process.env.npm_config_browser || process.env.npm_config_node) {
  const ctx = await esbuild.context(
    process.env.npm_config_browser ? browserBuildOptions : nodeBuildOptions
  );
  await ctx.rebuild();

  if (dev) {
    await ctx.watch();
  } else {
    await ctx.dispose();
  }
} else {
  const { result } = concurrently(
    [
      {
        command: `npm run ${process.env.npm_lifecycle_event} --browser`,
        name: "browser",
      },
      {
        command: `npm run ${process.env.npm_lifecycle_event} --node`,
        name: "node",
      },
    ],
    {
      killOthers: ["failure", "success"],
      restartTries: 3,
    }
  );

  await result.then(
    () => {},
    () => console.error("Assets failed to build successfully")
  );
}
