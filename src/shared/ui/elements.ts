export function status(parent: HTMLElement, text = ""): HTMLElement {
  return parent.createEl("p", { text, cls: "obstruct-status", attr: { role: "status", "aria-live": "polite" } });
}
export function button(parent: HTMLElement, text: string, action: () => void | Promise<void>): HTMLButtonElement {
  const el = parent.createEl("button", { text, attr: { type: "button" } });
  el.addEventListener("click", () => { void Promise.resolve().then(action).catch(error => {
    status(parent, error instanceof Error ? error.message : String(error));
  }); }); return el;
}
export const message = (error: unknown): string => error instanceof Error ? error.message : String(error);
