/**
 * Filesystem write-guard — a pragmatic guardrail (NOT a security sandbox).
 *
 * Ported from upstream dkmaker/hass-pi-agent and adapted to this add-on, where
 * the agent's cwd is /homeassistant itself. Allowed write targets under
 * /homeassistant:
 *   1. configuration.yaml and every file reachable from it via !include*
 *   2. declared !include targets (even before they exist)
 *   3. anything inside !include_dir_* directories
 *   4. extra globs from the shipped write-guard.json + add-on option write_guard_allow
 *
 * Users can also allow paths at runtime with the /write-allow slash command;
 * those globs live in /homeassistant/.pi-agent/write-allow.json (itself NOT
 * writable by the agent's built-in tools, so the agent can't unblock itself).
 *
 * Anything else under /homeassistant (.storage, secrets.yaml, custom_components,
 * ...) is blocked for the built-in write/edit tools and for OBVIOUS bash write
 * patterns. Paths outside /homeassistant (/tmp, /share, /data, ...) are out of
 * scope and always pass. Custom ha_* tools are never gated (they have their own
 * sanctioned IO + pre-mutation backups).
 */
import { resolve, dirname, relative, isAbsolute, join } from "node:path";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { HA_CONFIG_PATH } from "./config.js";
import { resolveYamlIncludes } from "./graph/yaml-resolver.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_YAML = join(HA_CONFIG_PATH, "configuration.yaml");

export type WriteGuardMode = "strict" | "warn" | "off";

export function getMode(): WriteGuardMode {
  const raw = process.env.PI_WRITE_GUARD_MODE?.trim().toLowerCase();
  if (raw === "off" || raw === "warn" || raw === "strict") return raw;
  // No explicit mode: only protect a live config inside the add-on container
  // (s6 is present there). In local dev the guard stays off.
  return existsSync("/run/s6/container_environment") ? "strict" : "off";
}

// ── glob matching (minimal) ──────────────────────────────────
function globToRe(glob: string): RegExp {
  let g = glob.trim().replace(/^\.?\//, "");
  if (g.endsWith("/")) g += "**";
  const re = g
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "\u0000")
    .replace(/\*/g, "[^/]*")
    .replace(/\u0000/g, ".*")
    .replace(/\?/g, "[^/]");
  return new RegExp("^" + re + "$");
}

/** Runtime allowlist managed by the user via /write-allow (no restart needed). */
export const USER_ALLOW_FILE = join(HA_CONFIG_PATH, ".pi-agent", "write-allow.json");

