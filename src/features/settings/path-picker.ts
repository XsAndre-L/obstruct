import { App, Modal } from "obsidian";
import path from "node:path";
import { ResourceService } from "../resources/service";
import { button, message, status } from "../../shared/ui/elements";
import { resolveResource } from "../../shared/paths/resolver";
export class PathPicker extends Modal {
  private epoch = 0;
  constructor(app: App, private service: ResourceService, private current: string,
    private foldersOnly: boolean, private selected: (absolute: string) => void) { super(app); }
  onOpen(): void { this.titleEl.setText(this.foldersOnly ? "Choose a folder" : "Choose a file or folder"); void this.render(); }
  private async render(): Promise<void> {
    const epoch = ++this.epoch; const el = this.contentEl; el.empty();
    const location = el.createEl("input", { attr: { type: "text", "aria-label": "Location" }, value: this.current });
    const navigate = () => { try { this.current = resolveResource(this.service.vaultRoot, location.value); void this.render(); } catch (e) { feedback.setText(message(e)); } };
    button(el, "Go", navigate); location.addEventListener("keydown", e => { if (e.key === "Enter") navigate(); });
    button(el, "Up", () => { this.current = path.dirname(this.current); void this.render(); });
    const choose = button(el, "Choose this folder", () => { this.selected(this.current); this.close(); }); choose.disabled = true;
    const feedback = status(el, "Checking…"); const list = el.createDiv({ cls: "obstruct-picker-list" });
    try {
      const state = await this.service.inspect(this.current); if (epoch !== this.epoch) return;
      if (state.status !== "Available" || state.kind !== "folder") { feedback.setText(state.detail); return; }
      choose.disabled = false;
      const entries = await this.service.browse(this.current); if (epoch !== this.epoch) return;
      feedback.setText(entries.length + " entries");
      let offset = 0;
      const more = button(el, "Show more", () => draw());
      const draw = () => {
        for (const entry of entries.slice(offset, offset + 200)) {
          const row = list.createDiv();
          const action = button(row, (entry.kind === "folder" ? "Folder: " : "") + entry.name, () => {
            if (entry.kind === "folder") { this.current = entry.absolute; void this.render(); }
            else { this.selected(entry.absolute); this.close(); }
          });
          action.disabled = entry.kind === "link" || (this.foldersOnly && entry.kind !== "folder");
          if (entry.kind === "link") row.createSpan({ text: " — linked entry skipped" });
        }
        offset += 200; more.hidden = offset >= entries.length;
      }; draw();
    } catch (e) { if (epoch === this.epoch) feedback.setText(message(e)); }
  }
  onClose(): void { this.epoch++; this.contentEl.empty(); }
}
