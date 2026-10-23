export interface RuleMatch { pattern: string; source: "Global" | "Resource" }
export function validatePattern(pattern: string): void {
  if (!pattern.trim() || /[!\[\]{}\\]/.test(pattern) || pattern.startsWith("/") || pattern.split("/").some(p => p === ".." || p === ".")) {
    throw new Error("Use relative patterns with *, ** or ?. Negation, brackets, braces and backslashes are not supported.");
  }
}
function compile(pattern: string): RegExp {
  validatePattern(pattern);
  pattern = pattern.replace(/\/+$/, "");
  let source = "^";
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === "*" && pattern[i + 1] === "*") {
      i++;
      if (pattern[i + 1] === "/") { source += "(?:.*/)?"; i++; } else source += ".*";
    } else if (c === "*") source += "[^/]*";
    else if (c === "?") source += "[^/]";
    else source += c.replace(/[.*+?^$()|[\]\\]/g, "\\$&");
  }
  // folder/** also matches the folder itself so it can be pruned.
  if (pattern.endsWith("/**")) source = source.slice(0, -3) + "(?:/.*)?";
  return new RegExp(source + "$");
}
export function explain(relative: string, global: string[], local: string[] = []): RuleMatch[] {
  const parts = relative.replace(/\\/g, "/").split("/").filter(Boolean);
  const candidates = parts.map((_, index) => parts.slice(0, index + 1).join("/"));
  const result: RuleMatch[] = [];
  for (const [rules, source] of [[global, "Global"], [local, "Resource"]] as const) {
    for (const pattern of rules) if (candidates.some(p => compile(pattern).test(p))) result.push({ pattern, source });
  }
  return result;
}
export const lines = (text: string): string[] => text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
