import { clone } from "../../../shared/config/model";
import { ConfigController } from "../../../shared/config/controller";
import { ResourceService } from "../../resources/service";
import { button, message, status } from "../../../shared/ui/elements";

/** One action bar for the whole pending configuration. */
export class DraftActions {
  private footer?: HTMLElement;
  private apply?: HTMLButtonElement;
  private validationError = "";
  private validating = false;
  private validationId = 0;
  private validationTimer: ReturnType<typeof setTimeout> | undefined;
  constructor(private config: ConfigController, private service: ResourceService) {}
  render(container: HTMLElement): void {
    const bar = container.createDiv({ cls: "obstruct-actions" });
    this.footer = status(bar);
    button(bar, "Discard changes", () => this.config.discard()).disabled = this.config.busy;
    this.apply = button(bar, "Apply changes", async () => {
      try { await this.config.apply(); }
      catch (error) { this.validationError = message(error); this.updateFooter(); }
    });
    this.apply.addClass("mod-cta");
    this.validateDraft();
  }
  dispose(): void {
    this.validationId++;
    clearTimeout(this.validationTimer);
    this.footer = undefined;
    this.apply = undefined;
  }
  private updateFooter(): void {
    if (this.footer) this.footer.setText(this.config.busy ? "Saving…" : this.validating ? "Checking configuration…" : this.validationError || (this.config.dirty ? "Unsaved changes" : "All changes saved"));
    if (this.apply) this.apply.disabled = this.config.busy || this.validating || !!this.validationError || !this.config.dirty;
  }
  validateDraft(): void {
    const id = ++this.validationId;
    clearTimeout(this.validationTimer); this.validating = true; this.updateFooter();
    const snapshot = clone(this.config.draft);
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
}
