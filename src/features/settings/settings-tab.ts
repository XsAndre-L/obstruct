import { App, Events, EventRef, Plugin, PluginSettingTab } from "obsidian";
import { ConfigController } from "../../shared/config/controller";
import { ResourceService } from "../resources/service";
import { WorkspaceSettings } from "../workspace/settings/workspace-settings";
import { GraphController } from "../graph/controller";
import { renderGraphSettings } from "../graph/settings";
import { DraftActions } from "./components/draft-actions";
import { renderTabs } from "../../shared/ui/tabs";

export class ObstructSettingsTab extends PluginSettingTab {
  private folderEvents: EventRef[] = [];
  private folderTimer?: ReturnType<typeof setTimeout>;
  private selected = "Workspace";
  private workspace: WorkspaceSettings;
  private actions: DraftActions;
  private unsubscribe?: () => void;
  constructor(app: App, plugin: Plugin, private config: ConfigController, service: ResourceService, private graph: GraphController) {
    super(app, plugin);
    this.workspace = new WorkspaceSettings(app, this.containerEl, config, service, () => this.render());
    this.actions = new DraftActions(config, service);
  }
  display(): void {
    this.hide();
    for (const event of ["create", "delete", "rename"]) {
      this.folderEvents.push((this.app.vault as Events).on(event, (file: unknown) => {
        if (!Array.isArray((file as { children?: unknown[] })?.children)) return;
        if (this.selected !== "Graph") return;
        clearTimeout(this.folderTimer);
        this.folderTimer = setTimeout(() => {
          if (this.unsubscribe && this.selected === "Graph") this.render();
        }, 100);
      }));
    }
    this.render();
    this.unsubscribe = this.config.subscribe(change => {
      if (change === "discard" || (change === "active" && !this.config.dirty)) this.workspace.removed = [];
      if (change === "draft") this.actions.validateDraft(); else this.render();
    });
  }
  private render(): void {
    this.workspace.hide();
    const el = this.containerEl;
    el.empty(); el.addClass("obstruct-settings");
    const content = el.createDiv({ cls: "obstruct-settings-content" });
    content.createEl("h2", { text: "Obstruct" });
    const panel = renderTabs(content, ["Workspace", "Graph"], this.selected, "obstruct-primary", "Obstruct settings", "obstruct-primary-tabs", selected => {
      this.selected = selected; this.render();
      el.querySelector<HTMLElement>('.obstruct-primary-tabs [aria-selected="true"]')?.focus();
    });
    if (this.selected === "Workspace") this.workspace.renderInto(panel);
    else {
      const fields = panel.createEl("fieldset", { cls: "obstruct-fields" });
      fields.disabled = this.config.busy;
      renderGraphSettings(fields, this.config, this.graph, () => this.render());
    }
    this.actions.render(el);
  }
  hide(): void {
    clearTimeout(this.folderTimer);
    for (const event of this.folderEvents) this.app.vault.offref(event);
    this.folderEvents = [];
    this.unsubscribe?.(); this.unsubscribe = undefined; this.workspace.hide(); this.actions.dispose(); }
}
