import { glob } from "glob";
import { defineConfig } from "tsup";
import { tsupConfig } from "../../tsup.config";

export default defineConfig([
  {
    ...(tsupConfig as any),
    entryPoints: glob
      .sync("./src/**/*.{ts,js,esm,cjs,tsx,jsx,json,yaml,yml,html,css}")
      .map((path) => path.replaceAll("\\", "/")),
    outDir: "dist/",
    tsconfig: "./tsconfig.json",
  },
]);
