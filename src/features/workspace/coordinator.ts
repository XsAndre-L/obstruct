import { App, TFile } from "obsidian";
import path from "node:path";
import { ConfigController } from "../../shared/config/controller";
import { ResourceService } from "../resources/service";
import { within, slash } from "../../shared/paths/resolver";
import { PREVIEW_TYPE } from "../preview/view";
import { WORKSPACE_TYPE } from "./view";
interface SettingsHost { setting?: { open(): void; openTabById(id: string): void } }
export class WorkspaceCoordinator {
  private stopped = false; private opening: Promise<void> | null = null;
  constructor(private app: App, private config: ConfigController, private service: ResourceService, private pluginId: string) {}
  showSettings = (): void => {
    // Obsidian has no public method for selecting a plugin's settings tab.
    const settings = (this.app as App & SettingsHost).setting;
    if (!settings) throw new Error("Open Obsidian Settings → Obstruct.");
    settings.open(); settings.openTabById(this.pluginId);
  };
  show = async (): Promise<void> => {
    if (this.stopped) return;
    if (this.opening) return this.opening;
    this.opening = (async () => {
      const existing = this.app.workspace.getLeavesOfType(WORKSPACE_TYPE)[0];
      const leaf = existing ?? this.app.workspace.getLeftLeaf(false);
      if (!leaf) return;
      if (!existing) await leaf.setViewState({ type: WORKSPACE_TYPE, active: true });
      if (!this.stopped) await this.app.workspace.revealLeaf(leaf);
    })();
    try { await this.opening; } finally { this.opening = null; }
  };
  openFile = async (absolute: string): Promise<void> => {
    const snapshot = this.config.active;
    const root = await this.service.allowed(absolute, snapshot);
    if (this.stopped || snapshot !== this.config.active) return;
    if (!root) throw new Error("This file is unavailable or outside the enabled workspace.");
    if (within(this.service.vaultRoot, absolute)) {
      const file = this.app.vault.getAbstractFileByPath(slash(path.relative(this.service.vaultRoot, absolute)));
      if (file instanceof TFile) { await this.app.workspace.getLeaf(false).openFile(file); return; }
    }
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.setViewState({ type: PREVIEW_TYPE, state: { file: absolute, rootId: root.id }, active: true });
    if (!this.stopped) await this.app.workspace.revealLeaf(leaf);
  };
  dispose(): void { this.stopped = true; this.app.workspace.detachLeavesOfType(WORKSPACE_TYPE); this.app.workspace.detachLeavesOfType(PREVIEW_TYPE); }
}
