import { App } from "obsidian";
import { ConfigController } from "../../../shared/config/controller";
import { ResourceConfig } from "../../../shared/config/model";
import { ResourceService } from "../../resources/service";

/** Shared draft and render lifetime used by all workspace sections. */
export interface SectionContext {
  app: App;
  config: ConfigController;
  service: ResourceService;
  containerEl: HTMLElement;
  epoch: number;
  removed: { resource: ResourceConfig; index: number }[];
  render(): void;
}
