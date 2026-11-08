/**
 * tool_call guards for pi's built-in tools (ported from upstream dkmaker/hass-pi-agent):
 *   - bash timeout: default 60s, hard cap 600s (pi has no default timeout)
 *   - filesystem write-guard for write/edit/bash (see write-guard.ts)
 *   - /write-allow slash command so the USER can unblock paths at runtime
 *     (slash commands can't be invoked by the agent itself)
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  getMode, isWriteAllowed, resolveWritePath, checkBashCommand, blockReason,
  readUserAllow, writeUserAllow, USER_ALLOW_FILE,
} from "./write-guard.js";

const BASH_DEFAULT_TIMEOUT_S = 60;
const BASH_MAX_TIMEOUT_S = 600;

export function registerToolGuards(pi: ExtensionAPI): void {
  pi.on("tool_call", async (event, ctx) => {
    // pi applies in-place mutations of tool_call.input before running the tool.
    if (event.toolName === "bash") {
      const input = event.input as { timeout?: number };
      const t = typeof input.timeout === "number" && Number.isFinite(input.timeout) && input.timeout > 0
        ? input.timeout
        : BASH_DEFAULT_TIMEOUT_S;
      input.timeout = Math.min(t, BASH_MAX_TIMEOUT_S);
    }

    const mode = getMode();
    if (mode === "off") return;

    const cwd = ctx?.cwd || process.cwd();
    let target: string | undefined;
    if (event.toolName === "write" || event.toolName === "edit") {
      const p = (event.input as { path?: string }).path;
      if (p) {
        const abs = resolveWritePath(p, cwd);
        if (!isWriteAllowed(abs)) target = abs;
      }
    } else if (event.toolName === "bash") {
      const res = checkBashCommand((event.input as { command?: string }).command || "", cwd);
      if (!res.allowed) target = res.blocked[0];
    }

    if (!target) return;
    if (mode === "warn") {
      console.error(`[write-guard] would block write to ${target} (warn mode)`);
      return;
    }
    return { block: true, reason: blockReason(target) };
  });

  pi.registerCommand("write-allow", {
    description: "Write-guard: list allowed paths, allow one (/write-allow www/**) or remove one (/write-allow remove www/**)",
    handler: async (args, ctx) => {
      const parts = (args || "").trim().split(/\s+/).filter(Boolean);
      const current = readUserAllow();

      if (parts.length === 0) {
        const fromOption = (process.env.PI_WRITE_GUARD_ALLOW || "").split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
        const lines = [
          `Write-guard mode: ${getMode()}`,
          `Allowed via /write-allow: ${current.length ? current.join(", ") : "(none)"}`,
          `Allowed via add-on option write_guard_allow: ${fromOption.length ? fromOption.join(", ") : "(none)"}`,
          "Always allowed: configuration.yaml and files it !includes; anything outside /homeassistant.",
          "Usage: /write-allow <glob>   e.g. /write-allow www/**",
          "       /write-allow remove <glob>",
        ];
        ctx.ui.notify(lines.join("\n"), "info");
        return;
      }

      if (parts[0] === "remove" || parts[0] === "rm") {
        const glob = parts[1];
        if (!glob || !current.includes(glob)) {
          ctx.ui.notify(`Not in the /write-allow list: ${glob ?? "(missing glob)"}`, "warning");
          return;
        }
        writeUserAllow(current.filter((g) => g !== glob));
        ctx.ui.notify(`Write-guard: removed ${glob}`, "info");
        return;
      }

      const glob = parts[0].replace(/^\/homeassistant\//, "").replace(/^\.\//, "");
      if (glob.startsWith("/") || glob.includes("..")) {
        ctx.ui.notify("Use a path relative to /homeassistant, e.g. www/** or custom_components/my_integration/**", "warning");
        return;
      }
      writeUserAllow([...current, glob]);
      ctx.ui.notify(`Write-guard: the agent may now write to /homeassistant/${glob} (saved in ${USER_ALLOW_FILE}). Ask it to retry.`, "info");
    },
  });
}
