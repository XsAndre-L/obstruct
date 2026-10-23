export class DisplayName {
  private labels = new Map<Element, { old: string; applied: string }>();
  private title: { old: string; applied: string } | null = null;
  private observer: MutationObserver; private timer: ReturnType<typeof setTimeout> | undefined; private stopped = false;
  private name = ""; private enabled = false;
  constructor(private doc: Document, private actual: string) {
    this.observer = new MutationObserver(() => {
      if (this.timer !== undefined || this.stopped) return;
      this.timer = setTimeout(() => { this.timer = undefined; if (!this.stopped) this.paint(); }, 50);
    });
  }
  update(name: string, enabled: boolean): void { this.observer.disconnect(); this.restore(); this.name = name.trim(); this.enabled = enabled; this.paint(); }
  private restore(): void {
    for (const [el, value] of this.labels) if (el.textContent === value.applied) el.textContent = value.old;
    this.labels.clear();
    if (this.title && this.doc.title === this.title.applied) this.doc.title = this.title.old;
    this.title = null;
  }
  private paint(): void {
    this.observer.disconnect();
    if (this.enabled && this.name && this.name !== this.actual) {
      for (const el of Array.from(this.doc.querySelectorAll(".workspace-drawer-vault-name, .workspace-drawer-header-name, .nav-folder.mod-root > .nav-folder-title .nav-folder-title-content"))) {
        if (!el.children.length && el.textContent?.trim() === this.actual) {
          this.labels.set(el, { old: el.textContent, applied: this.name }); el.textContent = this.name;
        }
      }
      const old = this.doc.title; const marker = " - " + this.actual; const index = old.lastIndexOf(marker);
      const tail = old.slice(index + marker.length);
      const applied = old === this.actual ? this.name : index >= 0 && /^(?: - Obsidian(?: v?[0-9.]+)?)?$/.test(tail) ? old.slice(0,index) + " - " + this.name + tail : old;
      if (old !== applied) { this.title = { old, applied }; this.doc.title = applied; }
    }
    this.observer.observe(this.doc.body, { childList: true, subtree: true, characterData: true });
    const title = this.doc.querySelector("title"); if (title) this.observer.observe(title, { childList: true, subtree: true, characterData: true });
  }
  dispose(): void { this.stopped = true; clearTimeout(this.timer); this.observer.disconnect(); this.restore(); }
}
