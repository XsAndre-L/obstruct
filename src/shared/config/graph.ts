export interface GraphConfig {
  enabled: boolean;
  notesPath: string;
  folderLabels: Record<string, string>;
  hiddenFolderPaths: string[];
}
export function readGraph(value: unknown): GraphConfig {
  const data = value && typeof value === "object" ? value as Partial<GraphConfig> : {};
  return {
    enabled: data.enabled === true,
    notesPath: typeof data.notesPath === "string" ? data.notesPath : "",
    folderLabels: Object.fromEntries(Object.entries(data.folderLabels ?? {}).filter(([key, value]) => key && typeof value === "string")),
    hiddenFolderPaths: Array.isArray(data.hiddenFolderPaths) ? [...new Set(data.hiddenFolderPaths.filter(p => typeof p === "string"))] : [],
  };
}
