import type { Plugin, Registry } from "../core/types.js";

/**
 * Plugin definition with registration callback.
 * 
 * @example
 * ```typescript
 * const definition: PluginDefinition = {
 *   name: "geo-plugin",
 *   version: "1.0.0",
 *   register: (registry) => {
 *     registry.addOperator(withinRadiusOp);
 *     registry.addOperator(withinBoundsOp);
 *   }
 * };
 * ```
 */
export interface PluginDefinition {
  /** Plugin name */
  name: string;
  /** Semantic version */
  version: string;
  /** Callback to register operators/specs */
  register(registry: Registry): void;
}

/**
 * Creates a plugin from a definition object.
 * 
 * Plugins provide a clean way to package and distribute custom operators.
 * 
 * @param definition - The plugin definition
 * @returns A plugin instance ready to register
 * 
 * @example
 * ```typescript
 * import { createPlugin } from "@fajarnugraha37/specification";
 * 
 * export const geoPlugin = createPlugin({
 *   name: "geo-plugin",
 *   version: "1.0.0",
 *   register: (registry) => {
 *     registry.addOperator(withinRadiusOperator);
 *     registry.addOperator(withinBoundsOperator);
 *   }
 * });
 * 
 * // Usage
 * geoPlugin.register(spec.registry);
 * ```
 */
export const createPlugin = (definition: PluginDefinition): Plugin => {
  return {
    ...definition,
  };
};
