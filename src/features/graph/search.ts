/** A separate, parenthesized group keeps existing OR expressions intact. */
export function folderFilter(paths: string[]): string {
  return paths.map(path => '-path:' + JSON.stringify(path + "/")).join(" ");
}
export function applyFilter(base: string, filter: string): string {
  return filter ? (base.trim() ? "(" + base + ") " : "") + filter : base;
}
/** Only remove our exact appended group; keep user changes to other terms. */
export function removeFilter(current: string, base: string, filter: string): string {
  if (current === applyFilter(base, filter)) return base;
  if (filter && current.endsWith(" " + filter)) return current.slice(0, -filter.length - 1);
  if (current === filter) return "";
  return current;
}
