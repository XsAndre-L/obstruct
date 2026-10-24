import { App, Setting } from "obsidian";
import { ConfigController } from "../../../shared/config/controller";
import { ResourceConfig } from "../../../shared/config/model";
import { ResourceService } from "../../resources/service";
import { renderTabs } from "../../../shared/ui/tabs";
import { renderGeneral } from "./general-section";
import { renderResources } from "./resources-section";
import { renderIgnore } from "./ignore-section";
export class WorkspaceSettings {
  private tab = "General";
  epoch = 0;
  removed: { resource: ResourceConfig; index: number }[] = [];
  constructor(public app: App, public containerEl: HTMLElement, public config: ConfigController, public service: ResourceService, public render: () => void) {}
  hide(): void { this.epoch++; }
  renderInto(parent: HTMLElement): void {
    const epoch = ++this.epoch;
    const fields = parent.createEl("fieldset", { cls: "obstruct-fields" }); fields.disabled = this.config.busy;
    new Setting(fields).setName("Enable workspace").addToggle(t => t.setValue(this.config.draft.enabled).onChange(v => this.config.edit(d => { d.enabled = v; })));
    const panel = renderTabs(fields, ["General", "Resources", "Ignore rules"], this.tab, "obstruct-workspace", "Workspace settings", "obstruct-workspace-subtabs", selected => {
      this.tab = selected; this.render();
      this.containerEl.querySelector<HTMLElement>('.obstruct-workspace-subtabs [aria-selected="true"]')?.focus();
    });
    if (this.tab === "General") renderGeneral(this, panel, epoch);
    else if (this.tab === "Resources") renderResources(this, panel, epoch);
    else renderIgnore(this, panel);
  }
}
