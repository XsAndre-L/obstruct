import path from "node:path";
export const slash = (value: string): string => value.replace(/\\/g, "/");
export function resolveResource(vault: string, input: string, api: typeof path = path): string {
  const value = input.trim();
  if (!value || value.includes("\0") || /^[a-z]:($|[^\\/])/i.test(value)) throw new Error("Use a relative path or a full absolute path.");
  if (api === path.win32 && /^[\\/](?![\\/])/.test(value)) throw new Error("Include the drive letter for an absolute path.");
  return api.resolve(vault, value);
}
export function within(root: string, target: string, api: typeof path = path): boolean {
  const rel = api.relative(root, target);
  return rel === "" || (!api.isAbsolute(rel) && rel !== ".." && !rel.startsWith(".." + api.sep));
}
export function resolveNotes(vault: string, input: string): string {
  const value = input.trim() || ".";
  if (path.isAbsolute(value) || /^[a-z]:/i.test(value)) throw new Error("Main notes must be relative to this vault.");
  const resolved = resolveResource(vault, value);
  if (!within(vault, resolved)) throw new Error("Main notes must stay inside this vault.");
  return resolved;
}
export function storedPath(vault: string, absolute: string): string {
  const relative = path.relative(vault, absolute);
  return slash(path.isAbsolute(relative) ? absolute : relative || ".");
}
export const identity = (value: string): string => process.platform === "win32" ? path.normalize(value).toLowerCase() : path.normalize(value);
