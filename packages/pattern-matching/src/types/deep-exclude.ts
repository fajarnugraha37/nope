import type { DistributeMatchingUnions } from "./distributed-union.js";

export type DeepExclude<a, b> = Exclude<DistributeMatchingUnions<a, b>, b>;
