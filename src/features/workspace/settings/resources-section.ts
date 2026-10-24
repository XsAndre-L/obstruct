import { Setting } from "obsidian";
import { ResourceConfig } from "../../../shared/config/model";
import { within } from "../../../shared/paths/resolver";
import { button, message, status } from "../../../shared/ui/elements";
import { ResourceDialog } from "./resource-dialog";
import { SectionContext } from "./section-context";

export function renderResources(context: SectionContext, el: HTMLElement, epoch: number): void {
  const edit = (resource: ResourceConfig | null) => new ResourceDialog(context.app, context.service, resource, updated => {
    context.config.edit(d => { const index = d.resources.findIndex(r => r.id === updated.id); if (index < 0) d.resources.push(updated); else d.resources[index] = updated; });
    context.render();
  }).open();
  const toolbar = el.createDiv({ cls: "obstruct-toolbar" });
  button(toolbar, "Add resource", () => edit(null)); const checks: (() => Promise<void>)[] = [];
  button(toolbar, "Recheck all", async () => { await Promise.all(checks.map(check => check())); });
  if (!context.config.draft.resources.length) el.createEl("p", { text: "Add folders or files to access alongside your notes." });
  context.config.draft.resources.forEach((resource, index) => {
    const row = el.createDiv({ cls: "obstruct-resource" });
    new Setting(row).setName(resource.label).setDesc(resource.path).addToggle(t => t.setValue(resource.enabled).onChange(value => {
      context.config.edit(d => { d.resources[index].enabled = value; }); void check();
    }));
    const feedback = status(row); let generation = 0;
    const check = async () => {
      const id = ++generation; feedback.setText("Checking…");
      try {
        const root = context.service.root(context.config.draft.resources[index]);
        const state = await context.service.check(root);
        if (epoch === context.epoch && id === generation) feedback.setText(state.status + " · " + (within(context.service.vaultRoot, root.absolute) ? "Inside vault" : "Outside vault") + " · " + root.absolute + " · " + state.detail);
      } catch (e) { if (epoch === context.epoch && id === generation) feedback.setText(message(e)); }
    };
    checks.push(check); void check();
    const actions = row.createDiv({ cls: "obstruct-toolbar" });
    button(actions, "Edit", () => edit(resource)); button(actions, "Recheck", check);
    for (const [label, delta] of [["Move up", -1], ["Move down", 1]] as const) {
      button(actions, label, () => { context.config.edit(d => { const [item] = d.resources.splice(index, 1); d.resources.splice(index + delta, 0, item); }); context.render(); }).disabled = index + delta < 0 || index + delta >= context.config.draft.resources.length;
    }
    button(actions, "Remove", () => {
      context.removed.push({ resource, index }); context.config.edit(d => { d.resources.splice(index, 1); }); context.render();
      context.containerEl.querySelector<HTMLElement>('[role="tabpanel"] button')?.focus();
    });
  });
  if (context.removed.length) button(el, "Undo removal", () => { const item = context.removed.pop()!; context.config.edit(d => d.resources.splice(item.index, 0, item.resource)); context.render(); });
}
