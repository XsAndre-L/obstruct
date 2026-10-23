import { FocusSettings, isVisible } from "./focus-settings";

const hiddenClass = "obstruct-hidden";
const nameSelectors = ".workspace-drawer-vault-name, .workspace-drawer-header-name, .nav-folder.mod-root > .nav-folder-title .nav-folder-title-content";

/** UI-only adapter. No changes to Vault, files, indexing, or Obsidian settings. */
export class FocusPresentation {
  private renamed = new Map<Element, { original: string; applied: string }>();
  private title: { original: string; applied: string } | null = null;

  constructor(private doc: Document, private vaultName: string) {}

  apply(settings: FocusSettings, folderExists: boolean): void {
    this.restoreNames();
    this.doc.querySelectorAll("." + hiddenClass).forEach(el => el.classList.remove(hiddenClass));
    if (!settings.enabled) return;

    if (settings.displayName) {
      this.doc.querySelectorAll(nameSelectors).forEach(el => {
        // Only replace leaf labels; never destroy nested UI controls.
        if (el.children.length || el.textContent?.trim() !== this.vaultName) return;
        this.renamed.set(el, { original: el.textContent ?? "", applied: settings.displayName });
        el.textContent = settings.displayName;
      });
      const original = this.doc.title;
      const marker = " - " + this.vaultName;
      const markerIndex = original.lastIndexOf(marker);
      const tail = original.slice(markerIndex + marker.length);
      const suffix = marker + " - Obsidian";
      const shortSuffix = " - " + this.vaultName;
      let applied = original;
      if (original === this.vaultName) applied = settings.displayName;
      else if (markerIndex >= 0 && /^ - Obsidian v[0-9.]+$/.test(tail)) applied = original.slice(0, markerIndex) + " - " + settings.displayName + tail;
      else if (original.endsWith(suffix)) applied = original.slice(0, -suffix.length) + " - " + settings.displayName + " - Obsidian";
      else if (original.endsWith(shortSuffix)) applied = original.slice(0, -shortSuffix.length) + " - " + settings.displayName;
      if (applied !== original) {
        this.title = { original, applied };
        this.doc.title = applied;
      }
    }

    // Missing folders fail open so the user can recover using the explorer.
    if (!settings.visibleFolder || !folderExists) return;
    this.doc.querySelectorAll('[data-type="file-explorer"] .nav-file-title[data-path], [data-type="file-explorer"] .nav-folder-title[data-path]').forEach(el => {
      const path = el.getAttribute("data-path") ?? "";
      if (!isVisible(path, settings.visibleFolder)) {
        const row = el.parentElement;
        if (row?.matches(".nav-file, .nav-folder")) row.classList.add(hiddenClass);
      }
    });
  }

  private restoreNames(): void {
    this.renamed.forEach((value, el) => {
      if (el.textContent === value.applied) el.textContent = value.original;
    });
    this.renamed.clear();
    if (this.title && this.doc.title === this.title.applied) this.doc.title = this.title.original;
    this.title = null;
  }

  dispose(): void {
    this.restoreNames();
    this.doc.querySelectorAll("." + hiddenClass).forEach(el => el.classList.remove(hiddenClass));
  }
}