export function readUserAllow(): string[] {
  try {
    const j = JSON.parse(readFileSync(USER_ALLOW_FILE, "utf-8"));
    return Array.isArray(j.allow) ? j.allow.filter((x: unknown) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function writeUserAllow(globs: string[]): void {
  mkdirSync(dirname(USER_ALLOW_FILE), { recursive: true });
  writeFileSync(USER_ALLOW_FILE, JSON.stringify({ allow: [...new Set(globs)] }, null, 2) + "\n", "utf-8");
}

/** Glob to suggest for a blocked path: its top-level folder, or the file itself. */
export function suggestGlob(absPath: string): string {
  const rel = relative(resolve(HA_CONFIG_PATH), resolve(absPath)).split("\\").join("/");
  const top = rel.split("/")[0];
  return rel.includes("/") ? `${top}/**` : rel;
}

function loadExtraGlobs(): RegExp[] {
  const patterns: string[] = [];
  try {
    const j = JSON.parse(readFileSync(join(__dirname, "..", "write-guard.json"), "utf-8"));
    if (Array.isArray(j.allow)) patterns.push(...j.allow.filter((x: unknown) => typeof x === "string"));
  } catch { /* no shipped file — fine */ }
  const user = (process.env.PI_WRITE_GUARD_ALLOW || "").split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
  patterns.push(...user, ...readUserAllow());
  return patterns.map(globToRe);
}

// ── allowlist (resolved fresh on every check, so new includes count) ──
export interface AllowSet {
  root: string;
  files: Set<string>;
  dirPrefixes: string[];
  globs: RegExp[];
}

export function buildAllowSet(): AllowSet {
  const files = new Set<string>([resolve(CONFIG_YAML)]);
  const dirPrefixes: string[] = [];
  if (existsSync(CONFIG_YAML)) {
    const { sources, includeFiles, includeDirs } = resolveYamlIncludes(CONFIG_YAML);
    for (const s of sources) files.add(resolve(s.path));
    for (const f of includeFiles) files.add(resolve(f));
    for (const d of includeDirs) dirPrefixes.push(resolve(d));
  }
  return { root: resolve(HA_CONFIG_PATH), files, dirPrefixes, globs: loadExtraGlobs() };
}

function isUnder(child: string, parent: string): boolean {
  const r = relative(parent, child);
  return r === "" || (!r.startsWith("..") && !isAbsolute(r));
}

/** Resolve a (possibly relative) write path against the agent's cwd. */
export function resolveWritePath(p: string, cwd: string = process.cwd()): string {
  const expanded = p.startsWith("~/") ? join(process.env.HOME || "/root", p.slice(2)) : p;
  return isAbsolute(expanded) ? resolve(expanded) : resolve(cwd, expanded);
}

export function isPathAllowed(absPath: string, set: AllowSet): boolean {
  const p = resolve(absPath);
  if (!isUnder(p, set.root)) return true; // out of scope
  if (set.files.has(p)) return true;
  for (const prefix of set.dirPrefixes) if (isUnder(p, prefix)) return true;
  const rel = relative(set.root, p).split("\\").join("/");
  for (const re of set.globs) if (re.test(rel)) return true;
  return false;
}

export function isWriteAllowed(absPath: string): boolean {
  return isPathAllowed(absPath, buildAllowSet());
}

// ── bash heuristics (obvious write patterns only) ───────────────
const SEG_SPLIT = /[;|]|&&|\|\||\n/;

export function extractBashWriteTargets(command: string): string[] {
  const targets: string[] = [];
  const push = (t?: string) => {
    if (!t) return;
    const tok = t.replace(/^["']|["']$/g, "");
    if (!tok || tok.startsWith("-") || tok.startsWith("&") || tok === "/dev/null") return;
    targets.push(tok);
  };
  for (const seg of command.split(SEG_SPLIT)) {
    for (const m of seg.matchAll(/\d*>>?\|?\s*("[^"]+"|'[^']+'|[^\s;|&>]+)/g)) push(m[1]);
    const tokens = seg.trim().split(/\s+/);
    if (tokens.length === 0) continue;
    const cmd = tokens[0].replace(/^.*\//, "");
    const args = tokens.slice(1);
    const nonFlag = args.filter((a) => !a.startsWith("-"));
    switch (cmd) {
      case "tee": case "rm": case "touch": case "mkdir": case "rmdir": case "truncate": case "unlink":
        nonFlag.forEach(push);
        break;
      case "sed":
        if (args.some((a) => a.startsWith("-i") || a === "--in-place")) push(nonFlag[nonFlag.length - 1]);
        break;
      case "mv": case "cp": case "install": case "ln":
        push(nonFlag[nonFlag.length - 1]);
        break;
      case "dd":
        for (const a of args) if (a.startsWith("of=")) push(a.slice(3));
        break;
    }
  }
  return targets;
}

export function checkBashCommand(command: string, cwd?: string): { allowed: boolean; blocked: string[] } {
  const blocked: string[] = [];
  const set = buildAllowSet();
  for (const t of extractBashWriteTargets(command)) {
    const abs = resolveWritePath(t, cwd);
    if (!isPathAllowed(abs, set)) blocked.push(abs);
  }
  return { allowed: blocked.length === 0, blocked };
}

export function blockReason(target: string): string {
  const glob = suggestGlob(target);
  return (
    `Write blocked by the Home Assistant write-guard: "${target}" is outside the allowed set. ` +
    `Under ${HA_CONFIG_PATH} the agent may only write configuration.yaml and files it !includes. ` +
    `Do NOT try to work around this block. For registry/state changes use the ha_* tools; ` +
    `for scratch files use /tmp. If this write is really needed, stop and tell the user ` +
    `that the write-guard blocked it, and that they can allow it by typing ` +
    `\`/write-allow ${glob}\` in the terminal (or by adding "${glob}" to the add-on ` +
    `option write_guard_allow), then ask you to retry.`
  );
}
