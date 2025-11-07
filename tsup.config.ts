export const tsupConfig = {
  // entryPoints,
  // tsconfig: "./tsconfig.json",
  // outDir: "dist/",
  format: ["cjs", "esm"],
  dts: true,
  minify: true,
  clean: true,
  sourcemap: false,
  bundle: true,
  splitting: false,
  outExtension(ctx: any) {
    return {
      dts: ".d.ts",
      js: ctx.format === "cjs" ? ".cjs" : ".mjs",
    };
  },
  treeshake: false,
  target: "es2022",
  platform: "node",
  cjsInterop: true,
  keepNames: true,
  skipNodeModulesBundle: false,
};
