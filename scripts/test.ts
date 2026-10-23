import { harness } from "./test-support/obsidian";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { JSDOM } from "jsdom";
import { migrate, clone } from "../src/shared/config/model";
import { ConfigController } from "../src/shared/config/controller";
import { resolveResource, resolveNotes, within, storedPath } from "../src/shared/paths/resolver";
import { explain, validatePattern } from "../src/shared/filtering/ignore";
import { ResourceService } from "../src/features/resources/service";
import { IoQueue } from "../src/features/resources/io-queue";
import { DisplayName } from "../src/features/display-name/presentation";
import { renderMarkdown } from "../src/features/preview/markdown";
import { resolveLink } from "../src/features/preview/links";
await import("./build.ts");
let count = 0;
async function test(name: string, run: () => void | Promise<void>) { await run(); count++; console.log("PASS " + name); }
await test("migration preserves existing focus settings", () => {
  const c = migrate({ visibleFolder: "docs", displayName: "Project", enabled: false });
  assert.equal(c.mainNotesPath, "docs"); assert.equal(c.displayName, "Project"); assert.equal(c.enabled, false);
  assert.deepEqual(c.resources, []); assert.equal(migrate(null).mainNotesPath, ".");
});
await test("draft apply and discard isolate active state", async () => {
  let saved: unknown; const c = new ConfigController(null, async d => { saved = d; }, async () => {});
  c.edit(d => { d.displayName = "Draft"; }); assert.equal(c.active.displayName, "");
  await c.apply(); assert.equal(c.active.displayName, "Draft"); assert.ok(saved);
  c.edit(d => { d.displayName = "Other"; }); c.discard(); assert.equal(c.draft.displayName, "Draft");
});
await test("failed persistence retains active and pending values", async () => {
  const c = new ConfigController(null, async () => { throw new Error("disk"); }, async () => {});
  c.edit(d => { d.displayName = "Pending"; }); await assert.rejects(c.apply());
  assert.equal(c.active.displayName, ""); assert.equal(c.draft.displayName, "Pending"); assert.equal(c.busy, false);
});
await test("command toggle merges enable state into pending draft", async () => {
  const c = new ConfigController(null, async () => {}, async () => {});
  c.edit(d => { d.displayName = "Pending"; }); await c.toggle();
  assert.equal(c.draft.enabled, false); assert.equal(c.draft.displayName, "Pending");
  await c.apply(); assert.equal(c.active.enabled, false);
});
await test("save serializes and prevents intervening edits", async () => {
  let finish!: () => void; const c = new ConfigController(null, () => new Promise<void>(r => { finish = r; }), async () => {});
  const saving = c.apply(); await new Promise(r => setTimeout(r, 0)); await assert.rejects(c.toggle());
  c.edit(d => { d.displayName = "Ignored during save"; }); finish(); await saving; assert.equal(c.active.displayName, "");
});
await test("listener failures cannot corrupt a persisted commit", async () => {
  const c = new ConfigController(null, async () => {}, async () => {});
  const original = console.error; console.error = () => {}; c.subscribe(() => { throw new Error("view"); });
  try { await c.apply(); assert.equal(c.busy, false); } finally { console.error = original; }
});
await test("windows resources accept parents, UNC and other drives", () => {
  assert.equal(resolveResource("E:\\project\\docs", "../frontend/docs", path.win32), "E:\\project\\frontend\\docs");
  assert.equal(resolveResource("E:\\project\\docs", "../../shared", path.win32), "E:\\shared");
  assert.equal(resolveResource("E:\\project", "C:\\notes", path.win32), "C:\\notes");
  assert.equal(resolveResource("E:\\project", "\\\\server\\share\\notes", path.win32), "\\\\server\\share\\notes");
  assert.throws(() => resolveResource("E:\\project", "C:folder", path.win32));
});
await test("containment uses path boundaries", () => {
  assert.equal(within("E:\\docs", "E:\\docs-old", path.win32), false);
  assert.equal(within("E:\\docs", "E:\\docs\\nested", path.win32), true);
});
await test("glob matching has explicit root and descendant semantics", () => {
  const match = (p: string, g: string) => explain(p, [g]).length > 0;
  assert.ok(match("node_modules/x/index.js", "node_modules")); assert.ok(!match("src/node_modules/x", "node_modules"));
  assert.ok(match("node_modules", "**/node_modules/**")); assert.ok(match("a/node_modules/x", "**/node_modules/**"));
  assert.ok(match("x.log", "*.log")); assert.ok(!match("a/x.log", "*.log")); assert.ok(match("a/x.log", "**/*.log"));
  assert.ok(match(".hidden/a", ".hidden")); assert.ok(!match("DIST/x", "dist/**"));
  assert.ok(match("a/x.txt", "a/?.txt")); assert.ok(!match("a/xx.txt", "a/?.txt"));
});
await test("global and local matches retain explanations", () => {
  assert.deepEqual(explain("a/file.log", ["**/*.log"], ["a/**"]).map(m => m.source), ["Global","Resource"]);
  for (const invalid of ["!x", "[ab]", "{a,b}", "../private", "foo\\bar", ""]) assert.throws(() => validatePattern(invalid));
});
await test("unsafe URI schemes are blocked", () => {
  for (const value of ["javascript:alert(1)","data:text/html,x","obsidian://new","vbscript:x"]) assert.equal(resolveLink("/notes/a.md", value).kind, "blocked");
  assert.equal(resolveLink("/notes/a.md", "https://example.com/a").kind, "web");
});
await test("markdown is formatted but raw HTML and scripts stay inert", () => {
  const dom = new JSDOM(); const html = renderMarkdown("# Heading\n\n**bold**\n\n<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[x](javascript:alert(1))", dom.window as unknown as Window & typeof globalThis);
  const body = new JSDOM(html).window.document.body;
  assert.equal(body.querySelector("h1")?.textContent, "Heading"); assert.equal(body.querySelector("strong")?.textContent, "bold");
  assert.equal(body.querySelector("script"), null); assert.equal(body.querySelector("[onerror]"), null);
  assert.equal(body.querySelector('a[href^="javascript:"]'), null);
});
await test("queue limits active operations", async () => {
  const q = new IoQueue(2, 1000); let running = 0, maximum = 0;
  await Promise.all(Array.from({length: 6}, () => q.run(async () => { maximum = Math.max(maximum, ++running); await new Promise(r => setTimeout(r, 5)); running--; })));
  assert.equal(maximum, 2); q.dispose();
});
await test("queue times out and ignores late completion", async () => {
  const q = new IoQueue(1, 10); let finish!: () => void;
  const first = q.run(() => new Promise<void>(r => { finish = r; }));
  await assert.rejects(first, /respond/); finish(); await new Promise(r => setTimeout(r, 0));
  assert.equal(await q.run(async () => 42), 42); q.dispose();
});
await test("queue disposal cancels active and queued callers", async () => {
  const q = new IoQueue(1, 1000); let finish!: () => void;
  const first = q.run(() => new Promise<void>(r => { finish = r; })); const second = q.run(async () => 1);
  q.dispose(); await assert.rejects(first, /closed/); await assert.rejects(second, /closed/); finish();
});
const temp = await fs.mkdtemp(path.join(os.tmpdir(), "obstruct-tests-"));
const vault = path.join(temp, "project", "docs"); const external = path.join(temp, "project", "frontend");
await fs.mkdir(vault, { recursive: true }); await fs.mkdir(external);
await fs.writeFile(path.join(vault, "note.md"), "# Notes"); await fs.writeFile(path.join(external, "readme.md"), "# External");
const service = new ResourceService(vault);
try {
  const config = migrate({ mainNotesPath: ".", resources: [{id:"front",label:"Frontend",path:"../frontend",enabled:true,ignore:[]}] });
  await test("notes root and parent resources validate", async () => { await service.validate(config); assert.equal(resolveNotes(vault, "."), vault); assert.throws(() => resolveNotes(vault,"..")); });
  await test("overlapping roots are allowed but duplicates rejected", async () => {
    const overlap = clone(config); overlap.resources.push({id:"parent",label:"Project",path:"..",enabled:true,ignore:[]}); await service.validate(overlap);
    overlap.resources.push({id:"duplicate",label:"Again",path:"../frontend/.",enabled:true,ignore:[]}); await assert.rejects(service.validate(overlap), /more than once/);
  });
  await test("resources cannot duplicate the main notes root", async () => { const c=clone(config); c.resources.push({id:"duplicate-notes",label:"Notes again",path:".",enabled:true,ignore:[]}); await assert.rejects(service.validate(c), /more than once/); });
  await test("availability checks do not traverse children", async () => {
    const state = await service.check(service.root(config.resources[0])); assert.equal(state.status,"Available"); assert.equal(state.kind,"folder");
    assert.deepEqual((await service.list(service.root(config.resources[0]),external,config)).map(e=>e.name),["readme.md"]);
  });
  await test("missing resources remain configured and recover", async () => {
    const missing = {...config.resources[0],id:"missing",path:"../later"}; const c = clone(config); c.resources.push(missing); await service.validate(c);
    assert.equal((await service.check(service.root(missing))).status,"Missing");
    await fs.mkdir(path.join(temp,"project","later")); assert.equal((await service.check(service.root(missing))).status,"Available");
  });
  await test("disabled resources are inaccessible", async () => {
    const c = clone(config); c.resources[0].enabled=false; assert.equal(await service.allowed(path.join(external,"readme.md"),c),null);
  });
  await test("ignores apply to browsing and opening", async () => {
    const c = clone(config); c.ignore=["**/*.md"];
    assert.equal((await service.list(service.root(c.resources[0]),external,c)).length,0);
    assert.equal(await service.allowed(path.join(external,"readme.md"),c),null);
  });
  await test("single file roots match their basename", async () => {
    const c=clone(config); c.resources[0].path="../frontend/readme.md"; c.resources[0].ignore=["*.md"];
    assert.equal(await service.allowed(path.join(external,"readme.md"),c),null);
  });
  await test("bounded file reads reject oversize content", async () => {
    assert.equal(new TextDecoder().decode(await service.read(path.join(external,"readme.md"),100)),"# External");
    await assert.rejects(service.read(path.join(external,"readme.md"),2),/large/);
  });
  await test("deleted files become unavailable", async () => {
    const p=path.join(external,"removed.txt"); await fs.writeFile(p,"x"); assert.ok(await service.allowed(p,config)); await fs.unlink(p); assert.equal(await service.allowed(p,config),null);
  });
  await test("junction roots and descendants are skipped", async () => {
    const link=path.join(temp,"project","linked"); await fs.symlink(external,link, process.platform==="win32"?"junction":"dir");
    assert.equal((await service.inspect(link)).status,"Unsupported"); assert.equal((await service.inspect(path.join(link,"readme.md"))).status,"Unsupported");
  });
  await test("relative stored paths round-trip", () => { assert.equal(resolveResource(vault,storedPath(vault,external)), external); });
} finally { service.dispose(); await fs.rm(temp,{recursive:true,force:true}); }
await test("display names are idempotent and restore without observer churn", async () => {
  const dom = new JSDOM('<title>Home - docs - Obsidian 1.14.5</title><body><span class="workspace-drawer-vault-name">docs</span></body>');
  const previous = globalThis.MutationObserver;
  globalThis.MutationObserver = dom.window.MutationObserver;
  try {
    const view = new DisplayName(dom.window.document, "docs");
    view.update("WebAppStack", true);
    assert.equal(dom.window.document.title, "Home - WebAppStack - Obsidian 1.14.5");
    let mutations = 0;
    const monitor = new dom.window.MutationObserver(records => { mutations += records.length; });
    monitor.observe(dom.window.document.body, {childList:true,subtree:true,characterData:true});
    dom.window.document.body.append(dom.window.document.createElement("p"));
    await new Promise(r => setTimeout(r, 160));
    assert.equal(mutations, 1);
    view.dispose(); monitor.disconnect();
    assert.equal(dom.window.document.querySelector("span")?.textContent, "docs");
    assert.equal(dom.window.document.title, "Home - docs - Obsidian 1.14.5");
  } finally { globalThis.MutationObserver = previous; dom.window.close(); }
});

