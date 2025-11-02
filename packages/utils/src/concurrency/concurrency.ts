export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export type Fn<A extends any[] = any[], R = any> = (...args: A) => R;
