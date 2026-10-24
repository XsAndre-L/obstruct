import { App, Setting } from "obsidian";
import { applyFilter, folderFilter, removeFilter } from "./search";
interface Engine {
  options?: { search?: string };
  filterOptions?: { search?: { getValue?(): string; setValue?(value: string): void } };
  updateSearch?(): void;
  render?(): void;
  onOptionsChange?(): void;
}
interface GraphLeaf { view: { containerEl: HTMLElement; dataEngine?: Engine; engine?: Engine } }
interface Applied { base: string; filter: string }
export interface FolderControl { path: string; label: string; visible: boolean }
/** All access to Obsidian's private graph engine is isolated here. */
export class GraphService {
  private applied = new Map<Engine, Applied>();
  private controls = new Map<HTMLElement, HTMLElement>();
  private signature = "";
  constructor(private app: App) {}
  private leaves(): GraphLeaf[] {
    return ["graph", "localgraph"].flatMap(type => this.app.workspace.getLeavesOfType(type)) as unknown as GraphLeaf[];
  }
  private read(engine: Engine): string { return engine.filterOptions?.search?.getValue?.() ?? engine.options?.search ?? ""; }
  private write(engine: Engine, value: string): void {
    if (this.read(engine) === value) return;
    engine.filterOptions?.search?.setValue?.(value);
    if (engine.options) engine.options.search = value;
    engine.updateSearch?.();
    engine.render?.();
  }
  update(folders: FolderControl[], hidden: string[], onChange: (path: string, visible: boolean) => void): void {
    const leaves = this.leaves();
    const engines = new Set<Engine>();
    const filter = folderFilter(hidden);
    for (const { view } of leaves) {
      const engine = view.dataEngine ?? view.engine;
      if (!engine) continue;
      engines.add(engine);
      const previous = this.applied.get(engine);
      const current = this.read(engine);
      const base = previous ? removeFilter(current, previous.base, previous.filter) : current;
      this.write(engine, applyFilter(base, filter));
      this.applied.set(engine, { base, filter });
    }
    for (const engine of this.applied.keys()) if (!engines.has(engine)) this.restore(engine);
    const signature = JSON.stringify(folders);
    if (signature !== this.signature) { this.clearControls(); this.signature = signature; }
    const sections = new Set(leaves.flatMap(({ view }) => Array.from(view.containerEl.querySelectorAll<HTMLElement>(".graph-control-section.mod-filter"))));
    for (const [section, control] of this.controls) {
      if (!sections.has(section) || !control.isConnected) { control.remove(); this.controls.delete(section); }
    }
    for (const section of sections) {
      if (this.controls.has(section)) continue;
      const parent = section.querySelector<HTMLElement>(".tree-item-children") ?? section;
      const group = parent.createDiv({ cls: "obstruct-graph-controls" });
      for (const folder of folders) {
        new Setting(group).setName(folder.label).addToggle(toggle => {
          toggle.setValue(folder.visible).onChange(value => onChange(folder.path, value));
        });
      }
      this.controls.set(section, group);
    }
  }
  private restore(engine: Engine): void {
    const previous = this.applied.get(engine);
    if (previous) this.write(engine, removeFilter(this.read(engine), previous.base, previous.filter));
    this.applied.delete(engine);
  }
  private clearControls(): void { for (const el of this.controls.values()) el.remove(); this.controls.clear(); }
  dispose(): void { for (const engine of this.applied.keys()) this.restore(engine); this.clearControls(); this.signature = ""; }
}
