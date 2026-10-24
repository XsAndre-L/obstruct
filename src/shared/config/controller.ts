import { GraphConfig } from "./graph";
import { clone, migrate, WorkspaceConfig } from "./model";
export type Change = "draft" | "busy" | "active" | "discard";
export class ConfigController {
  active: WorkspaceConfig; draft: WorkspaceConfig; busy = false;
  private disposed = false;
  private listeners = new Set<(change: Change) => void>();
  constructor(data: unknown, private persist: (config: WorkspaceConfig) => Promise<void>,
    private validate: (config: WorkspaceConfig) => Promise<void>) {
    this.active = migrate(data); this.draft = clone(this.active);
  }
  get dirty(): boolean { return JSON.stringify(this.active) !== JSON.stringify(this.draft); }
  subscribe(fn: (change: Change) => void): () => void { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  private emit(change: Change): void { if (!this.disposed) for (const fn of this.listeners) { try { fn(change); } catch (e) { console.error("Obstruct view update", e); } } }
  edit(fn: (draft: WorkspaceConfig) => void): void { if (this.busy || this.disposed) return; fn(this.draft); this.emit("draft"); }
  discard(): void { if (this.busy) return; this.draft = clone(this.active); this.emit("discard"); }
  async apply(): Promise<void> {
    if (this.busy || this.disposed) throw new Error("A save is already running.");
    this.busy = true; this.emit("busy");
    const candidate = clone(this.draft);
    try {
      await this.validate(candidate);
      if (this.disposed) return;
      await this.persist(candidate);
      if (this.disposed) return;
      this.active = candidate; this.draft = clone(candidate); this.emit("active");
    } finally { this.busy = false; this.emit("busy"); }
  }
  async toggle(): Promise<void> {
    if (this.busy || this.disposed) throw new Error("Finish the current save first.");
    this.busy = true; this.emit("busy");
    const candidate = clone(this.active); candidate.enabled = !candidate.enabled;
    try {
      await this.persist(candidate);
      if (this.disposed) return;
      this.active = candidate; this.draft.enabled = candidate.enabled; this.emit("active");
    } finally { this.busy = false; this.emit("busy"); }
  }
  async updateGraph(update: (graph: GraphConfig) => void): Promise<void> {
    if (this.busy || this.disposed) throw new Error("Finish the current save first.");
    this.busy = true; this.emit("busy");
    const candidate = clone(this.active);
    const pending = clone(this.draft.graph);
    update(candidate.graph); update(pending);
    try {
      await this.persist(candidate);
      if (this.disposed) return;
      this.active = candidate; this.draft.graph = pending; this.emit("active");
    } finally { this.busy = false; this.emit("busy"); }
  }
  dispose(): void { this.disposed = true; this.listeners.clear(); this.draft = clone(this.active); }
}
