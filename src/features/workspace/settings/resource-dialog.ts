import { App, Modal, Setting } from "obsidian";
import { clone, ResourceConfig } from "../../../shared/config/model";
import { ResourceService } from "../../resources/service";
import { lines, validatePattern } from "../../../shared/filtering/ignore";
import { resolveResource, storedPath, within } from "../../../shared/paths/resolver";
import { button, message, status } from "../../../shared/ui/elements";
import { PathPicker } from "./path-picker";
export class ResourceDialog extends Modal {
  private editing: boolean;
  private resource: ResourceConfig; private epoch = 0; private timer: ReturnType<typeof setTimeout> | undefined;
  constructor(app: App, private service: ResourceService, resource: ResourceConfig | null, private save: (resource: ResourceConfig) => void) {
    super(app); this.editing = resource !== null; this.resource = resource ? clone(resource) : { id: crypto.randomUUID(), label: "", path: "", enabled: true, ignore: [] };
  }
  onOpen(): void {
    this.titleEl.setText(this.editing ? "Edit resource" : "Add resource");
    this.titleEl.addClass("obstruct-dialog-title");
    const el = this.contentEl; el.addClass("obstruct-dialog");
    new Setting(el).setName("Name").addText(t => { t.inputEl.setAttribute("aria-label", "Resource name"); t.setValue(this.resource.label).onChange(v => { this.resource.label = v; }); });
    let pathInput: HTMLInputElement;
    new Setting(el).setName("Path").setDesc("Relative to the actual vault root; ../ and ../../ are supported.").addText(t => {
      pathInput = t.inputEl; pathInput.setAttribute("aria-label", "Resource path"); t.setValue(this.resource.path).onChange(v => { this.resource.path = v; schedule(); });
    }).addButton(b => b.setButtonText("Browse").onClick(() => {
      new PathPicker(this.app, this.service, this.service.vaultRoot, false, absolute => {
        this.resource.path = storedPath(this.service.vaultRoot, absolute); pathInput.value = this.resource.path; schedule();
      }).open();
    }));
    const feedback = status(el);
    const check = async () => {
      const epoch = ++this.epoch; feedback.setText("Checking…");
      try {
        const absolute = resolveResource(this.service.vaultRoot, this.resource.path);
        const state = await this.service.inspect(absolute); if (epoch !== this.epoch) return;
        feedback.setText(absolute + " · " + (within(this.service.vaultRoot, absolute) ? "Inside vault" : "Outside vault") + " · " + (state.kind ?? "") + " · " + state.status + ": " + state.detail);
      } catch (e) { if (epoch === this.epoch) feedback.setText(message(e)); }
    };
    const schedule = () => { this.epoch++; clearTimeout(this.timer); this.timer = setTimeout(() => void check(), 300); };
    new Setting(el).setName("Enabled").addToggle(t => t.setValue(this.resource.enabled).onChange(v => { this.resource.enabled = v; }));
    const detail = el.createEl("details"); detail.createEl("summary", { text: "Resource ignore rules" });
    const textarea = detail.createEl("textarea", { attr: { "aria-label": "Resource ignore rules", rows: "5" } });
    textarea.value = this.resource.ignore.join("\n"); textarea.addEventListener("input", () => { this.resource.ignore = lines(textarea.value); });
    el.createEl("p", { text: "Missing resources can be saved and retried later." });
    const actions = el.createDiv({ cls: "obstruct-toolbar obstruct-dialog-actions" });
    button(actions, "Cancel", () => this.close());
    button(actions, "Save to draft", async () => {
      try {
        if (!this.resource.label.trim()) throw new Error("Enter a resource name.");
        this.resource.ignore.forEach(validatePattern);
        const absolute = resolveResource(this.service.vaultRoot, this.resource.path);
        const epoch = ++this.epoch;
        const state = await this.service.inspect(absolute); if (epoch !== this.epoch) return;
        if (state.status === "Unsupported") throw new Error(state.detail);
        this.resource.path = storedPath(this.service.vaultRoot, absolute);
        this.resource.label = this.resource.label.trim(); this.save(clone(this.resource)); this.close();
      } catch (e) { feedback.setText(message(e)); }
    }).addClass("mod-cta");
    if (this.resource.path) void check();
  }
  onClose(): void { this.epoch++; clearTimeout(this.timer); this.contentEl.empty(); }
}
