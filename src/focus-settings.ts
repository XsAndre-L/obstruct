export interface FocusSettings {
  displayName: string;
  visibleFolder: string;
  enabled: boolean;
}

export function normalizeFolder(input: string): string {
  const value = input.trim().replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
  if (!value) return "";
  if (value.startsWith("/") || value.includes(":") || value.split("/").some(p => !p || p === "." || p === "..")) {
    throw new Error("Use a folder path relative to the vault, such as docs or notes/project.");
  }
  return value;
}

export function readSettings(data: unknown): FocusSettings {
  const value = data && typeof data === "object" ? data as Record<string, unknown> : {};
  let visibleFolder = "";
  try { visibleFolder = normalizeFolder(typeof value.visibleFolder === "string" ? value.visibleFolder : ""); } catch { /* Invalid legacy data must not hide the vault. */ }
  return {
    displayName: typeof value.displayName === "string" ? value.displayName.trim() : "",
    visibleFolder,
    enabled: typeof value.enabled === "boolean" ? value.enabled : true,
  };
}

export function isVisible(path: string, folder: string): boolean {
  return !folder || path === "/" || path === folder || path.startsWith(folder + "/") || folder.startsWith(path + "/");
}
