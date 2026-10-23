import { App, Plugin, PluginSettingTab, Setting } from "obsidian";
import { ConfigController } from "../../shared/config/controller";
import { ResourceConfig } from "../../shared/config/model";
import { resolveNotes, storedPath, within } from "../../shared/paths/resolver";
import { explain, lines, validatePattern } from "../../shared/filtering/ignore";
import { button, message, status } from "../../shared/ui/elements";
import { ResourceService } from "../resources/service";
import { ResourceDialog } from "./resource-dialog";
import { PathPicker } from "./path-picker";
type Tab = "Workspace" | "Resources" | "Ignore rules";
export class WorkspaceSettings extends PluginSettingTab {
  private tab: Tab = "Workspace"; private epoch = 0;
  private unsubscribe?: () => void; private footer?: HTMLElement; private apply?: HTMLButtonElement;
  private validationError = ""; private validating = false; private validationId = 0; private validationTimer: ReturnType<typeof setTimeout> | undefined;
  private removed: { resource: ResourceConfig; index: number }[] = [];
  constructor(app: App, plugin: Plugin, private config: ConfigController, private service: ResourceService) { super(app, plugin); }
  display(): void {
    this.unsubscribe?.(); this.render();
    this.unsubscribe = this.config.subscribe(change => {
      if (change === "discard" || (change === "active" && !this.config.dirty)) this.removed = [];
      if (change === "draft") this.validateDraft(); else this.render();
    });
  }
  hide(): void { this.validationId++; clearTimeout(this.validationTimer); this.epoch++; this.unsubscribe?.(); this.unsubscribe = undefined; }
  private updateFooter(): void {
    if (this.footer) this.footer.setText(this.config.busy ? "Saving…" : this.validating ? "Checking configuration…" : this.validationError || (this.config.dirty ? "Unsaved changes" : "All changes saved"));
    if (this.apply) this.apply.disabled = this.config.busy || this.validating || !!this.validationError || !this.config.dirty;
  }
  private validateDraft(): void {
    const id = ++this.validationId;
    clearTimeout(this.validationTimer); this.validating = true; this.updateFooter();
    const snapshot = JSON.parse(JSON.stringify(this.config.draft));
    this.validationTimer = setTimeout(() => {
      void this.service.validate(snapshot).then(() => {
        if (id === this.validationId) this.validationError = "";
      }, error => {
        if (id === this.validationId) this.validationError = message(error);
      }).finally(() => {
        if (id === this.validationId) { this.validating = false; this.updateFooter(); }
      });
    }, 200);
  }
  private render(): void {
    const epoch = ++this.epoch; const el = this.containerEl; el.empty(); el.addClass("obstruct-settings");
    const content = el.createDiv({ cls: "obstruct-settings-content" });
    content.createEl("h2", { text: "Obstruct Workspace" });
    const fieldset = content.createEl("fieldset", { cls: "obstruct-fields" }); fieldset.disabled = this.config.busy;
    new Setting(fieldset).setName("Enable workspace").setDesc("Pending changes take effect after Apply.").addToggle(t =>
      t.setValue(this.config.draft.enabled).onChange(v => this.config.edit(d => { d.enabled = v; })));
    const tabs = fieldset.createDiv({ cls: "obstruct-tabs", attr: { role: "tablist", "aria-label": "Obstruct settings" } });
    const names: Tab[] = ["Workspace", "Resources", "Ignore rules"];
    for (const name of names) {
      const b = button(tabs, name, () => { this.tab = name; this.render(); this.containerEl.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus(); });
      b.setAttribute("role", "tab"); b.setAttribute("aria-selected", String(this.tab === name)); b.tabIndex = this.tab === name ? 0 : -1;
      b.id = "obstruct-tab-" + names.indexOf(name); b.setAttribute("aria-controls", "obstruct-panel");
      b.addEventListener("keydown", e => {
        let index = names.indexOf(name);
        if (e.key === "ArrowRight") index = (index + 1) % names.length;
        else if (e.key === "ArrowLeft") index = (index + names.length - 1) % names.length;
        else if (e.key === "Home") index = 0; else if (e.key === "End") index = names.length - 1; else return;
        e.preventDefault(); this.tab = names[index]; this.render(); this.containerEl.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus();
      });
    }
    const panel = fieldset.createDiv({ attr: { role: "tabpanel", id: "obstruct-panel", "aria-labelledby": "obstruct-tab-" + names.indexOf(this.tab) } });
    if (this.tab === "Workspace") this.workspace(panel, epoch);
    else if (this.tab === "Resources") this.resources(panel, epoch);
    else this.ignores(panel);
    const bar = el.createDiv({ cls: "obstruct-actions" }); this.footer = status(bar);
    button(bar, "Discard changes", () => this.config.discard()).disabled = this.config.busy;
    this.apply = button(bar, "Apply changes", async () => {
      try { await this.config.apply(); }
      catch (e) {
        const text = message(e); status(content, text);
        const target: Tab = text.startsWith("Resources:") ? "Resources" : text.startsWith("Workspace:") ? "Workspace" : "Ignore rules";
        button(content, "Review " + target, () => { this.tab = target; this.render(); });
      }
    }); this.apply.addClass("mod-cta"); this.validateDraft();
  }
  private workspace(el: HTMLElement, epoch: number): void {
    new Setting(el).setName("Actual vault location").setDesc(this.service.vaultRoot).addButton(b => b.setButtonText("Copy path").onClick(() => navigator.clipboard.writeText(this.service.vaultRoot)));
    el.createEl("p", { text: "To change the actual vault root, open that folder as a vault in Obsidian. Files are never moved." });
    new Setting(el).setName("Display name").setDesc("Blank uses the real vault name.").addText(t =>
      t.setValue(this.config.draft.displayName).setPlaceholder("Display name").onChange(v => { this.config.edit(d => { d.displayName = v; }); tree(); }));
    let input: HTMLInputElement;
    new Setting(el).setName("Main notes folder").setDesc("Use . for this vault root, or an internal folder such as docs.").addText(t => {
      input = t.inputEl; input.setAttribute("aria-label", "Main notes folder"); t.setValue(this.config.draft.mainNotesPath).onChange(v => { this.config.edit(d => { d.mainNotesPath = v; }); void check(); });
    }).addButton(b => b.setButtonText("Browse").onClick(() => new PathPicker(this.app, this.service, this.service.vaultRoot, true, absolute => {
      this.config.edit(d => { d.mainNotesPath = storedPath(this.service.vaultRoot, absolute); }); input.value = this.config.draft.mainNotesPath; void check();
    }).open()));
    const feedback = status(el); let checkId = 0;
    const check = async () => {
      const id = ++checkId;
      try {
        const absolute = resolveNotes(this.service.vaultRoot, this.config.draft.mainNotesPath);
        feedback.setText(absolute + " · Checking…");
        const state = await this.service.inspect(absolute);
        if (epoch === this.epoch && id === checkId) feedback.setText(absolute + " · " + state.status + (state.kind === "file" ? " — choose a folder" : "") + " · " + state.detail);
      } catch (e) { if (epoch === this.epoch && id === checkId) feedback.setText(message(e)); }
    };
    el.createEl("h3", { text: "Workspace preview" });
    const preview = el.createEl("pre");
    const tree = () => { preview.setText((this.config.draft.displayName || this.app.vault.getName()) + "\n  Notes\n  Resources" + this.config.draft.resources.filter(r => r.enabled).map(r => "\n    " + r.label).join("")); };
    tree(); void check();
    el.createEl("p", { text: "Core note and attachment locations are unchanged. The native explorer remains available and unfiltered." });
  }
  private resources(el: HTMLElement, epoch: number): void {
    const edit = (resource: ResourceConfig | null) => new ResourceDialog(this.app, this.service, resource, updated => {
      this.config.edit(d => { const index = d.resources.findIndex(r => r.id === updated.id); if (index < 0) d.resources.push(updated); else d.resources[index] = updated; });
      this.render();
    }).open();
    const toolbar = el.createDiv({ cls: "obstruct-toolbar" });
    button(toolbar, "Add resource", () => edit(null)); const checks: (() => Promise<void>)[] = [];
    button(toolbar, "Recheck all", async () => { await Promise.all(checks.map(check => check())); });
    if (!this.config.draft.resources.length) el.createEl("p", { text: "Add folders or files to access alongside your notes." });
    this.config.draft.resources.forEach((resource, index) => {
      const row = el.createDiv({ cls: "obstruct-resource" });
      new Setting(row).setName(resource.label).setDesc(resource.path).addToggle(t => t.setValue(resource.enabled).onChange(value => {
        this.config.edit(d => { d.resources[index].enabled = value; }); void check();
      }));
      const feedback = status(row); let generation = 0;
      const check = async () => {
        const id = ++generation; feedback.setText("Checking…");
        try {
          const root = this.service.root(this.config.draft.resources[index]);
          const state = await this.service.check(root);
          if (epoch === this.epoch && id === generation) feedback.setText(state.status + " · " + (within(this.service.vaultRoot, root.absolute) ? "Inside vault" : "Outside vault") + " · " + root.absolute + " · " + state.detail);
        } catch (e) { if (epoch === this.epoch && id === generation) feedback.setText(message(e)); }
      };
      checks.push(check); void check();
      const actions = row.createDiv({ cls: "obstruct-toolbar" });
      button(actions, "Edit", () => edit(resource)); button(actions, "Recheck", check);
      for (const [label, delta] of [["Move up", -1], ["Move down", 1]] as const) {
        button(actions, label, () => { this.config.edit(d => { const [item] = d.resources.splice(index, 1); d.resources.splice(index + delta, 0, item); }); this.render(); }).disabled = index + delta < 0 || index + delta >= this.config.draft.resources.length;
      }
      button(actions, "Remove", () => {
        this.removed.push({ resource, index }); this.config.edit(d => { d.resources.splice(index, 1); }); this.render();
        this.containerEl.querySelector<HTMLElement>('[role="tabpanel"] button')?.focus();
      });
    });
    if (this.removed.length) button(el, "Undo removal", () => { const item = this.removed.pop()!; this.config.edit(d => d.resources.splice(item.index, 0, item.resource)); this.render(); });
  }
  private ignores(el: HTMLElement): void {
    el.createEl("p", { text: "These rules filter Obstruct browsing. They do not stop Obsidian indexing files or change native search and graph results." });
    el.createEl("p", { text: "One rule per line, relative to Notes and each resource root. Supports *, ** and ?. Exclusions win; matching folders exclude descendants." });
    const input = el.createEl("textarea", { attr: { rows: "6", "aria-label": "Global ignore rules" } }); input.value = this.config.draft.ignore.join("\n");
    const feedback = status(el);
    input.addEventListener("input", () => {
      this.config.edit(d => { d.ignore = lines(input.value); });
      try { this.config.draft.ignore.forEach(validatePattern); feedback.setText(""); } catch(e) { feedback.setText(message(e)); }
    });
    const presets = el.createDiv({ cls: "obstruct-toolbar" });
    button(presets, "Add dependency preset", () => { this.config.edit(d => { d.ignore = [...new Set([...d.ignore, "**/node_modules/**"])]; }); this.render(); });
    button(presets, "Add build-output preset", () => { this.config.edit(d => { d.ignore = [...new Set([...d.ignore, "**/dist/**", "**/build/**"])]; }); this.render(); });
    el.createEl("h3", { text: "Test a path" });
    const tester = el.createDiv({ cls: "obstruct-rule-tester" });
    const select = tester.createEl("select", { attr: { "aria-label": "Rule test root" } });
    select.createEl("option", { text: "Notes", value: "notes" });
    for (const r of this.config.draft.resources) select.createEl("option", { text: r.label, value: r.id });
    const test = tester.createEl("input", { attr: { type: "text", "aria-label": "Path relative to selected root", placeholder: "nested/node_modules/package/index.js" } });
    const result = status(el);
    const evaluate = () => {
      try {
        const matches = explain(test.value, this.config.draft.ignore, this.config.draft.resources.find(r => r.id === select.value)?.ignore ?? []);
        result.setText(test.value + ": " + (matches.length ? "Excluded — " + matches.map(m => m.source + ": " + m.pattern).join("; ") : "Visible"));
      } catch(e) { result.setText(message(e)); }
    }; test.addEventListener("input", evaluate); select.addEventListener("change", evaluate);
  }
}
