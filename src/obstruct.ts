import { FileSystemAdapter, Notice, Plugin } from "obsidian";
import { ConfigController } from "./shared/config/controller";
import { ResourceService } from "./features/resources/service";
import { DisplayName } from "./features/display-name/presentation";
import { WorkspaceSettings } from "./features/settings/settings-tab";
import { WorkspaceCoordinator } from "./features/workspace/coordinator";
import { WORKSPACE_TYPE, WorkspaceView } from "./features/workspace/view";
import { PREVIEW_TYPE, ResourcePreview } from "./features/preview/view";

export default class Obstruct extends Plugin {
  async onload(): Promise<void> {
    const adapter = this.app.vault.adapter;
    if (!(adapter instanceof FileSystemAdapter)) { new Notice("Obstruct requires a local desktop vault."); return; }
    const resources = new ResourceService(adapter.getBasePath());
    const config = new ConfigController(await this.loadData(), data => this.saveData(data), data => resources.validate(data));
    const workspace = new WorkspaceCoordinator(this.app, config, resources, this.manifest.id);
    const settings = new WorkspaceSettings(this.app, this, config, resources);
    let name: DisplayName | undefined; let stopped = false;
    this.registerView(WORKSPACE_TYPE, leaf => new WorkspaceView(leaf, config, resources, workspace.openFile, workspace.showSettings));
    this.registerView(PREVIEW_TYPE, leaf => new ResourcePreview(leaf, config, resources, workspace.openFile));
    this.addSettingTab(settings);
    const show = () => void workspace.show().catch(e => new Notice(String(e)));
    this.addRibbonIcon("folder-tree", "Open Obstruct workspace", show);
    this.addCommand({ id: "open-workspace", name: "Open workspace", callback: show });
    this.addCommand({ id: "open-workspace-settings", name: "Open workspace settings", callback: workspace.showSettings });
    this.addCommand({ id: "toggle-folder-focus", name: "Toggle workspace", callback: () => {
      void config.toggle().catch(e => new Notice(String(e)));
    }});
    const unsubscribe = config.subscribe(change => {
      if (change !== "active") return;
      name?.update(config.active.displayName, config.active.enabled);
      if (config.active.enabled) show();
    });
    this.app.workspace.onLayoutReady(() => {
      if (stopped) return;
      name = new DisplayName(document, this.app.vault.getName());
      name.update(config.active.displayName, config.active.enabled);
      if (config.active.enabled) show();
    });
    this.register(() => { stopped = true; unsubscribe(); settings.hide(); workspace.dispose(); name?.dispose(); config.dispose(); resources.dispose(); });
  }
}
