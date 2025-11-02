interface ReadRelativeFileModule {
  readRelativeFile: <T>(pathParts: string[]) => Promise<T>;
}
    
let cachedModule: ReadRelativeFileModule | null = null;

const isESM = typeof __filename === "undefined";

const isTs = (() => {
    const match = new Error().stack?.match(/at .* \((.*):\d+:\d+\)/);
    return (match && match[1] ? match[1] : "").endsWith(".ts");
})();

export async function readRelativeFile<T>(pathParts: string[]): Promise<T> {
  let prefix = "";
  if (isESM) {
    prefix = isTs ? "" : "esm";
    if (!cachedModule) {
      cachedModule = (await import(
        "./read-relative-file.esm.js"
      )) as ReadRelativeFileModule;
    }
  } else {
    prefix = isTs ? "" : "cjs";
    if (!cachedModule) {
      cachedModule =require("./read-relative-file.cjs.js") as ReadRelativeFileModule;
    }
  }
  const { readRelativeFile } = cachedModule;
  return readRelativeFile<T>([prefix, ...(pathParts || [])]);
}
