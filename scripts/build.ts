import { resolve } from "node:path";
process.chdir(resolve(import.meta.dir, ".."));
const production = Bun.argv.includes("--production");
if (production) await import("./typecheck.ts");
const result = await Bun.build({
  entrypoints: ["src/obstruct.ts"],
  external: ["obsidian", "electron"],
  target: "node",
  format: "cjs",
  sourcemap: production ? "none" : "inline",
});
if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}
await Bun.write("main.js", result.outputs[0]);
console.log("Built main.js with Bun.");