await test("packaged plugin settings, drafts, keyboard tabs and cleanup", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "obstruct-ui-"));
  const ui = harness(root);
  const pause = () => new Promise(r => setTimeout(r, 350));
  try {
    await ui.load(await fs.readFile(new URL("../main.js", import.meta.url), "utf8"));
    ui.ready(); await pause();
    assert.equal(ui.leaves.length, 1);
    assert.equal(ui.doc.querySelector(".workspace-drawer-vault-name")?.textContent, "Workspace");
    const settings = ui.tabs[0]; settings.display(); await pause();
    const buttons = (name: string) => Array.from(ui.doc.querySelectorAll("button")).find(b => b.textContent === name)!;
    const name = ui.doc.querySelector<HTMLInputElement>('input[placeholder="Display name"]')!;
    name.value = "Draft title"; name.dispatchEvent(new ui.dom.window.Event("input"));
    settings.hide(); settings.display(); await pause();
    assert.equal(ui.doc.querySelector<HTMLInputElement>('input[placeholder="Display name"]')!.value, "Draft title");
    assert.equal((ui.getData() as any).displayName, "Workspace");
    buttons("Discard changes").click(); await pause();
    assert.equal(ui.doc.querySelector<HTMLInputElement>('input[placeholder="Display name"]')!.value, "Workspace");
    const input = ui.doc.querySelector<HTMLInputElement>('input[placeholder="Display name"]')!;
    input.value = "Applied title"; input.dispatchEvent(new ui.dom.window.Event("input")); await pause();
    assert.equal(buttons("Apply changes").disabled, false);
    buttons("Apply changes").click(); await pause();
    assert.equal((ui.getData() as any).displayName, "Applied title");
    assert.equal(ui.leaves.length, 1);
    const tab = ui.doc.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')!;
    tab.dispatchEvent(new ui.dom.window.KeyboardEvent("keydown", {key:"ArrowRight",bubbles:true}));
    assert.equal(ui.doc.activeElement?.textContent, "Resources");
    buttons("Add resource").click();
    assert.match(ui.doc.body.textContent ?? "", /resource/i);
    settings.hide();
  } finally { ui.dispose(); await fs.rm(root, {recursive:true,force:true}); }
});

