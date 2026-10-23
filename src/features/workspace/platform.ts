// Electron is supplied by Obsidian, not bundled or provided by Bun.
interface Shell { openPath(path: string): Promise<string>; openExternal(url: string): Promise<void> }
const shell = (): Shell => (require("electron") as { shell: Shell }).shell;
export async function openLocal(absolute: string): Promise<void> {
  const error = await shell().openPath(absolute); if (error) throw new Error(error);
}
export async function openWeb(url: string): Promise<void> {
  if (!/^https?:\/\//i.test(url)) throw new Error("Only HTTP and HTTPS links are supported.");
  await shell().openExternal(url);
}
