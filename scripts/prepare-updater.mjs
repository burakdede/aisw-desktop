import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const CHANNEL_PREFIX = "AISW_DESKTOP_UPDATER_ENDPOINT_";
const PUBKEY_ENV_KEYS = ["TAURI_SIGNING_PUBLIC_KEY", "AISW_DESKTOP_UPDATER_PUBKEY"];

function parseHttpsUrl(value, label) {
  let url;
  try {
    url = new URL(value);
  } catch (error) {
    throw new Error(
      `${label} must be a valid HTTPS URL: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (url.protocol !== "https:") {
    throw new Error(`${label} must use https://`);
  }
  return url.toString();
}

function collectUpdaterChannels(env = process.env) {
  return Object.entries(env)
    .filter(([key, value]) => key.startsWith(CHANNEL_PREFIX) && key.length > CHANNEL_PREFIX.length && value)
    .sort(([left], [right]) => left.localeCompare(right))
    .reduce((channels, [key, value]) => {
      const channel = key.slice(CHANNEL_PREFIX.length).toLowerCase();
      channels[channel] = parseHttpsUrl(value, key);
      return channels;
    }, {});
}

export function prepareUpdaterConfig(rootDir = process.cwd(), env = process.env) {
  const channels = collectUpdaterChannels(env);
  if (!Object.keys(channels).length) {
    throw new Error(
      "Provide at least one AISW_DESKTOP_UPDATER_ENDPOINT_<CHANNEL> value before preparing updater channels.",
    );
  }
  const pubkey = PUBKEY_ENV_KEYS.map((key) => env[key]).find((value) => typeof value === "string" && value.length > 0);
  if (!pubkey) {
    throw new Error(
      "Provide TAURI_SIGNING_PUBLIC_KEY or AISW_DESKTOP_UPDATER_PUBKEY before preparing updater channels.",
    );
  }

  const tauriConfigPath = resolve(rootDir, "src-tauri/tauri.conf.json");
  const tauriConfig = JSON.parse(readFileSync(tauriConfigPath, "utf8"));
  tauriConfig.plugins ??= {};
  tauriConfig.plugins.updater ??= {};
  tauriConfig.plugins.updater.channels = channels;
  tauriConfig.plugins.updater.pubkey = pubkey;
  writeFileSync(tauriConfigPath, `${JSON.stringify(tauriConfig, null, 2)}\n`);

  return {
    tauriConfigPath,
    channels,
    pubkey,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = prepareUpdaterConfig();
    process.stdout.write(
      `Configured updater channels in ${result.tauriConfigPath}: ${Object.keys(result.channels).join(", ")}\n`,
    );
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
