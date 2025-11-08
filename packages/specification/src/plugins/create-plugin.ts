import type { Plugin, Registry } from "../core/types.js";

export interface PluginDefinition {
  name: string;
  version: string;
  register(registry: Registry): void;
}

export const createPlugin = (definition: PluginDefinition): Plugin => {
  return {
    ...definition,
  };
};
