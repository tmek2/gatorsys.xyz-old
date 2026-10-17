import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

export const root = path.resolve(import.meta.dirname, "..");

/**
 * A file from this repository as text, with Windows line endings normalised.
 *
 * Large files are split into parts kept in a folder named after the file:
 *
 * - a stylesheet `x.css` then holds only `@import "./x/NN-name.css";` lines,
 *   in cascade order, and those imports are replaced by the parts' text;
 * - a module `x.tsx` that imports from `./x/` has the folder's files appended
 *   (the pages and helpers it was split into).
 *
 * So an assertion about `x` sees all of its code, wherever it now lives.
 */
export async function source(relativePath: string): Promise<string> {
  const text = (await readFile(path.join(root, relativePath), "utf8")).replace(/\r\n/g, "\n");
  const ext = path.extname(relativePath);
  const stem = path.basename(relativePath, ext);
  const folder = path.join(path.dirname(relativePath), stem);

  if (ext === ".css") {
    const parts = new RegExp(`^@import "\\./${stem}/([\\w.-]+\\.css)";$`, "gm");
    let out = text;
    for (const [line, name] of [...text.matchAll(parts)]) {
      const part = await source(path.join(folder, name));
      out = out.replace(line, () => part);
    }
    return out;
  }

  if (!text.includes(`from "./${stem}/`)) return text;
  const names = (await readdir(path.join(root, folder))).filter((name) => /\.tsx?$/.test(name)).sort();
  const parts = await Promise.all(names.map((name) => source(path.join(folder, name))));
  return [text, ...parts].join("\n");
}
