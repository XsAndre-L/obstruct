import { ItemView, WorkspaceLeaf } from "obsidian";
import path from "node:path";
import { renderMarkdown } from "./markdown";

import { ConfigController } from "../../shared/config/controller";
import { ResourceService } from "../resources/service";
import { explain } from "../../shared/filtering/ignore";
import { within } from "../../shared/paths/resolver";
import { button, message, status } from "../../shared/ui/elements";
import { openLocal, openWeb } from "../workspace/platform";
import { imageTypes, textExtensions, resolveLink, TEXT_LIMIT, IMAGE_LIMIT } from "./links";
export const PREVIEW_TYPE = "obstruct-preview";

export class ResourcePreview extends ItemView {
  private file = ""; private rootId = ""; private epoch = 0; private urls: string[] = [];
  private requests: AbortController[] = []; private unsubscribe?: () => void;
  constructor(leaf: WorkspaceLeaf, private config: ConfigController, private service: ResourceService,
    private openFile: (absolute: string) => Promise<void>) { super(leaf); }
  getViewType(): string { return PREVIEW_TYPE; }
  getDisplayText(): string { return this.file ? path.basename(this.file) + " (read-only)" : "Resource preview"; }
  getIcon(): string { return "file-search"; }
  getState(): Record<string, unknown> { return { file: this.file, rootId: this.rootId }; }
  async setState(state: Record<string, unknown>): Promise<void> {
    this.file = typeof state.file === "string" ? state.file : "";
    this.rootId = typeof state.rootId === "string" ? state.rootId : "";
    await this.render();
  }
  async onOpen(): Promise<void> {
    this.unsubscribe = this.config.subscribe(change => { if (change === "active") void this.render(); });
    await this.render();
  }
  private cleanup(): void {
    this.epoch++; for (const url of this.urls) URL.revokeObjectURL(url); this.urls = [];
    for (const request of this.requests) request.abort(); this.requests = [];
  }
  private async permitted(): Promise<boolean> {
    if (!this.config.active.enabled) return false;
    const root = this.service.roots(this.config.active).find(r => r.id === this.rootId && r.enabled);
    if (!root || !within(root.absolute, this.file)) return false;
    const state = await this.service.check(root);
    return state.status === "Available" && !explain(this.service.relative(root, this.file, state.kind === "file"), this.config.active.ignore, root.ignore).length;
  }
  private async render(): Promise<void> {
    this.cleanup(); const epoch = this.epoch; const el = this.contentEl; el.empty(); el.addClass("obstruct-preview");
    if (!this.file) { status(el, "Select a resource file to preview."); return; }
    el.createEl("h3", { text: path.basename(this.file) }); status(el, this.file + " · Read-only");
    const feedback = status(el, "Checking access…");
    try {
      if (!await this.permitted()) { if (epoch === this.epoch) feedback.setText("This resource is disabled, removed, excluded or unavailable."); return; }
      if (epoch !== this.epoch) return;
      const state = await this.service.inspect(this.file); if (epoch !== this.epoch) return;
      if (state.status !== "Available") { feedback.setText(state.status + ": " + state.detail); button(el, "Retry", () => this.render()); return; }
      button(el, "Open in default app", async () => {
        if (!await this.permitted()) throw new Error("Resource access changed.");
        const state = await this.service.inspect(this.file); if (state.status !== "Available") throw new Error(state.detail);
        await openLocal(this.file);
      });
      const ext = path.extname(this.file).toLowerCase();
      if (imageTypes[ext]) {
        const bytes = await this.service.read(this.file, IMAGE_LIMIT); if (epoch !== this.epoch) return;
        this.image(el, bytes, imageTypes[ext], path.basename(this.file)); feedback.setText(""); return;
      }
      if (!textExtensions.has(ext)) { feedback.setText("This format has no built-in preview. Open it externally."); return; }
      const bytes = await this.service.read(this.file, TEXT_LIMIT); if (epoch !== this.epoch) return;
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      if (ext !== ".md" && ext !== ".markdown") { el.createEl("pre", { text }); feedback.setText(""); return; }
      const sanitized = renderMarkdown(text, el.ownerDocument.defaultView!);
      const template = el.ownerDocument.createElement("template"); template.innerHTML = sanitized;
      for (const img of Array.from(template.content.querySelectorAll("img"))) {
        const href = img.getAttribute("src") ?? ""; const alt = img.getAttribute("alt") ?? "Image";
        const replacement = el.ownerDocument.createElement("span"); img.replaceWith(replacement);
        const target = resolveLink(this.file, href);
        if (target.kind === "blocked") { replacement.textContent = alt + " (unsupported image link)"; continue; }
        if (target.kind === "web") {
          button(replacement, "Load image: " + alt, async () => {
            const request = new AbortController(); this.requests.push(request);
            const timer = setTimeout(() => request.abort(), 5000);
            try {
              const response = await fetch(target.url, { signal: request.signal, credentials: "omit", redirect: "error", referrerPolicy: "no-referrer" });
              const mime = response.headers.get("content-type")?.split(";")[0].trim() ?? "";
              if (!response.ok || !Object.values(imageTypes).includes(mime)) throw new Error("Unsupported image response.");
              const reader = response.body?.getReader(); if (!reader) throw new Error("Image is unavailable.");
              const chunks: Uint8Array[] = []; let size = 0;
              while (true) {
                const next = await reader.read(); if (next.done) break;
                size += next.value.length; if (size > IMAGE_LIMIT) { await reader.cancel(); throw new Error("Image exceeds 10 MiB."); }
                chunks.push(next.value);
              }
              if (epoch !== this.epoch) return;
              const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
              replacement.empty(); this.image(replacement, bytes, mime, alt);
            } finally { clearTimeout(timer); }
          });
        } else {
          void (async () => {
            try {
              if (!await this.service.allowed(target.absolute, this.config.active)) {
                if (epoch === this.epoch) button(replacement, "Open image externally: " + alt, () => this.openExternal(target.absolute, epoch)); return;
              }
              const mime = imageTypes[path.extname(target.absolute).toLowerCase()];
              if (!mime) { if (epoch === this.epoch) replacement.setText(alt + " (unsupported format)"); return; }
              const bytes = await this.service.read(target.absolute, IMAGE_LIMIT);
              if (epoch === this.epoch) this.image(replacement, bytes, mime, alt);
            } catch(e) { if (epoch === this.epoch) replacement.setText(alt + ": " + message(e)); }
          })();
        }
      }
      for (const anchor of Array.from(template.content.querySelectorAll("a"))) {
        const target = resolveLink(this.file, anchor.getAttribute("href") ?? "");
        anchor.removeAttribute("href"); anchor.setAttribute("role", "button"); anchor.tabIndex = 0;
        const activate = async () => {
          if (epoch !== this.epoch) return;
          if (target.kind === "web") await openWeb(target.url);
          else if (target.kind === "local") {
            if (await this.service.allowed(target.absolute, this.config.active)) await this.openFile(target.absolute);
            else {
              status(el, "This file is outside the enabled resources or excluded.");
              button(el, "Open linked file externally", async () => {
                const state = await this.service.inspect(target.absolute);
                if (state.status !== "Available") throw new Error(state.detail);
                await openLocal(target.absolute);
              });
            }
          } else status(el, "This link type is not supported.");
        };
        anchor.addEventListener("click", () => void activate().catch(e => status(el, message(e))));
        anchor.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); void activate().catch(error => status(el, message(error))); } });
      }
      el.appendChild(template.content); feedback.setText("");
    } catch(e) { if (epoch === this.epoch) feedback.setText(message(e)); }
  }
  private async openExternal(absolute: string, epoch: number): Promise<void> {
    const state = await this.service.inspect(absolute);
    if (epoch !== this.epoch) return;
    if (state.status !== "Available") throw new Error(state.detail);
    await openLocal(absolute);
  }
  private image(parent: HTMLElement, bytes: Uint8Array, mime: string, alt: string): void {
    const url = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: mime }));
    this.urls.push(url); parent.createEl("img", { attr: { src: url, alt } });
  }
  async onClose(): Promise<void> { this.unsubscribe?.(); this.cleanup(); this.contentEl.empty(); }
}
