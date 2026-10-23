import { Modal } from "obsidian";

export class WorkspaceHelp extends Modal {
  onOpen(): void {
    this.titleEl.setText("About this workspace");
    this.titleEl.addClass("obstruct-dialog-title");
    this.contentEl.addClass("obstruct-dialog");
    this.contentEl.createEl("p", {
      text: "Browse your main Notes folder and any added Resources. Expand a folder, then select a file to open it.",
    });
    this.contentEl.createEl("p", {
      text: "Vault files open in Obsidian. Supported files outside the vault open in a read-only preview.",
    });
    this.contentEl.createEl("p", {
      text: "Use the cog to choose folders and ignore rules. Use the circular arrow to check availability and refresh the tree.",
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}