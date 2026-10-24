import { explain, lines, validatePattern } from "../../../shared/filtering/ignore";
import { button, message, status } from "../../../shared/ui/elements";
import { SectionContext } from "./section-context";

export function renderIgnore(context: SectionContext, el: HTMLElement): void {
  el.createEl("p", { text: "These rules filter Obstruct browsing and the native file explorer. They do not stop Obsidian indexing files or change native search and graph results." });
  el.createEl("p", { text: "One rule per line, relative to Notes and each resource root. Supports *, ** and ?. Exclusions win; matching folders exclude descendants." });
  const input = el.createEl("textarea", { attr: { rows: "6", "aria-label": "Global ignore rules" } }); input.value = context.config.draft.ignore.join("\n");
  const feedback = status(el);
  input.addEventListener("input", () => {
    context.config.edit(d => { d.ignore = lines(input.value); });
    try { context.config.draft.ignore.forEach(validatePattern); feedback.setText(""); } catch(e) { feedback.setText(message(e)); }
  });
  const presets = el.createDiv({ cls: "obstruct-toolbar" });
  button(presets, "Add dependency preset", () => { context.config.edit(d => { d.ignore = [...new Set([...d.ignore, "**/node_modules/**"])]; }); context.render(); });
  button(presets, "Add build-output preset", () => { context.config.edit(d => { d.ignore = [...new Set([...d.ignore, "**/dist/**", "**/build/**"])]; }); context.render(); });
  el.createEl("h3", { text: "Test a path" });
  const tester = el.createDiv({ cls: "obstruct-rule-tester" });
  const select = tester.createEl("select", { attr: { "aria-label": "Rule test root" } });
  select.createEl("option", { text: "Notes", value: "notes" });
  for (const r of context.config.draft.resources) select.createEl("option", { text: r.label, value: r.id });
  const test = tester.createEl("input", { attr: { type: "text", "aria-label": "Path relative to selected root", placeholder: "nested/node_modules/package/index.js" } });
  const result = status(el);
  const evaluate = () => {
    try {
      const matches = explain(test.value, context.config.draft.ignore, context.config.draft.resources.find(r => r.id === select.value)?.ignore ?? []);
      result.setText(test.value + ": " + (matches.length ? "Excluded — " + matches.map(m => m.source + ": " + m.pattern).join("; ") : "Visible"));
    } catch(e) { result.setText(message(e)); }
  }; test.addEventListener("input", evaluate); select.addEventListener("change", evaluate);
}