import type { ExplainNode, SpecMeta } from "../core/types.js";

export type HumanizerTemplate = (params: {
  id: string;
  kind: string;
  path?: string;
  meta?: SpecMeta;
}) => string;

export class Humanizer {
  private readonly templates = new Map<string, HumanizerTemplate>();

  set(kind: string, template: HumanizerTemplate): this {
    this.templates.set(kind, template);
    return this;
  }

  humanize(node: ExplainNode): string | undefined {
    const kind = node.meta?.kind as string | undefined;
    if (!kind) return node.reason;
    const template = this.templates.get(kind);
    if (!template) return node.reason;
    return template({
      id: node.id,
      kind,
      path: node.path,
      meta: node.meta,
    });
  }
}

export const defaultHumanizer = new Humanizer();
