import { Plugin, Notice } from "obsidian";

export class ObstructSideBar extends Plugin {
	addRibbon() {
		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon(
			"dice",
			"Obstruct",
			(evt: MouseEvent) => {
				// Called when the user clicks the icon.
				new Notice("This is a notice works budda!");
			}
		);

		ribbonIconEl.addClass("my-plugin-ribbon-class");
	}
}
