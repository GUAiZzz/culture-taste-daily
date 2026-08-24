import { readFile } from "node:fs/promises";
import path from "node:path";
import { toPosix, walkFiles } from "./files.mjs";

const PRIVATE_PATH = /(^|\/)(?:\.env(?:\.|$)|[^/]*(?:source[-_]?ledger|private[-_]?ledger|research[-_]?notes|rejected[-_]?candidates?)[^/]*|[^/]+\.(?:pem|key|p12))$/i;
const SECRET_CONTENT = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /github_pat_[A-Za-z0-9_]{20,}/,
  /ghp_[A-Za-z0-9]{20,}/,
  /AKIA[0-9A-Z]{16}/,
];

export async function scanForPrivateMaterial(root) {
  const findings = [];
  for (const filePath of await walkFiles(root)) {
    const relative = toPosix(path.relative(root, filePath));
    if (PRIVATE_PATH.test(relative)) findings.push(`private path: ${relative}`);

    const buffer = await readFile(filePath);
    if (buffer.includes(0)) continue;
    const text = buffer.toString("utf8");
    for (const pattern of SECRET_CONTENT) {
      if (pattern.test(text)) findings.push(`secret-like content: ${relative}`);
    }
  }
  return findings;
}

export async function assertPublicTree(root) {
  const findings = await scanForPrivateMaterial(root);
  if (findings.length) {
    throw new Error(`Private material check failed: ${findings.join("; ")}`);
  }
}
