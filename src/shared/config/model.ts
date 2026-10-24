import { GraphConfig, readGraph } from "./graph";
export interface ResourceConfig { id: string; label: string; path: string; enabled: boolean; ignore: string[] }
export interface WorkspaceConfig {
  schemaVersion: 2; enabled: boolean; displayName: string; mainNotesPath: string;
  resources: ResourceConfig[]; ignore: string[]; graph: GraphConfig;
}
export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
export function migrate(data: unknown): WorkspaceConfig {
  const d = data && typeof data === "object" ? data as Record<string, unknown> : {};
  const strings = (v: unknown): string[] => Array.isArray(v) ? v.filter(x => typeof x === "string") : [];
  return {
    graph: readGraph(d.graph),
    schemaVersion: 2, enabled: typeof d.enabled === "boolean" ? d.enabled : true,
    displayName: typeof d.displayName === "string" ? d.displayName : "",
    mainNotesPath: typeof d.mainNotesPath === "string" ? d.mainNotesPath || "." : typeof d.visibleFolder === "string" ? d.visibleFolder || "." : ".",
    ignore: strings(d.ignore),
    resources: Array.isArray(d.resources) ? d.resources.map((r: Partial<ResourceConfig>, i) => ({
      id: typeof r?.id === "string" ? r.id : "migrated-" + i,
      label: typeof r?.label === "string" ? r.label : "",
      path: typeof r?.path === "string" ? r.path : "",
      enabled: r?.enabled !== false, ignore: strings(r?.ignore),
    })) : [],
  };
}
