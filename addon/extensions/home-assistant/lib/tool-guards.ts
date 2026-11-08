/**
 * tool_call guards for pi's built-in tools (ported from upstream dkmaker/hass-pi-agent):
 *   - bash timeout: default 60s, hard cap 600s (pi has no default timeout)
 *   - filesystem write-guard for write/edit/bash (see write-guard.ts)
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getMode, isWriteAllowed, resolveWritePath, checkBashCommand, blockReason } from "./write-guard.js";

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
}
