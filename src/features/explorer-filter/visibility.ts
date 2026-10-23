import { WorkspaceConfig } from "../../shared/config/model";
import { explain } from "../../shared/filtering/ignore";
import { resolveResource, within } from "../../shared/paths/resolver";
import { ResourceService } from "../resources/service";

/** Uses the same root resolution and exclusion semantics as the workspace browser. */
export function explorerVisible(
  service: ResourceService, config: WorkspaceConfig, relative: string,
  folder: boolean, nativeIgnored: (path: string) => boolean,
): boolean {
  if (!config.enabled) return true;
  if (nativeIgnored(relative)) return false;
  const absolute = resolveResource(service.vaultRoot, relative);
  return service.roots(config).some(root => {
    if (!root.enabled || !within(service.vaultRoot, root.absolute)) return false;
    if (folder && within(absolute, root.absolute) && absolute !== root.absolute) return true;
    if (!within(root.absolute, absolute)) return false;
    return !explain(service.relative(root, absolute, !folder && absolute === root.absolute), config.ignore, root.ignore).length;
  });
}
