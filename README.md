# Obstruct

Give an Obsidian vault a reusable display name and focus its file explorer on one folder without moving or renaming files.

## Example: WebAppStack

Open the **WebAppStack repository folder** as the vault. Under **Settings → Obstruct**, set:

| Setting | Value |
| --- | --- |
| Enable focus | On |
| Display name | WebAppStack |
| Visible folder | docs |

Click **Apply**. The main window's vault labels use the display name, and the file explorer shows the docs folder and its contents. For another project, use its own name and folder. Settings are stored separately in each vault.

A nested folder such as notes/project is supported; its ancestors remain visible so the tree remains navigable. Blank display name uses the real vault name. Blank visible folder shows all files. A missing folder fails open, restoring the full explorer. The command **Obstruct: Toggle folder focus** temporarily restores the normal name and explorer.

## Scope and limitations

- This is a **presentation filter**, not a smaller vault or an access boundary.
- Search, graph, backlinks, quick switcher and indexing still cover the full vault. Existing links can open files outside the visible folder.
- Core new-note and attachment locations are not changed. Set them to docs and docs/assets under **Settings → Files and links** if desired.
- Repository dependency and generated folders remain within the vault's scope; this plugin does not reduce indexing cost.
- Names are changed in supported main-window labels and title formats, not on disk or in the vault registry. The global Manage Vaults dialog, other vaults, Obsidian URIs and detached windows keep their original identities.
- Desktop only. Presentation uses Obsidian DOM selectors because there is no public API for these UI customizations. Future Obsidian versions or themes may need selector updates.
- Disabling or unloading Obstruct restores its own changes. It never deletes, moves or renames notes, and it does not rewrite core settings.

## Install

1. Build this repository with Node.js 22.22.2+, 24.15+ or 26+:
   `npm ci`, then `npm run build`.
2. Create `<vault>/.obsidian/plugins/obsidian-sample-plugin/`.
3. Copy `main.js`, `manifest.json` and `styles.css` into it.
4. Reload Obsidian. Enable **Obstruct** under **Settings → Community plugins**.
5. Open **Settings → Obstruct**, enter your name and folder, then click **Apply**.

The historical plugin ID **obsidian-sample-plugin** is deliberately retained so existing Obstruct installations and settings remain associated with the update. Do not install it alongside the original Obsidian sample plugin, which shares that ID.

To update, disable Obstruct, replace the three release files, then enable it. Keep your existing data.json. Old sample settings migrate to safe defaults with no folder filtering.

## Development

- `npm run dev`: rebuild when source changes.
- `npm run build`: TypeScript validation and production bundle.
- `npm test`: path validation, migration, DOM filtering and restoration checks.
- `npm run package`: build and copy the three installable files to dist/obsidian-sample-plugin.

Dependencies are pinned in package-lock.json. The old sample commands, logging, and placeholder components have been removed.

## Manual acceptance checks

The automated DOM checks do not replace a live Obsidian check. In a disposable repository vault:

1. Include docs, docs-old, backend, a root README, and docs/README.md.
2. Set a custom display name and docs. Confirm only docs is shown in the explorer, including after collapsing/reopening it.
3. Open a note and switch tabs. Confirm the title remains correct.
4. Create, rename and delete sibling folders. Confirm new siblings stay hidden.
5. Try a nested folder. Confirm its ancestors remain visible.
6. Rename or delete the focused folder externally. Confirm the explorer fails open.
7. Disable/re-enable the plugin and restart Obsidian. Confirm restoration and saved settings.
8. Confirm core search can still find an outside note; focus intentionally does not block it.

## API references

- [Obsidian API](https://github.com/obsidianmd/obsidian-api)
- [Obsidian files and links settings](https://obsidian.md/help/settings)
