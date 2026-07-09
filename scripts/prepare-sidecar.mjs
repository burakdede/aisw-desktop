import { execFileSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
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

const sourceArg = process.argv[2];
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

const targetTriple = detectTargetTriple();
const extension = extname(resolvedSource).toLowerCase() === ".exe" ? ".exe" : "";
const targetDir = resolve("src-tauri/binaries");
const targetPath = join(targetDir, `aisw-${targetTriple}${extension}`);

mkdirSync(targetDir, { recursive: true });
copyFileSync(resolvedSource, targetPath);
chmodSync(targetPath, 0o755);

console.log(targetPath);
