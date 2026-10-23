import { ItemView, WorkspaceLeaf } from "obsidian";
import { ConfigController } from "../../shared/config/controller";
import { ResourceService, Root } from "../resources/service";
import { explain } from "../../shared/filtering/ignore";
import { button, message, status } from "../../shared/ui/elements";
export const WORKSPACE_TYPE = "obstruct-workspace";
export class WorkspaceView extends ItemView {
  private epoch = 0; private unsubscribe?: () => void;
  constructor(leaf: WorkspaceLeaf, private config: ConfigController, private service: ResourceService,
    private openFile: (path: string) => Promise<void>, private openSettings: () => void) { super(leaf); }
  getViewType(): string { return WORKSPACE_TYPE; }
  getDisplayText(): string { return this.config.active.displayName || "Obstruct Workspace"; }
  getIcon(): string { return "folder-tree"; }
  async onOpen(): Promise<void> {
    this.unsubscribe = this.config.subscribe(change => { if (change === "active") this.render(); }); this.render();
  }
  render(): void {
    const epoch = ++this.epoch; const el = this.contentEl; el.empty(); el.addClass("obstruct-workspace");
    el.createEl("h3", { text: this.getDisplayText() });
    el.createEl("p", { cls: "obstruct-workspace-intro", text: "Browse your Notes folder and added Resources. Expand a folder, then select a file to open it." });
    const toolbar = el.createDiv({ cls: "obstruct-toolbar" });
    button(toolbar, "Settings", this.openSettings).title = "Choose your notes folder, resources and ignore rules";
    button(toolbar, "Recheck all", () => this.render()).title = "Check folder availability and refresh the tree";
    el.createEl("p", { cls: "obstruct-workspace-help", text: "Vault files open in Obsidian. Supported files outside the vault open in a read-only preview." });
    if (!this.config.active.enabled) { status(el, "Obstruct workspace is disabled. The native file explorer is unchanged."); return; }
    try {
      const roots = this.service.roots(this.config.active);
      void this.root(el, roots[0], epoch);
      el.createEl("h4", { text: "Resources" });
      if (roots.length === 1) status(el, "No extra resources yet. Use Settings to add files or folders alongside your notes.");
      for (const root of roots.slice(1)) void this.root(el, root, epoch);
    } catch(e) { status(el, message(e)); button(el, "Review settings", this.openSettings); }
  }
  private async root(parent: HTMLElement, root: Root, epoch: number): Promise<void> {
    const container = parent.createDiv({ cls: "obstruct-root" }); const feedback = status(container, root.label + " · Checking…");
    const state = await this.service.check(root); if (epoch !== this.epoch) return;
    if (state.status !== "Available") {
      feedback.setText(root.label + " · " + state.status + " · " + state.detail);
      if (root.enabled) button(container, "Retry", () => this.render());
      if (root.id === "notes") button(container, "Choose notes folder", this.openSettings);
      return;
    }
    feedback.setText("");
    if (state.kind === "file") {
      if (explain(this.service.relative(root, root.absolute, true), this.config.active.ignore, root.ignore).length) status(container, root.label + " · Excluded by ignore rules");
      else button(container, root.label, () => this.openFile(root.absolute));
    } else this.folder(container, root, root.absolute, root.label, epoch);
  }
  private folder(parent: HTMLElement, root: Root, absolute: string, label: string, epoch: number): void {
    const detail = parent.createEl("details"); detail.createEl("summary", { text: label });
    const content = detail.createDiv({ cls: "obstruct-children" }); let generation = 0;
    detail.addEventListener("toggle", () => {
      const id = ++generation;
      if (!detail.open) { content.empty(); return; }
      void (async () => {
        content.empty(); const feedback = status(content, "Loading…");
        try {
          const entries = await this.service.list(root, absolute, this.config.active);
          if (epoch !== this.epoch || generation !== id || !detail.open) return;
          feedback.setText(entries.length ? "" : "No visible entries.");
          let offset = 0;
          const more = button(content, "Show more", () => draw());
          const draw = () => {
            for (const entry of entries.slice(offset, offset + 200)) {
              if (entry.kind === "folder") this.folder(content, root, entry.absolute, entry.name, epoch);
              else if (entry.kind === "link") status(content, entry.name + " · Linked entry skipped");
              else button(content, entry.name, () => this.openFile(entry.absolute)).addClass("obstruct-file");
            }
            offset += 200; more.hidden = offset >= entries.length; content.appendChild(more);
          }; draw();
        } catch(e) {
          if (epoch !== this.epoch || generation !== id) return;
          feedback.setText(message(e)); button(content, "Retry", () => { detail.open = false; queueMicrotask(() => { detail.open = true; }); });
        }
      })();
    });
  }
  async onClose(): Promise<void> { this.epoch++; this.unsubscribe?.(); this.contentEl.empty(); }
}
