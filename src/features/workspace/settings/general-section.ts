import { Setting } from "obsidian";
import { resolveNotes, storedPath } from "../../../shared/paths/resolver";
import { message, status } from "../../../shared/ui/elements";
import { PathPicker } from "./path-picker";
import { SectionContext } from "./section-context";

export function renderGeneral(context: SectionContext, el: HTMLElement, epoch: number): void {
  new Setting(el).setName("Actual vault location").setDesc(context.service.vaultRoot).addButton(b => b.setButtonText("Copy path").onClick(() => navigator.clipboard.writeText(context.service.vaultRoot)));

  new Setting(el).setName("Display name").setDesc("Blank uses the real vault name.").addText(t =>
    t.setValue(context.config.draft.displayName).setPlaceholder("Display name").onChange(v => { context.config.edit(d => { d.displayName = v; }); tree(); }));
  let input: HTMLInputElement;
  new Setting(el).setName("Main notes folder").setDesc("Folder inside this vault; . uses the vault root.").addText(t => {
    input = t.inputEl; input.setAttribute("aria-label", "Main notes folder"); t.setValue(context.config.draft.mainNotesPath).onChange(v => { context.config.edit(d => { d.mainNotesPath = v; }); void check(); });
  }).addButton(b => b.setButtonText("Browse").onClick(() => new PathPicker(context.app, context.service, context.service.vaultRoot, true, absolute => {
    context.config.edit(d => { d.mainNotesPath = storedPath(context.service.vaultRoot, absolute); }); input.value = context.config.draft.mainNotesPath; void check();
  }).open()));
  const feedback = status(el); let checkId = 0;
  const check = async () => {
    const id = ++checkId;
    try {
      const absolute = resolveNotes(context.service.vaultRoot, context.config.draft.mainNotesPath);
      feedback.setText(absolute + " · Checking…");
      const state = await context.service.inspect(absolute);
      if (epoch === context.epoch && id === checkId) feedback.setText(absolute + " · " + state.status + (state.kind === "file" ? " — choose a folder" : "") + " · " + state.detail);
    } catch (e) { if (epoch === context.epoch && id === checkId) feedback.setText(message(e)); }
  };
  el.createEl("h3", { text: "Workspace preview" });
  const preview = el.createEl("pre");
  const tree = () => { preview.setText((context.config.draft.displayName || context.app.vault.getName()) + "\n  Notes\n  Resources" + context.config.draft.resources.filter(r => r.enabled).map(r => "\n    " + r.label).join("")); };
  tree(); void check();

}
