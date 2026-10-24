import { Setting, SettingGroup } from "obsidian";
import { ConfigController } from "../../shared/config/controller";
import { GraphController } from "./controller";
import { button, message, status } from "../../shared/ui/elements";
export function renderGraphSettings(el: HTMLElement, config: ConfigController, graph: GraphController, refresh: () => void): void {
  new Setting(el).setName("Enable graph filters").addToggle(toggle => toggle.setValue(config.draft.graph.enabled).onChange(value => config.edit(d => { d.graph.enabled = value; })));
  new Setting(el).setName("Notes folder").setDesc("Blank uses the workspace notes folder. Controls its immediate subfolders.").addText(text => {
    text.inputEl.setAttribute("aria-label", "Graph notes folder");
    text.setValue(config.draft.graph.notesPath).setPlaceholder(config.draft.mainNotesPath).onChange(value => config.edit(d => { d.graph.notesPath = value; }));
  });
  const actions = el.createDiv({ cls: "obstruct-toolbar" });
  button(actions, "Show all", () => { config.edit(d => { d.graph.hiddenFolderPaths = []; }); refresh(); });
  button(actions, "Hide all", () => {
    try { const folders = graph.folders(config.draft); config.edit(d => { d.graph.hiddenFolderPaths = folders.map(f => f.path); }); refresh(); }
    catch(error) { status(el, message(error)); }
  });
  button(actions, "Refresh folders", () => { graph.schedule(); refresh(); });
  try {
    const folders = graph.folders(config.draft);
    if (!folders.length) status(el, "No subfolders found. Choose a notes folder and refresh.");
    const group = folders.length ? new SettingGroup(el).addClass("obstruct-graph-folders") : null;
    for (const folder of folders) {
      new Setting(group!.listEl).setName(folder.name).setDesc(folder.path)
        .addText(text => {
          text.inputEl.setAttribute("aria-label", "Graph label for " + folder.path);
          text.setValue(config.draft.graph.folderLabels[folder.path] ?? "").setPlaceholder(folder.name).onChange(value => config.edit(d => {
            if (value.trim()) d.graph.folderLabels[folder.path] = value.trim(); else delete d.graph.folderLabels[folder.path];
          }));
        })
        .addToggle(toggle => toggle.setValue(!config.draft.graph.hiddenFolderPaths.includes(folder.path)).onChange(visible => config.edit(d => {
          d.graph.hiddenFolderPaths = d.graph.hiddenFolderPaths.filter(p => p !== folder.path);
          if (!visible) d.graph.hiddenFolderPaths.push(folder.path);
        })));
    }
  } catch(error) { status(el, message(error)); }
}
