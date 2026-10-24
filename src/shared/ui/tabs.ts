import { button } from "./elements";
export function renderTabs(parent: HTMLElement, names: string[], selected: string, prefix: string, label: string, className: string, select: (name: string) => void): HTMLElement {
  const tabs = parent.createDiv({ cls: "obstruct-tabs " + className, attr: { role: "tablist", "aria-label": label } });
  for (const [index, name] of names.entries()) {
    const tab = button(tabs, name, () => select(name));
    tab.id = prefix + "-tab-" + index;
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", String(name === selected));
    tab.setAttribute("aria-controls", prefix + "-panel");
    tab.tabIndex = name === selected ? 0 : -1;
    tab.addEventListener("keydown", event => {
      const next = event.key === "Home" ? 0 : event.key === "End" ? names.length - 1
        : event.key === "ArrowRight" ? (index + 1) % names.length
        : event.key === "ArrowLeft" ? (index + names.length - 1) % names.length : -1;
      if (next < 0) return;
      event.preventDefault(); select(names[next]);
    });
  }
  return parent.createDiv({ attr: { role: "tabpanel", id: prefix + "-panel", "aria-labelledby": prefix + "-tab-" + names.indexOf(selected) } });
}
