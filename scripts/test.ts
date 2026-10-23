import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { normalizeFolder, readSettings, isVisible } from "../src/focus-settings";
import { FocusPresentation } from "../src/focus-presentation";
let passed = 0;
function test(name: string, fn: () => void) { fn(); passed++; console.log("PASS " + name); }

test("normalize Windows and nested paths", () => {
  assert.equal(normalizeFolder(" ./notes\\project/ "), "notes/project");
  assert.equal(normalizeFolder(""), "");
});
test("reject paths outside the vault", () => {
  for (const path of ["../docs", "docs/../private", "/tmp/docs", "C:\\docs", "docs//nested"])
    assert.throws(() => normalizeFolder(path));
});
test("safe migration from old sample settings", () => {
  assert.deepEqual(readSettings({ mySetting: "old" }), { displayName: "", visibleFolder: "", enabled: true });
  assert.equal(readSettings({ visibleFolder: "../private" }).visibleFolder, "");
  assert.equal(readSettings({ enabled: false }).enabled, false);
});
test("exact path boundaries and ancestor visibility", () => {
  for (const path of ["/", "notes", "notes/docs", "notes/docs/readme.md"]) assert.equal(isVisible(path, "notes/docs"), true);
  for (const path of ["notes/docs-old", "notes/other", "private"]) assert.equal(isVisible(path, "notes/docs"), false);
});

function fixture() {
  const dom = new JSDOM('<title>Home - Project - Obsidian v1.14.4</title><body><div class="workspace-drawer-vault-name">Project</div><div data-type="file-explorer"><div class="nav-folder mod-root"><div class="nav-folder-title" data-path="/"><span class="nav-folder-title-content">Project</span></div><div class="nav-folder"><div class="nav-folder-title" data-path="docs">docs</div><div class="nav-file"><div class="nav-file-title" data-path="docs/README.md">README</div></div></div><div class="nav-folder"><div class="nav-folder-title" data-path="docs-old">docs-old</div></div><div class="nav-file"><div class="nav-file-title" data-path="README.md">README</div></div></div></div><div data-type="search"><div class="nav-file"><div class="nav-file-title" data-path="private.md">private result</div></div></div></body>');
  return { dom, doc: dom.window.document, ui: new FocusPresentation(dom.window.document, "Project") };
}
const settings = { displayName: "WebAppStack", visibleFolder: "docs", enabled: true };
test("filter explorer only; preserve selected folder, descendants and root", () => {
  const { doc, ui } = fixture();
  ui.apply(settings, true);
  assert.equal(doc.querySelectorAll(".obstruct-hidden").length, 2);
  assert.equal(doc.querySelector('[data-path="docs"]')!.parentElement!.classList.contains("obstruct-hidden"), false);
  assert.equal(doc.querySelector('[data-type="search"] .obstruct-hidden'), null);
});
test("name and title are cosmetic; repeated refresh is stable", () => {
  const { doc, ui } = fixture();
  ui.apply(settings, true);
  ui.apply(settings, true);
  assert.equal(doc.title, "Home - WebAppStack - Obsidian v1.14.4");
  assert.equal(doc.querySelector(".workspace-drawer-vault-name")!.textContent, "WebAppStack");
  ui.dispose();
  assert.equal(doc.title, "Home - Project - Obsidian v1.14.4");
  assert.equal(doc.querySelector(".workspace-drawer-vault-name")!.textContent, "Project");
  assert.equal(doc.querySelectorAll(".obstruct-hidden").length, 0);
});
test("missing folder and disabling both restore explorer", () => {
  const { doc, ui } = fixture();
  ui.apply(settings, true);
  ui.apply(settings, false);
  assert.equal(doc.querySelectorAll(".obstruct-hidden").length, 0);
  ui.apply({ ...settings, enabled: false }, true);
  assert.equal(doc.querySelector(".workspace-drawer-vault-name")!.textContent, "Project");
});
test("resetting settings restores labels and visibility", () => {
  const { doc, ui } = fixture();
  ui.apply(settings, true);
  ui.apply(readSettings(null), true);
  assert.equal(doc.querySelectorAll(".obstruct-hidden").length, 0);
  assert.equal(doc.querySelector(".workspace-drawer-vault-name")!.textContent, "Project");
});
test("new rows are filtered after refresh", () => {
  const { doc, ui } = fixture();
  ui.apply(settings, true);
  const row = doc.createElement("div");
  row.className = "nav-folder";
  row.innerHTML = '<div class="nav-folder-title" data-path="backend">backend</div>';
  doc.querySelector('[data-type="file-explorer"]')!.append(row);
  ui.apply(settings, true);
  assert.equal(row.classList.contains("obstruct-hidden"), true);
});
test("cleanup does not overwrite a title changed by Obsidian", () => {
  const { doc, ui } = fixture();
  ui.apply(settings, true);
  doc.title = "Other window";
  ui.dispose();
  assert.equal(doc.title, "Other window");
});
test("custom name is plain text, not HTML", () => {
  const { doc, ui } = fixture();
  ui.apply({ ...settings, displayName: "<img src=x>" }, true);
  assert.equal(doc.querySelector(".workspace-drawer-vault-name img"), null);
  assert.equal(doc.querySelector(".workspace-drawer-vault-name")!.textContent, "<img src=x>");
});
console.log(passed + " checks passed.");

