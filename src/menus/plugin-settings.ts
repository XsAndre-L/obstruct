import { Plugin } from "obsidian";

interface MyPluginSettings {
	mySetting: string;
}
const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: "default",
};

export class PluginSettings extends Plugin {
	settings: MyPluginSettings;

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
