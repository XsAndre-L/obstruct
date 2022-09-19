import { App, Modal } from "obsidian";

export class ObsModalMenu extends Modal {
	menuHtml: string;

	constructor(app: App, menuHtml: string) {
		super(app);
		this.menuHtml = menuHtml;
	}

	async onOpen() {
		const { titleEl } = this;
		titleEl.setText("Obstruct Commands");

		const { contentEl } = this;

		contentEl.innerHTML = `${this.menuHtml}`;
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
