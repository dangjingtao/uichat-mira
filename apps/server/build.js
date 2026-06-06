import { build } from "esbuild";
import path from "node:path";

build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: "../desktop/electron-backend/server.cjs",
  plugins: [
    {
      name: "alias",
      setup(build) {
        build.onResolve({ filter: /^@\// }, (args) => {
          const relPath = args.path.slice(2);
          const absPath = path.resolve(process.cwd(), "src", relPath);
          return { path: absPath };
        });
      },
    },
  ],
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
