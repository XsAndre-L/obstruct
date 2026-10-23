import * as fs from "node:fs/promises";
import path from "node:path";
import { ResourceConfig, WorkspaceConfig } from "../../shared/config/model";
import { identity, resolveNotes, resolveResource, slash, within } from "../../shared/paths/resolver";
import { explain, validatePattern } from "../../shared/filtering/ignore";
import { IoQueue } from "./io-queue";
export interface Root { id: string; label: string; absolute: string; ignore: string[]; enabled: boolean }
export interface Availability { status: "Available" | "Missing" | "Unreadable" | "Unsupported" | "Disabled"; detail: string; kind?: "file" | "folder"; canonical?: string }
export interface Entry { name: string; absolute: string; kind: "file" | "folder" | "link" }
export class ResourceService {
  private io = new IoQueue();
  constructor(readonly vaultRoot: string) {}
  roots(config: WorkspaceConfig): Root[] {
    return [{ id: "notes", label: "Notes", absolute: resolveNotes(this.vaultRoot, config.mainNotesPath), ignore: [], enabled: true },
      ...config.resources.map(r => this.root(r))];
  }
  root(resource: ResourceConfig): Root { return { id: resource.id, label: resource.label, absolute: resolveResource(this.vaultRoot, resource.path), ignore: resource.ignore, enabled: resource.enabled }; }
  async inspect(absolute: string): Promise<Availability> {
    try {
      return await this.io.run(async () => {
        await this.noLinks(absolute);
        const info = await fs.stat(absolute);
        if (!info.isFile() && !info.isDirectory()) return { status: "Unsupported", detail: "Only files and folders are supported." };
        await fs.access(absolute, fs.constants.R_OK);
        return { status: "Available", detail: "Found and readable", kind: info.isDirectory() ? "folder" : "file", canonical: identity(await fs.realpath(absolute)) };
      });
    } catch (e) {
      const error = e as NodeJS.ErrnoException;
      return { status: error.code === "ENOENT" || error.code === "ENOTDIR" ? "Missing" : error.code === "OBSTRUCT_LINK" ? "Unsupported" : "Unreadable", detail: error.message };
    }
  }
  check(root: Root): Promise<Availability> { return root.enabled ? this.inspect(root.absolute) : Promise.resolve({ status: "Disabled", detail: "Enable this resource to check it." }); }
  private async noLinks(absolute: string): Promise<void> {
    const parsed = path.parse(absolute);
    let current = parsed.root;
    for (const part of absolute.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
      current = path.join(current, part);
      if ((await fs.lstat(current)).isSymbolicLink()) {
        const error: NodeJS.ErrnoException = new Error("Linked folders and files are skipped. Assign the real target instead.");
        error.code = "OBSTRUCT_LINK"; throw error;
      }
    }
  }
  relative(root: Root, target: string, singleFile = false): string {
    return singleFile ? path.basename(target) : slash(path.relative(root.absolute, target));
  }
  async list(root: Root, absolute: string, config: WorkspaceConfig): Promise<Entry[]> {
    if (!root.enabled || !within(root.absolute, absolute)) throw new Error("Folder is outside this resource.");
    const available = await this.check(root);
    if (available.status !== "Available") throw new Error(available.status + ": " + available.detail);
    if (explain(this.relative(root, absolute), config.ignore, root.ignore).length) return [];
    const entries = await this.browse(absolute);
    return entries.filter(e => !explain(this.relative(root, e.absolute), config.ignore, root.ignore).length);
  }
  async browse(absolute: string): Promise<Entry[]> {
    return this.io.run(async () => {
      await this.noLinks(absolute);
      const entries = await fs.readdir(absolute, { withFileTypes: true });
      return entries.map(e => ({ name: e.name, absolute: path.join(absolute, e.name),
        kind: e.isSymbolicLink() ? "link" as const : e.isDirectory() ? "folder" as const : "file" as const }))
        .sort((a,b) => Number(b.kind === "folder") - Number(a.kind === "folder") || a.name.localeCompare(b.name));
    });
  }
  async allowed(target: string, config: WorkspaceConfig): Promise<Root | null> {
    if (!config.enabled) return null;
    for (const root of this.roots(config).filter(r => r.enabled && within(r.absolute, target))) {
      const state = await this.check(root);
      if (state.status !== "Available") continue;
      const relative = this.relative(root, target, state.kind === "file");
      if (!explain(relative, config.ignore, root.ignore).length && (await this.inspect(target)).status === "Available") return root;
    }
    return null;
  }
  async read(target: string, maximum: number): Promise<Uint8Array> {
    return this.io.run(async () => {
      await this.noLinks(target);
      const handle = await fs.open(target, "r");
      try {
        const stat = await handle.stat();
        if (!stat.isFile() || stat.size > maximum) throw new Error("File is too large or unsupported. Open it externally.");
        const buffer = Buffer.alloc(maximum + 1);
        let offset = 0;
        while (offset < buffer.length) {
          const result = await handle.read(buffer, offset, buffer.length - offset, null);
          if (!result.bytesRead) break;
          offset += result.bytesRead;
        }
        if (offset > maximum) throw new Error("File grew beyond the preview limit. Open it externally.");
        return new Uint8Array(buffer.subarray(0, offset));
      } finally { await handle.close(); }
    });
  }
  async validate(config: WorkspaceConfig): Promise<void> {
    config.ignore.forEach(validatePattern);
    const roots = this.roots(config);
    const ids = new Set<string>(); const seen = new Set<string>();
    for (const resource of config.resources) {
      if (!resource.label.trim()) throw new Error("Resources: every resource needs a name.");
      if (!resource.id || resource.id === "notes" || ids.has(resource.id)) throw new Error("Resources: duplicate resource identifier.");
      ids.add(resource.id); resource.ignore.forEach(validatePattern);
    }
    for (const root of roots) {
      const state = root.enabled ? await this.check(root) : undefined;
      if (root.id === "notes") {
        if (config.enabled && (state?.status !== "Available" || state.kind !== "folder")) throw new Error("Workspace: the main notes folder must exist and be readable.");
        seen.add(state?.canonical ?? identity(root.absolute));
        continue;
      }
      if (state?.status === "Unsupported") throw new Error("Resources: " + root.label + ": " + state.detail);
      const key = state?.canonical ?? identity(root.absolute);
      if (seen.has(key)) throw new Error("Resources: the same location is assigned more than once.");
      seen.add(key);
    }
  }
  dispose(): void { this.io.dispose(); }
}
