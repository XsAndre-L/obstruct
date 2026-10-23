import * as esbuild from "esbuild";
const production = process.argv[2] === "production";
const options = {
  entryPoints: ["src/obstruct.ts"],
  bundle: true,
  external: ["obsidian"],
  platform: "browser",
  format: "cjs",
  target: "es2018",
  sourcemap: production ? false : "inline",
  outfile: "main.js",
  logLevel: "info",
};
if (production) await esbuild.build(options);
else {
  const context = await esbuild.context(options);
  await context.watch();
}
