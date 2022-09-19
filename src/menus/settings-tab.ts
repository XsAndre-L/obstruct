import { App, PluginSettingTab, Setting } from "obsidian";
import { PluginSettings } from "./plugin-settings";

export class SettingsTab extends PluginSettingTab {
	pluginSettings: PluginSettings;

	constructor(app: App, pluginSettings: PluginSettings) {
		super(app, pluginSettings);
		this.pluginSettings = pluginSettings;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl("h2", { text: "Settings for my awesome plugin." });

		new Setting(containerEl)
			.setName("Setting #1")
			.setDesc("It's a secret")
			.addText((text) =>
				text
					.setPlaceholder("Enter your secret")
					.setValue(this.pluginSettings.settings.mySetting)
					.onChange(async (value) => {
						console.log("Secret: " + value);
						this.pluginSettings.settings.mySetting = value;
						await this.pluginSettings.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Custom Setting")
			.setDesc("randm")
			.addText((text) =>
				text
					.setPlaceholder("Enter your secret")
					.setValue(this.pluginSettings.settings.mySetting)
					.onChange(async (value) => {
						console.log("Secret: " + value);
						this.pluginSettings.settings.mySetting = value;
						await this.pluginSettings.saveSettings();
					})
			)
			.addText((text) =>
				text
					.setPlaceholder("Enter your secret")
					.setValue(this.pluginSettings.settings.mySetting)
					.onChange(async (value) => {
						console.log("Secret: " + value);
						this.pluginSettings.settings.mySetting = value;
						await this.pluginSettings.saveSettings();
					})
			);
	}
}
