import { JSDOM } from "jsdom";
import vm from "node:vm";
import { createRequire } from "node:module";
export function harness(root: string) {
  const dom = new JSDOM('<title>Notes - docs - Obsidian 1.14.5</title><body><div class="workspace-drawer-vault-name">docs</div></body>', {url:"https://local.test"});
  const doc = dom.window.document;
  const proto = dom.window.HTMLElement.prototype as unknown as Record<string, unknown>;
  proto.empty = function(this: HTMLElement) { this.replaceChildren(); };
  proto.setText = function(this: HTMLElement, text: string) { this.textContent = text; };
  proto.addClass = function(this: HTMLElement, name: string) { this.classList.add(name); };
  proto.createEl = function(this: HTMLElement, tag: string, options: Record<string, any> = {}) {
    const el = doc.createElement(tag); if (options.text) el.textContent = options.text;
    if (options.cls) el.className=options.cls;
    for (const [key,value] of Object.entries(options.attr ?? {})) el.setAttribute(key,String(value));
    if (options.value !== undefined) (el as HTMLInputElement).value=options.value;
    this.append(el); return el;
  };
  proto.createDiv = function(this: HTMLElement, options?: Record<string, unknown>) { return (this as any).createEl("div",options); };
  proto.createSpan = function(this: HTMLElement, options?: Record<string, unknown>) { return (this as any).createEl("span",options); };
  const factories = new Map<string, any>(); const leaves: any[]=[]; const tabs: any[]=[]; const cleanup: (()=>void)[]=[];
  let ready = () => {}; let data: unknown = {displayName:"Workspace",mainNotesPath:".",resources:[],ignore:[]};
  const vaultEvents = new Set<{name:string;callback:(...args:any[])=>void}>();
  const app: any = {
    vault: { on:(name:string,callback:(...args:any[])=>void)=>{const ref={name,callback};vaultEvents.add(ref);return ref;}, offref:(ref:any)=>vaultEvents.delete(ref), trigger:(name:string,...args:any[])=>{for(const ref of vaultEvents) if(ref.name===name) ref.callback(...args);}, adapter: null, getName:()=>"docs", getAbstractFileByPath:()=>null },
    workspace: { on:()=>({}),
      onLayoutReady:(fn:()=>void)=>{ready=fn;}, getLeavesOfType:(type:string)=>leaves.filter(l=>l.type===type),
      getLeftLeaf:()=>leaf(), getLeaf:()=>leaf(), revealLeaf:async()=>{},
      detachLeavesOfType:(type:string)=>{for(const l of leaves.filter(l=>l.type===type)) void l.view?.onClose();},
    },
    setting: {open:()=>{},openTabById:()=>tabs[0]?.display()},
  };
  function leaf(): any {
    const l: any = { app, type:"", setViewState:async(state:any)=>{
      l.type=state.type; l.view=factories.get(state.type)(l); await l.view.onOpen();
      if(state.state) await l.view.setState(state.state);
    },openFile:async()=>{} }; leaves.push(l); return l;
  }
  class FileSystemAdapter { getBasePath(){return root;} }
  app.vault.adapter=new FileSystemAdapter();
  class Plugin {
    manifest: any; app: any;
    constructor(a:any,m:any){this.app=a;this.manifest=m;}
    async loadData(){return data;} async saveData(d:unknown){data=d;}
    registerView(type:string,factory:any){factories.set(type,factory);}
    addSettingTab(tab:any){tabs.push(tab);} addRibbonIcon(){return doc.createElement("button");}
    registerEvent(){} addCommand(){} register(fn:()=>void){cleanup.push(fn);}
  }
  class PluginSettingTab { containerEl: HTMLElement; constructor(public app:any, public plugin:any){this.containerEl=doc.createElement("section");doc.body.append(this.containerEl);} }
  class ItemView { app:any; contentEl:HTMLElement; constructor(public leaf:any){this.app=leaf.app;this.contentEl=doc.createElement("section");doc.body.append(this.contentEl);} }
  class Modal {
    contentEl:HTMLElement;titleEl:HTMLElement; app:any; scope={};
    constructor(a:any){this.app=a;this.contentEl=doc.createElement("section");this.titleEl=doc.createElement("h2");}
    open(){doc.body.append(this.titleEl,this.contentEl);(this as any).onOpen?.();}
    close(){(this as any).onClose?.();this.contentEl.remove();this.titleEl.remove();}
  }
  class Setting {
    constructor(private el:HTMLElement){}
    setName(text:string){const label=doc.createElement("label");label.textContent=text;this.el.append(label);return this;}
    setDesc(text:string){const label=doc.createElement("small");label.textContent=text;this.el.append(label);return this;}
    addText(fn:(control:any)=>void){const input=doc.createElement("input");this.el.append(input);const control:any={inputEl:input,setValue:(v:string)=>{input.value=v;return control;},setPlaceholder:(v:string)=>{input.placeholder=v;return control;},onChange:(cb:any)=>{input.addEventListener("input",()=>cb(input.value));return control;}};fn(control);return this;}
    addToggle(fn:(control:any)=>void){const input=doc.createElement("input");input.type="checkbox";this.el.append(input);const control:any={setValue:(v:boolean)=>{input.checked=v;return control;},onChange:(cb:any)=>{input.addEventListener("change",()=>cb(input.checked));return control;}};fn(control);return this;}
    addButton(fn:(control:any)=>void){const el=doc.createElement("button");this.el.append(el);const control:any={setButtonText:(v:string)=>{el.textContent=v;return control;},onClick:(cb:any)=>{el.addEventListener("click",cb);return control;}};fn(control);return this;}
  }
  class SettingGroup {
    listEl: HTMLElement;
    constructor(parent: HTMLElement) { this.listEl=doc.createElement("div"); this.listEl.className="setting-group"; parent.append(this.listEl); }
    addClass(name: string) { this.listEl.classList.add(name); return this; }
  }
  const obsidian={SettingGroup,setIcon:(el:HTMLElement,icon:string)=>{el.setAttribute("data-icon",icon);},Plugin,FileSystemAdapter,PluginSettingTab,ItemView,Modal,Setting,Notice:class{},TFile:class{}};
  const realRequire=createRequire(import.meta.url); const module={exports:{} as any};
  const context=vm.createContext({module,exports:module.exports,require:(name:string)=>name==="obsidian"?obsidian:realRequire(name),
    window:dom.window,document:doc,navigator:dom.window.navigator,MutationObserver:dom.window.MutationObserver,
    console,process,Buffer,URL,TextDecoder,AbortController,fetch,crypto,Blob,setTimeout,clearTimeout,queueMicrotask});
  return {dom,doc,app,tabs,leaves,getData:()=>data,setData:(value:unknown)=>{data=value;},ready:()=>ready(),load:async(source:string)=>{
    vm.runInContext(source,context); const Constructor=module.exports.default??module.exports;
    const plugin=new Constructor(app,{id:"obstruct"});await plugin.onload();return plugin;
  },dispose:()=>{for(const fn of cleanup.reverse()) fn();dom.window.close();}};
}
