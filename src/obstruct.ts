import { Notice, Plugin, PluginSettingTab, Setting, TFolder } from "obsidian";
import { FocusSettings, normalizeFolder, readSettings } from "./focus-settings";
import { FocusPresentation } from "./focus-presentation";

export default class Obstruct extends Plugin {
  settings: FocusSettings = readSettings(null);
  private presentation: FocusPresentation | null = null;
  private observer: MutationObserver | null = null;
  private frame: number | null = null;
  private stopped = false;

  async onload(): Promise<void> {
    this.settings = readSettings(await this.loadData());
    this.addSettingTab(new ObstructSettings(this));
    this.addCommand({
      id: "toggle-folder-focus", name: "Toggle folder focus",
      callback: async () => {
        const previous = this.settings.enabled;
        this.settings.enabled = !previous;
        try {
          await this.saveData(this.settings);
          this.refresh();
          new Notice(this.settings.enabled ? "Obstruct focus enabled" : "Obstruct focus disabled");
        } catch {
          this.settings.enabled = previous;
          new Notice("Obstruct could not save settings. Focus was not changed.");
        }
      },
    });
    this.app.workspace.onLayoutReady(() => {
      if (this.stopped) return;
      this.presentation = new FocusPresentation(document, this.app.vault.getName());
      this.observer = new MutationObserver(() => this.schedule());
      this.refresh();
    });
    this.registerEvent(this.app.workspace.on("layout-change", () => this.schedule()));
    this.registerEvent(this.app.workspace.on("file-open", () => this.schedule()));
    this.registerEvent(this.app.vault.on("create", () => this.schedule()));
    this.registerEvent(this.app.vault.on("delete", () => this.schedule()));
    this.registerEvent(this.app.vault.on("rename", () => this.schedule()));
  }

  private schedule(): void {
    if (this.stopped || this.frame !== null) return;
    this.frame = window.requestAnimationFrame(() => {
      this.frame = null;
      this.refresh();
    });
  }

  refresh(): void {
    if (this.stopped || !this.presentation) return;
    this.observer?.disconnect();
    const folder = this.app.vault.getAbstractFileByPath(this.settings.visibleFolder);
    this.presentation.apply(this.settings, folder instanceof TFolder);
    this.observer?.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["data-path"] });
    const title = document.querySelector("title");
    if (title) this.observer?.observe(title, { childList: true, subtree: true, characterData: true });
  }

  onunload(): void {
    this.stopped = true;
    this.observer?.disconnect();
    if (this.frame !== null) window.cancelAnimationFrame(this.frame);
    this.presentation?.dispose();
  }
}

class ObstructSettings extends PluginSettingTab {
  constructor(private plugin: Obstruct) { super(plugin.app, plugin); }

  display(): void {
    const el = this.containerEl;
    el.empty();
    el.createEl("h2", { text: "Obstruct" });
    el.createEl("p", { text: "Give this vault a display name and focus its file explorer on one folder. Files remain in place. Search, graph, links and indexing still cover the full vault." });
    let name = this.plugin.settings.displayName;
    let folder = this.plugin.settings.visibleFolder;
    let enabled = this.plugin.settings.enabled;
    new Setting(el).setName("Enable focus").setDesc("Turn off to restore the normal name and file explorer.").addToggle(toggle => toggle.setValue(enabled).onChange(value => { enabled = value; }));
    new Setting(el).setName("Display name").setDesc("Shown in the main window title and vault labels. Blank uses the real folder name.").addText(text => text.setPlaceholder("WebAppStack").setValue(name).onChange(value => { name = value; }));
    new Setting(el).setName("Visible folder").setDesc("Vault-relative path, such as docs or notes/project. Blank shows everything.").addText(text => text.setPlaceholder("docs").setValue(folder).onChange(value => { folder = value; }));
    const feedback = el.createEl("p", { attr: { role: "status", "aria-live": "polite" } });
    new Setting(el).addButton(button => button.setButtonText("Apply").setCta().onClick(async () => {
      try {
        const path = normalizeFolder(folder);
        if (enabled && path && !(this.app.vault.getAbstractFileByPath(path) instanceof TFolder)) {
          throw new Error("That folder does not exist in this vault. Create it first or choose another folder.");
        }
        const previous = this.plugin.settings;
        this.plugin.settings = { displayName: name.trim(), visibleFolder: path, enabled };
        try { await this.plugin.saveData(this.plugin.settings); }
        catch (error) { this.plugin.settings = previous; throw error; }
        this.plugin.refresh();
        feedback.setText("Saved for this vault.");
      } catch (error) {
        feedback.setText(error instanceof Error ? error.message : "Could not save settings.");
      }
    }));
  }
}
