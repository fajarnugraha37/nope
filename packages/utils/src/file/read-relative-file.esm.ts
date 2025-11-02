// @ts-ignore
const root = import.meta.url;
// @ts-ignore
const environmentRoot: string | undefined = import.meta.env?.IAM_DATA_ROOT;
let resolvedRoot: string | undefined = undefined;
let useFetch = false;
const initialFileSystem = root.startsWith("file://");
let runtimeFileSystem = initialFileSystem;
let envRootOverride: string | undefined;

/**
 * Get a data file from the data directory in ESM
 *
 * @param file the path to the file to retrieve data for.
 * @returns the data from the file
 */
export async function readRelativeFile<T>(pathParts: string[]): Promise<T> {
  /*
   * Maybe a little too optimized here. Want to only resolve the root once, but we have to do it inside the
   * function, so caching it here.
   */
  if (!resolvedRoot) {
    if (runtimeFileSystem) {
      const { join } = await import("node:path");
      const { resolve } = await import("node:url");
      resolvedRoot = resolve(root, join("..", ".."));
    } else {
      const effectiveEnvRoot =
        envRootOverride !== undefined ? envRootOverride : environmentRoot;
      if (effectiveEnvRoot && effectiveEnvRoot !== "") {
        useFetch = true;
        resolvedRoot = effectiveEnvRoot;
        if (!resolvedRoot.endsWith("/")) {
          resolvedRoot = resolvedRoot + "/";
        }
      } else {
        resolvedRoot = "../../";
      }
    }
  }

  if (runtimeFileSystem) {
    const { readFile } = await import("fs/promises");
    const { join } = await import("node:path");
    const { fileURLToPath, resolve } = await import("node:url");

    const relativePath = join(...pathParts);
    const contents = await readFile(
      fileURLToPath(resolve(resolvedRoot, relativePath)),
      "utf-8"
    );
    return JSON.parse(contents);
  } else if (useFetch) {
    const dataUrl = resolvedRoot + pathParts.join("/");
    const response = await fetch(dataUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch JSON data from ${dataUrl}`);
    }
    return await response.json();
  } else {
    const contents = await import(resolvedRoot + pathParts.join("/"));
    return await contents.default;
  }
}

export function __configureReadRelativeFile(options: {
  reset?: boolean;
  fileSystem?: boolean;
  resolvedRoot?: string | undefined;
  useFetch?: boolean;
  environmentRoot?: string | undefined | null;
} = {}): void {
  if (options.reset) {
    runtimeFileSystem = initialFileSystem;
    resolvedRoot = undefined;
    useFetch = false;
    envRootOverride = undefined;
  }
  if ("fileSystem" in options && options.fileSystem !== undefined) {
    runtimeFileSystem = options.fileSystem;
    resolvedRoot = undefined;
  }
  if ("resolvedRoot" in options) {
    resolvedRoot = options.resolvedRoot;
  }
  if ("useFetch" in options && options.useFetch !== undefined) {
    useFetch = options.useFetch;
  }
  if ("environmentRoot" in options) {
    envRootOverride =
      options.environmentRoot === null ? undefined : options.environmentRoot;
    resolvedRoot = undefined;
  }
}
