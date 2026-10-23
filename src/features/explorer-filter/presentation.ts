/** Only the native file explorer is affected; files and Obsidian's index stay intact. */
export class ExplorerFilter {
  private observer: MutationObserver;
  private hidden = new Set<Element>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private stopped = false;

  constructor(private doc: Document, private visible: (path: string, folder: boolean) => boolean) {
    this.observer = new doc.defaultView!.MutationObserver(() => this.schedule());
    this.observer.observe(doc.body, {
      childList: true, subtree: true, attributes: true, attributeFilter: ["data-path"],
    });
    this.refresh();
  }

  schedule(): void {
    if (this.stopped || this.timer !== undefined) return;
    this.timer = setTimeout(() => { this.timer = undefined; this.refresh(); }, 30);
  }

  refresh(): void {
    if (this.stopped) return;
    for (const element of this.hidden) {
      if (!element.isConnected) { element.classList.remove("obstruct-explorer-hidden"); this.hidden.delete(element); }
    }
    for (const title of Array.from(this.doc.querySelectorAll(
      '[data-type="file-explorer"] .nav-folder-title[data-path], [data-type="file-explorer"] .nav-file-title[data-path]',
    ))) {
      const path = title.getAttribute("data-path") ?? "";
      const row = title.parentElement;
      if (!row || !path || path === "/") continue;
      let show = true;
      try { show = this.visible(path, title.classList.contains("nav-folder-title")); }
      catch { /* Invalid configuration must not strand the user without an explorer. */ }
      row.classList.toggle("obstruct-explorer-hidden", !show);
      if (show) this.hidden.delete(row); else this.hidden.add(row);
    }
  }

  dispose(): void {
    this.stopped = true;
    clearTimeout(this.timer);
    this.observer.disconnect();
    for (const element of this.hidden) element.classList.remove("obstruct-explorer-hidden");
    this.hidden.clear();
  }
}
