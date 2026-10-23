import path from "node:path";
import { fileURLToPath } from "node:url";
export type LinkTarget = { kind: "web"; url: string } | { kind: "local"; absolute: string } | { kind: "blocked" };
export function resolveLink(baseFile: string, href: string): LinkTarget {
  const value = href.trim();
  if (/^https?:\/\//i.test(value)) {
    try { const url = new URL(value); return { kind: "web", url: url.href }; } catch { return { kind: "blocked" }; }
  }
  if (/^file:/i.test(value)) {
    try { return { kind: "local", absolute: fileURLToPath(value) }; } catch { return { kind: "blocked" }; }
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) && !/^[a-z]:[\\/]/i.test(value)) return { kind: "blocked" };
  try { return { kind: "local", absolute: path.resolve(path.dirname(baseFile), decodeURIComponent(value.split("#")[0].split("?")[0])) }; }
  catch { return { kind: "blocked" }; }
}
export const imageTypes: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp" };
export const textExtensions = new Set([".md", ".markdown", ".txt", ".json", ".yaml", ".yml", ".toml", ".csv", ".log", ".ts", ".js", ".css", ".html", ".xml", ".sh", ".ps1", ".sql", ".rs", ".py", ".ini", ".conf"]);
export const TEXT_LIMIT = 2 * 1024 * 1024, IMAGE_LIMIT = 10 * 1024 * 1024;
