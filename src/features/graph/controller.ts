import { App, Events, Notice, Plugin } from "obsidian";
import { ConfigController } from "../../shared/config/controller";
import { ResourceService } from "../resources/service";
import { resolveNotes, storedPath } from "../../shared/paths/resolver";
import { WorkspaceConfig } from "../../shared/config/model";
import { GraphService } from "./service";
interface Folder { path: string; name: string; children?: Folder[] }
export class GraphController {
  private service: GraphService;
  private timer?: ReturnType<typeof setTimeout>;
  private stopped = false;
  constructor(private app: App, private config: ConfigController, private resources: ResourceService) {
    this.service = new GraphService(app);
  }
  root(config = this.config.active): string {
    return storedPath(this.resources.vaultRoot, resolveNotes(this.resources.vaultRoot, config.graph.notesPath || config.mainNotesPath));
  }
  folders(config = this.config.active): Folder[] {
    const root = this.root(config);
    const vault = this.app.vault as typeof this.app.vault & { getRoot?(): Folder };
    const folder = (root === "." ? vault.getRoot?.() : vault.getAbstractFileByPath(root)) as Folder | null;
    return (folder?.children ?? []).filter(child => Array.isArray(child.children)).sort((a, b) => a.name.localeCompare(b.name));
  }
  label(path: string, config = this.config.active): string { return config.graph.folderLabels[path] || path.split("/").pop() || path; }
  start(plugin: Plugin): void {
    const unsubscribe = this.config.subscribe(change => { if (change === "active") this.schedule(); });
    plugin.register(unsubscribe);
    for (const event of ["layout-change", "active-leaf-change"] as const) plugin.registerEvent((this.app.workspace as Events).on(event, () => this.schedule()));
    for (const event of ["create", "delete", "rename"] as const) plugin.registerEvent((this.app.vault as Events).on(event, () => this.schedule()));
    for (const [id, name, hidden] of [
      ["show-all-note-folders-in-graph", "Show all note folders in Graph", false],
      ["hide-all-note-folders-in-graph", "Hide all note folders in Graph", true],
    ] as const) plugin.addCommand({ id, name, callback: () => { void this.config.updateGraph(graph => {
      graph.hiddenFolderPaths = hidden ? this.folders().map(f => f.path) : [];
    }).catch(error => new Notice(String(error))); } });
    plugin.addCommand({ id: "refresh-note-folder-graph-filters", name: "Refresh note folder Graph filters", callback: () => this.schedule() });
    this.schedule();
  }
  schedule(): void {
    if (this.stopped) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.refresh(), 100);
  }
  refresh(): void {
    if (this.stopped) return;
    if (!this.config.active.graph.enabled) { this.service.dispose(); return; }
    try {
      const folders = this.folders();
      const hidden = this.config.active.graph.hiddenFolderPaths.filter(path => folders.some(folder => folder.path === path));
      this.service.update(folders.map(folder => ({ path: folder.path, label: this.label(folder.path), visible: !hidden.includes(folder.path) })), hidden,
        (path, visible) => { void this.config.updateGraph(graph => {
          graph.hiddenFolderPaths = graph.hiddenFolderPaths.filter(p => p !== path);
          if (!visible) graph.hiddenFolderPaths.push(path);
        }).catch(error => { new Notice(String(error)); this.service.dispose(); this.schedule(); }); });
    } catch (error) { this.service.dispose(); console.error("Obstruct Graph", error); }
  }
  dispose(): void { this.stopped = true; clearTimeout(this.timer); this.service.dispose(); }
}