await test("packaged resource dialog, ordering, Undo and safe external preview", async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "obstruct-preview-"));
  const vault = path.join(temp,"docs"); await fs.mkdir(vault);
  const external = path.join(temp,"resources"); await fs.mkdir(external);
  await fs.writeFile(path.join(external,"note.md"), "# External note\n\n<script>alert(1)</script>\n\n![Remote](https://example.com/image.png)\n\n[Outside](../../outside.txt)");
  const ui = harness(vault); const pause = () => new Promise(r=>setTimeout(r,350));
  ui.setData({schemaVersion:2,enabled:true,mainNotesPath:".",displayName:"Workspace",ignore:[],resources:[
    {id:"external",label:"External",path:"../resources",enabled:true,ignore:[]}
  ]});
  try {
    await ui.load(await fs.readFile(new URL("../main.js",import.meta.url),"utf8")); ui.ready(); await pause();
    const settings=ui.tabs[0];settings.display();await pause();
    const button=(name:string)=>Array.from(ui.doc.querySelectorAll("button")).find(b=>b.textContent===name)!;
    button("Resources").click(); await pause(); button("Add resource").click(); await pause();
    const name=ui.doc.querySelector<HTMLInputElement>('[aria-label="Resource name"]')!;
    name.value="Missing";name.dispatchEvent(new ui.dom.window.Event("input"));
    const location=ui.doc.querySelector<HTMLInputElement>('[aria-label="Resource path"]')!;
    location.value="../missing";location.dispatchEvent(new ui.dom.window.Event("input"));await pause();
    button("Save to draft").click();await pause();
    assert.match(ui.doc.body.textContent??"",/Outside vault/);
    const rows=()=>Array.from(ui.doc.querySelectorAll(".obstruct-resource"));
    assert.equal(rows().length,2);
    rows()[1].querySelectorAll<HTMLButtonElement>("button").forEach(b=>{if(b.textContent==="Move up")b.click();}); await pause();
    assert.match(rows()[0].textContent??"",/Missing/);
    rows()[0].querySelectorAll<HTMLButtonElement>("button").forEach(b=>{if(b.textContent==="Remove")b.click();}); await pause();
    assert.equal(rows().length,1);button("Undo removal").click(); await pause(); assert.equal(rows().length,2);
    await pause();button("Apply changes").click();await pause();
    assert.equal((ui.getData() as any).resources[0].label,"Missing");
    settings.hide();
    const leaf=ui.app.workspace.getLeaf("tab");
    await leaf.setViewState({type:"obstruct-preview",state:{file:path.join(external,"note.md"),rootId:"external"}});
    assert.match(leaf.view.contentEl.textContent,/External note/);
    assert.equal(leaf.view.contentEl.querySelector("script"),null);
    assert.equal(leaf.view.contentEl.querySelector("img"),null);
    assert.match(leaf.view.contentEl.textContent,/Load image: Remote/);
    const anchor=leaf.view.contentEl.querySelector("a");assert.ok(anchor);
    anchor.click();await pause();
    assert.match(leaf.view.contentEl.textContent,/Open linked file externally/);
    settings.display();button("Resources").click(); await pause();
    const externalRow=rows().find(r=>r.textContent?.includes("External"))!;
    const toggle=externalRow.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    toggle.checked=false;toggle.dispatchEvent(new ui.dom.window.Event("change"));await pause();
    button("Apply changes").click();await pause();
    assert.match(leaf.view.contentEl.textContent,/disabled, removed/);
  } finally { ui.dispose();await fs.rm(temp,{recursive:true,force:true}); }
});
await test("Show more exists only while entries remain in the workspace and picker", async () => {
  const bundle = await fs.readFile(new URL("../main.js", import.meta.url), "utf8");
  const waitFor = async (check: () => boolean) => {
    for (let i = 0; i < 100; i++) {
      if (check()) return;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    assert.fail("UI did not settle");
  };
  for (const size of [0, 1, 200, 201]) {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "obstruct-pagination-"));
    await Promise.all(Array.from({length:size}, (_, i) => fs.writeFile(path.join(root, i + ".md"), "")));
    const ui = harness(root);
    try {
      await ui.load(bundle); ui.ready();
      await waitFor(() => !!ui.doc.querySelector(".obstruct-workspace details"));
      const workspace = ui.doc.querySelector<HTMLElement>(".obstruct-workspace")!;
      const details = workspace.querySelector("details")!;
      details.open = true;
      await waitFor(() => size === 0
        ? workspace.textContent!.includes("No visible entries.")
        : workspace.querySelectorAll(".obstruct-file").length === Math.min(size,200));
      const more = (parent: Element) => Array.from(parent.querySelectorAll("button")).find(b => b.textContent === "Show more");
      assert.equal(!!more(workspace), size > 200, "workspace size " + size);
      if (size > 200) {
        more(workspace)!.click();
        await waitFor(() => !more(workspace));
        assert.equal(workspace.querySelectorAll(".obstruct-file").length, size);
      }
      ui.tabs[0].display();
      Array.from((ui.tabs[0].containerEl as HTMLElement).querySelectorAll("button")).find(b => b.textContent === "Browse")!.click();
      await waitFor(() => !!ui.doc.querySelector(".obstruct-picker-list"));
      const picker = ui.doc.querySelector(".obstruct-picker-list")!.parentElement!;
      await waitFor(() => picker.textContent!.includes(size + " entries"));
      assert.equal(!!more(picker), size > 200, "picker size " + size);
      if (size > 200) {
        more(picker)!.click();
        await waitFor(() => !more(picker));
        assert.equal(picker.querySelector(".obstruct-picker-list")!.children.length, size);
      }
      Array.from(picker.querySelectorAll("button")).find(b => b.textContent === "Cancel")!.click();
      await new Promise(resolve => setTimeout(resolve, 0));
    } finally { ui.dispose(); await fs.rm(root, {recursive:true, force:true}); }
  }
});
console.log(count + " checks passed.");
