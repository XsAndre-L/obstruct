import { mkdir, copyFile } from "node:fs/promises";
const destination = "dist/obsidian-sample-plugin";
await mkdir(destination, { recursive: true });
for (const file of ["main.js", "manifest.json", "styles.css"]) {
  await copyFile(file, destination + "/" + file);
}
console.log("Installable files: " + destination);
