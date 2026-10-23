import { resolve } from "node:path";
process.chdir(resolve(import.meta.dir, ".."));
const { version } = await Bun.file("package.json").json();
if (typeof version !== "string" || !/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version)) {
  throw new Error("package.json must contain a valid release version.");
}
const manifest = await Bun.file("manifest.json").json();
const versions = await Bun.file("versions.json").json();
manifest.version = version;
versions[version] = manifest.minAppVersion;
await Bun.write("manifest.json", JSON.stringify(manifest, null, 2) + "\n");
await Bun.write("versions.json", JSON.stringify(versions, null, 2) + "\n");
console.log("Synchronized version " + version);
