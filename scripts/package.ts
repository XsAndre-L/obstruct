import { resolve } from "node:path";
process.chdir(resolve(import.meta.dir, ".."));
const child = Bun.spawn([process.execPath, "scripts/build.ts", "--production"], { stdout: "inherit", stderr: "inherit" });
const code = await child.exited;
if (code !== 0) process.exit(code);
const destination = "dist/obstruct";
for (const file of ["main.js", "manifest.json", "styles.css"]) {
  await Bun.write(destination + "/" + file, Bun.file(file));
}
console.log("Installable files: " + destination);
