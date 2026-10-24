# Obstruct Workspace

Obstruct gives a desktop Obsidian vault a display name and a dedicated Notes/Resources sidebar. Files stay in place; the native explorer follows the enabled workspace roots and exclusions.

## Two ways to use it

| Actual vault | Main notes folder | Resource example |
| --- | --- | --- |
| WebAppStack repository | docs | frontend/docs |
| WebAppStack/docs | . | ../frontend/docs |

All relative resource paths resolve from the actual vault root. Parent paths, other Windows drives and UNC paths are supported. Main notes must remain inside the vault. Opening another folder as a vault is an explicit Obsidian action; Obstruct never moves or reopens your vault.

## Settings

Open **Settings → Obstruct**, or use **Obstruct: Open workspace settings**.

The top-level **Workspace** tab has one enable toggle and three nested subtabs:

- **General:** display name, actual vault path, main notes folder and preview.
- **Resources:** add files/folders, browse, label, enable, reorder, edit, remove/undo, and recheck availability.
- **Ignore rules:** global exclusions, optional presets and a path tester with matching-rule explanations.

One Apply/Discard footer stays below the scrolling settings content. Changes remain pending across subtabs and settings closure. **Apply changes** validates and saves once; **Discard changes** restores the active configuration. Drafts do not survive plugin reload. Removing a resource never deletes files.

The toggle command changes active enabled state and the draft's enabled field together; other pending edits are retained.

## Graph

The top-level **Graph** tab brings in Modular Graph's immediate-subfolder visibility controls, custom folder labels, and Show all / Hide all / Refresh actions. Enable graph filters independently of Workspace. A blank Notes folder follows the workspace main notes path; an explicit vault-relative folder overrides it.

Settings use the same Apply/Discard draft as Workspace. After Apply, toggles appear in the native global and local Graph filter panels. Those toggles and the corresponding commands save visibility immediately while preserving other pending settings edits. Folder creation, deletion, renaming, and graph layout changes refresh the controls.

Each open graph retains its own existing search expression. Obstruct appends folder exclusions and removes its own filter group when disabled or unloaded. Folder labels are cosmetic. Graph filtering does not restrict indexing or external resource access. Workspace ignore rules are separate and are not automatically copied into Graph.

The adapter in `src/features/graph/service.ts` uses private Obsidian graph engine and filter-panel interfaces; future Obsidian versions may require updates. The original Modular Graph JavaScript source was recovered from the Knowledge-Base vault; its installed copy remains unchanged. Graph filtering starts disabled for existing Obstruct installations.

## Sidebar and availability

Obstruct opens in the left sidebar when enabled. Notes appears first, then ordered Resources. Expand a folder to load its children; roots are checked at startup without recursive crawling. Large folders display in batches.

Missing or unreadable resources remain visible with Retry. They are checked on expansion, opening, or Recheck; there is no polling. Linked files, symbolic links and junctions are skipped, including linked parent paths. Assign their actual target instead.

Overlapping resource roots are allowed. Repeated files can appear under different roots, with independent exclusions. Duplicate resolved resource roots are rejected.

## Ignore syntax

Rules are case-sensitive, use forward slashes, and include dotfiles. Global rules are relative to Notes and each resource; local rules are relative to their resource. Any matching exclusion wins. Matching a directory excludes descendants.

| Pattern | Meaning |
| --- | --- |
| node_modules | Root-level dependency directory and descendants |
| **/node_modules/** | Dependency directories at any depth, including the root |
| *.log | Root-level log files |
| **/*.log | Log files at any depth |
| a/?.txt | One-character filenames under a |

Supports only *, ** and ?. Negation, brackets, braces and parent traversal in patterns are not supported. Single-file resources match their basename.

**Exclusions filter Obstruct browsing and the native file explorer.** They do not stop native indexing or change Obsidian search, backlinks or graph results.

## External previews

Internal notes use Obsidian's native file opening. External supported files open in a dedicated read-only preview with **Open in default app**.

- UTF-8 text and Markdown: up to 2 MiB.
- PNG, JPEG, GIF and WebP images: up to 10 MiB.
- Other formats and larger files: open externally.
- Markdown renders headings, tables, lists and code. Raw HTML is escaped; output is sanitized; Obsidian plugin renderers and executable embeds are not invoked.
- Local links and images are previewed only within enabled roots and subject to ignore rules. Other local targets offer explicit external opening.
- Remote images load only on click, without credentials. Redirects and non-image responses are rejected. Network/CORS failures are shown without breaking the preview.
- Disabling/removing a resource invalidates its preview. Missing files show an unavailable state.

Names affect supported main-window labels and title formats, not filesystem names, vault registry identities or the global vault manager. Name-label integration relies on Obsidian UI selectors. Native file explorer filtering from 1.1 is replaced by the dedicated sidebar.

## Install and update

Use Bun 1.4.3 or newer:

1. bun install --frozen-lockfile
2. bun run package
3. Copy main.js, manifest.json and styles.css from dist/obstruct into the actual vault's .obsidian/plugins/obstruct folder.
4. Enable Obstruct under Community plugins, or reload it after an update.

Keep data.json during upgrades. Older visibleFolder settings migrate to the main notes path; blank becomes a dot. Existing display name and enabled state are preserved.

The plugin ID is obstruct. To migrate an older installation, close Obsidian, rename the vault plugin folder from obsidian-sample-plugin to obstruct, install the new build while preserving data.json, and replace the old ID in community-plugins.json. Update any plugin-prefixed hotkey IDs from obsidian-sample-plugin: to obstruct: before reopening Obsidian.

## Development

Work on dev. Use Bun exclusively and keep bun.lock as the only lockfile. All authored scripts are TypeScript.

- bun run dev — rebuild on changes.
- bun run typecheck — validate source and scripts.
- bun run test — regression checks.
- bun run package — validate and build the installable CommonJS plugin.
- bun run version — synchronize package version into manifest and compatibility metadata.

The plugin executes inside Obsidian's Electron runtime. Bun is the development tool, not a plugin-runtime dependency.

Feature modules live under src/features; configuration, paths, filtering and UI helpers are shared under src/shared. The entrypoint wires lifecycle and registrations.

## Verification

Automated checks cover migration, save failures/concurrency, toggle/draft consistency, Windows paths, ignore semantics, bounded reads, missing/disabled resources, junctions, queue timeout/disposal, Markdown safety and display-name restoration. Packaged-plugin UI tests exercise draft persistence across settings closure, Apply/Discard, keyboard tabs, resource dialogs, ordering and Undo, remote-image placeholders, external-link boundaries and preview revocation. A live walkthrough must additionally cover settings dialogs, sidebar navigation, previews, keyboard focus, themes and reload/unload before deployment.

While enabled, Obstruct hides native explorer entries outside Notes and enabled internal resources, entries matched by workspace ignore rules, and entries excluded through Obsidian Files and links settings. Parent folders needed to reach an enabled root stay visible. Disabling or unloading Obstruct restores explorer rows. This is a visual filter, not an indexing boundary. External resources remain in the Obstruct sidebar. Native explorer markup and the excluded-files lookup are Obsidian integration points that may require maintenance after app updates.

### Settings code ownership

`src/features/settings/settings-tab.ts` is the Obsidian entry point. Workspace sections and resource dialogs live in `src/features/workspace/settings/`; the shared draft action bar lives in `src/features/settings/components/`. All sections edit the same configuration controller and reuse the existing path, resource-access and ignore services.
