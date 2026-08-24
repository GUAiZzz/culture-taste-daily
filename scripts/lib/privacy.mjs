import { readFile } from "node:fs/promises";
import path from "node:path";
import { toPosix, walkFiles } from "./files.mjs";

const PRIVATE_DIRECTORY = /(?:^|\/)(?:private|research-private|rejected-candidates|harry-tone-private)(?:\/|$)/i;
const PRIVATE_VENDOR_DIRECTORY = /(?:^|\/)vendor\/harry-tone(?:\/|$)/i;
const PRIVATE_FILE = /(?:^|\/)(?:\.env(?:\.(?!example$)[^/]*)?|[^/]*(?:source[-_]?ledger|private[-_]?ledger|source[-_]?ledger[-_]?instance|research[-_]?notes|rejected[-_]?candidates?)[^/]*|(?:credentials|secrets|tokens)[^/]*\.json|[^/]+\.(?:pem|key|p12|pfx))$/i;
const SECRET_CONTENT = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /github_pat_[A-Za-z0-9_]{20,}/,
  /gh[pousr]_[A-Za-z0-9]{20,}/,
  /(?:AKIA|ASIA)[0-9A-Z]{16}/,
  /xox[baprs]-[A-Za-z0-9-]{20,}/,
  /sk-(?:proj-)?[A-Za-z0-9_-]{20,}/,
  /sk_live_[A-Za-z0-9]{20,}/,
  /AIza[0-9A-Za-z_-]{30,}/,
];

export async function scanForPrivateMaterial(root) {
  const findings = [];
  for (const filePath of await walkFiles(root)) {
    const relative = toPosix(path.relative(root, filePath));
    if (PRIVATE_DIRECTORY.test(relative) || PRIVATE_VENDOR_DIRECTORY.test(relative) || PRIVATE_FILE.test(relative)) {
      findings.push(`private path: ${relative}`);
    }

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
