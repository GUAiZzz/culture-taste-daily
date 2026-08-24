import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export async function sha256File(filePath) {
  return sha256(await readFile(filePath));
}

export async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortValue(value[key])]),
    );
  }
  return value;
}

export function stableJson(value) {
  return `${JSON.stringify(sortValue(value), null, 2)}\n`;
}

export async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, stableJson(value), "utf8");
}

export async function walkFiles(root) {
  const found = [];

  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name, "en"));
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(`Symbolic links are not allowed in public inputs: ${absolute}`);
      }
      if (entry.isDirectory()) await visit(absolute);
      if (entry.isFile()) found.push(absolute);
    }
  }

  await visit(root);
  return found;
}

export function toPosix(relativePath) {
  return relativePath.split(path.sep).join("/");
}

export async function fileDigestMap(root, { exclude = [] } = {}) {
  const excluded = new Set(exclude);
  const result = {};
  for (const filePath of await walkFiles(root)) {
    const relative = toPosix(path.relative(root, filePath));
    if (!excluded.has(relative)) result[relative] = await sha256File(filePath);
  }
  return result;
}

export function digestMap(fileMap) {
  const lines = Object.entries(fileMap)
    .sort(([a], [b]) => a.localeCompare(b, "en"))
    .map(([name, digest]) => `${name}\0${digest}`);
  return sha256(`${lines.join("\n")}\n`);
}

export async function directoryDigest(root, options) {
  return digestMap(await fileDigestMap(root, options));
}

export async function resetDirectory(target, safetyRoot) {
  const resolvedTarget = path.resolve(target);
  const resolvedSafetyRoot = path.resolve(safetyRoot);
  if (
    resolvedTarget === resolvedSafetyRoot ||
    resolvedTarget === path.parse(resolvedTarget).root ||
    !resolvedTarget.startsWith(`${resolvedSafetyRoot}${path.sep}`)
  ) {
    throw new Error(`Refusing to reset unsafe output directory: ${resolvedTarget}`);
  }
  await rm(resolvedTarget, { recursive: true, force: true });
  await mkdir(resolvedTarget, { recursive: true });
}

export async function copyTree(source, destination) {
  for (const sourceFile of await walkFiles(source)) {
    const relative = path.relative(source, sourceFile);
    const targetFile = path.join(destination, relative);
    await mkdir(path.dirname(targetFile), { recursive: true });
    await writeFile(targetFile, await readFile(sourceFile));
  }
}

export async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}
