import { execFileSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import process from "node:process";

function detectTargetTriple() {
  try {
    return execFileSync("rustc", ["--print", "host-tuple"], {
      encoding: "utf8",
    }).trim();
  } catch {
    const verbose = execFileSync("rustc", ["-Vv"], { encoding: "utf8" });
    const hostLine = verbose
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.startsWith("host: "));
    if (!hostLine) {
      throw new Error("failed to detect rust target triple");
    }
    return hostLine.replace("host: ", "");
  }
}

function expectedBinaryFormat(targetTriple) {
  if (targetTriple.endsWith("pc-windows-msvc")) {
    return "pe";
  }
  if (targetTriple.endsWith("unknown-linux-gnu")) {
    return "elf";
  }
  if (targetTriple.endsWith("apple-darwin")) {
    return "macho";
  }
  throw new Error(`unsupported target triple for sidecar staging: ${targetTriple}`);
}

function detectBinaryFormat(sourcePath) {
  const header = readFileSync(sourcePath).subarray(0, 4);
  if (header.length < 4) {
    return "unknown";
  }

  const hex = header.toString("hex");
  if (header[0] === 0x4d && header[1] === 0x5a) {
    return "pe";
  }
  if (hex === "7f454c46") {
    return "elf";
  }
  if (
    [
      "feedface",
      "cefaedfe",
      "feedfacf",
      "cffaedfe",
      "cafebabe",
      "bebafeca",
      "cafebabf",
      "bfbafeca",
    ].includes(hex)
  ) {
    return "macho";
  }
  return "unknown";
}

function extensionForTarget(targetTriple) {
  return expectedBinaryFormat(targetTriple) === "pe" ? ".exe" : "";
}

const args = process.argv.slice(2);
let explicitTarget = process.env.AISW_DESKTOP_TARGET_TRIPLE ?? null;
let sourceArg = null;

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === "--target") {
    explicitTarget = args[index + 1] ?? null;
    index += 1;
    continue;
  }
  sourceArg = arg;
}

const sourcePath = sourceArg ?? process.env.AISW_DESKTOP_AISW_SOURCE;
if (!sourcePath) {
  console.error("Provide an aisw binary path as the first argument or AISW_DESKTOP_AISW_SOURCE.");
  process.exit(1);
}

const resolvedSource = resolve(sourcePath);
if (!existsSync(resolvedSource)) {
  console.error(`aisw source binary not found: ${resolvedSource}`);
  process.exit(1);
}

const targetTriple = explicitTarget ?? detectTargetTriple();
const expectedFormat = expectedBinaryFormat(targetTriple);
const actualFormat = detectBinaryFormat(resolvedSource);
if (actualFormat !== expectedFormat) {
  console.error(
    `aisw binary format mismatch: expected ${expectedFormat} for ${targetTriple}, got ${actualFormat}.`,
  );
  process.exit(1);
}
const extension = extensionForTarget(targetTriple);
const targetDir = resolve("src-tauri/binaries");
const targetPath = join(targetDir, `aisw-${targetTriple}${extension}`);

mkdirSync(targetDir, { recursive: true });
copyFileSync(resolvedSource, targetPath);
chmodSync(targetPath, 0o755);

console.log(targetPath);
