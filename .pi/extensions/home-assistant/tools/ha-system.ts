/**
 * Home Assistant system information tool.
 *
 * Read-only system info: supervisor, host, OS, network, resolution center, resources, docker.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "@earendil-works/pi-ai";
import { StringEnum } from "@earendil-works/pi-ai";
import { supervisorApi } from "../lib/supervisor.js";
import { renderMarkdownResult, renderToolCall } from "../lib/format.js";
import { readFileSync } from "fs";

export function registerSystemTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "ha_system",
    label: "HA System",
    description: `View HA system information. Actions: info, host, os, network, resolution, resources, docker. Use ha_tool_docs('ha_system') for full usage.`,

    parameters: Type.Object({
      action: StringEnum(
        ["info", "host", "os", "network", "resolution", "resources", "docker"] as const,
        { description: "Action to perform" }
      ),
    }),


    renderCall(args: Record<string, unknown>, theme: any) {
      return renderToolCall("HA System", args, theme);
    },

    renderResult(result: any) {
      return renderMarkdownResult(result);
    },

    async execute(toolCallId, params, signal, onUpdate, ctx) {
      const result = await executeAction(params.action);
      return { content: [{ type: "text" as const, text: result }] };
    },
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function getSystemResources(): string {
  let uptimeStr = "Unknown";
  try {
    const uptimeSec = parseFloat(readFileSync("/proc/uptime", "utf8").split(" ")[0]);
    const days = Math.floor(uptimeSec / (24 * 3600));
    const hours = Math.floor((uptimeSec % (24 * 3600)) / 3600);
    const minutes = Math.floor((uptimeSec % 3600) / 60);
    uptimeStr = `${days}d ${hours}h ${minutes}m`;
  } catch (err) {
    uptimeStr = `Error: ${(err as Error).message}`;
  }

  let loadStr = "Unknown";
  try {
    const loadParts = readFileSync("/proc/loadavg", "utf8").trim().split(" ");
    loadStr = `1m: ${loadParts[0]}, 5m: ${loadParts[1]}, 15m: ${loadParts[2]}`;
  } catch (err) {
    loadStr = `Error: ${(err as Error).message}`;
  }

  let memStr = "Unknown";
  let swapStr = "Unknown";
  try {
    const meminfo = readFileSync("/proc/meminfo", "utf8");
    const getVal = (key: string) => {
      const match = meminfo.match(new RegExp(`${key}:\\s+(\\d+)\\s+kB`));
      return match ? parseInt(match[1]) * 1024 : 0;
    };
    const total = getVal("MemTotal");
    const free = getVal("MemFree");
    const available = getVal("MemAvailable") || (free + getVal("Cached") + getVal("Buffers"));
    const used = total - available;
    const pct = total > 0 ? ((used / total) * 100).toFixed(1) : "0";

    const swapTotal = getVal("SwapTotal");
    const swapFree = getVal("SwapFree");
    const swapUsed = swapTotal - swapFree;
    const swapPct = swapTotal > 0 ? ((swapUsed / swapTotal) * 100).toFixed(1) : "0";

    memStr = `${formatBytes(used)} / ${formatBytes(total)} (${pct}% used, ${formatBytes(available)} available)`;
    swapStr = swapTotal > 0 
      ? `${formatBytes(swapUsed)} / ${formatBytes(swapTotal)} (${swapPct}% used)`
      : "None";
  } catch (err) {
    memStr = `Error: ${(err as Error).message}`;
  }

  return [
    "## Host Resources",
    "",
    `- **Uptime:** ${uptimeStr}`,
    `- **Load Average:** ${loadStr}`,
    `- **Memory (RAM):** ${memStr}`,
    `- **Swap:** ${swapStr}`
  ].join("\n");
}

async function getDockerStats(): Promise<string> {
  const d = await supervisorApi<Record<string, any>>("/addons");
  const addons = (d.addons || []) as Array<Record<string, any>>;
  const installed = addons.filter((a) => a.installed);

  const statsPromises = installed.map(async (a) => {
    if (a.state !== "started") {
      return {
        name: a.name,
        slug: a.slug,
        state: a.state,
        cpu: 0,
        memUsed: 0,
        memLimit: 0,
        memPct: 0,
        netRx: 0,
        netTx: 0,
      };
    }
    try {
      const s = await supervisorApi<Record<string, any>>(`/addons/${a.slug}/stats`);
      return {
        name: a.name,
        slug: a.slug,
        state: a.state,
        cpu: s.cpu_percent || 0,
        memUsed: s.memory_usage || 0,
        memLimit: s.memory_limit || 0,
        memPct: s.memory_percent || 0,
        netRx: s.network_rx || 0,
        netTx: s.network_tx || 0,
      };
    } catch (err) {
      return {
        name: a.name,
        slug: a.slug,
        state: a.state,
        error: (err as Error).message,
      };
    }
  });

  const results = await Promise.all(statsPromises);
  
  const rows = [
    "## Add-on Stats (Docker containers)",
    "",
    "| Add-on | State | CPU % | Memory | Network RX / TX |",
    "|--------|-------|-------|--------|-----------------|"
  ];

  for (const r of results) {
    if ("error" in r && r.error) {
      rows.push(`| ${r.name} | 🔴 error | - | Error: ${r.error} | - |`);
    } else {
      const stateIcon = r.state === "started" ? "🟢" : "⚪";
      if (r.state === "started") {
        const memLimitStr = r.memLimit ? ` / ${formatBytes(r.memLimit)}` : "";
        const memPctStr = r.memPct ? ` (${r.memPct.toFixed(1)}%)` : "";
        rows.push(
          `| ${r.name} | ${stateIcon} ${r.state} | ${r.cpu.toFixed(1)}% | ${formatBytes(r.memUsed)}${memLimitStr}${memPctStr} | ${formatBytes(r.netRx)} / ${formatBytes(r.netTx)} |`
        );
      } else {
        rows.push(`| ${r.name} | ${stateIcon} ${r.state} | - | - | - |`);
      }
    }
  }

  return rows.join("\n");
}

async function executeAction(action: string): Promise<string> {
  switch (action) {
    case "info": {
      const d = await supervisorApi<Record<string, unknown>>("/supervisor/info");
      const rows = [
        "## Supervisor Info",
        "",
        "| Property | Value |",
        "|----------|-------|",
        `| Version | ${d.version} |`,
        `| Channel | ${d.channel} |`,
        `| Architecture | ${d.arch} |`,
        `| Supported | ${d.supported ? "✅" : "❌"} |`,
        `| Healthy | ${d.healthy ? "✅" : "❌"} |`,
      ];
      if (d.update_available) rows.push(`| Update available | ${d.version_latest} |`);
      rows.push(`| Timezone | ${d.timezone} |`);
      rows.push(`| Logging | ${d.logging} |`);
      return rows.join("\n");
    }

    case "host": {
      const d = await supervisorApi<Record<string, unknown>>("/host/info");
      const rows = [
        "## Host Info",
        "",
        "| Property | Value |",
        "|----------|-------|",
        `| Hostname | ${d.hostname} |`,
        `| Operating System | ${d.operating_system} |`,
        `| Kernel | ${d.kernel} |`,
        `| CPUs | ${d.cpe ?? "?"} |`,
      ];
      if (d.disk_total) rows.push(`| Disk | ${formatBytes(d.disk_used as number)} / ${formatBytes(d.disk_total as number)} used |`);
      if (d.disk_free) rows.push(`| Disk free | ${formatBytes(d.disk_free as number)} |`);
      if (Array.isArray(d.features) && d.features.length) rows.push(`| Features | ${d.features.join(", ")} |`);
      return rows.join("\n");
    }

    case "os": {
      const d = await supervisorApi<Record<string, unknown>>("/os/info");
      const rows = [
        "## HAOS Info",
        "",
        "| Property | Value |",
        "|----------|-------|",
        `| Version | ${d.version} |`,
      ];
      if (d.update_available) rows.push(`| Update available | ${d.version_latest} |`);
      rows.push(`| Board | ${d.board} |`);
      rows.push(`| Boot slot | ${d.boot_slot ?? d.boot ?? "?"} |`);
      if (d.data_disk) rows.push(`| Data disk | ${d.data_disk} |`);
      return rows.join("\n");
    }

    case "network": {
      const d = await supervisorApi<Record<string, unknown>>("/network/info");
      const interfaces = d.interfaces as Array<Record<string, unknown>> | undefined;
      if (!interfaces?.length) return "No network interfaces found.";

      const parts = ["## Network Interfaces", ""];
      for (const iface of interfaces) {
        parts.push(`### ${iface.interface ?? iface.name ?? "?"} (${iface.type ?? "?"})`);
        parts.push("");
        parts.push("| Property | Value |");
        parts.push("|----------|-------|");
        if (iface.enabled !== undefined) parts.push(`| Enabled | ${iface.enabled} |`);
        if (iface.connected !== undefined) parts.push(`| Connected | ${iface.connected} |`);
        const ipv4 = iface.ipv4 as Record<string, unknown> | undefined;
        if (ipv4?.address) parts.push(`| IPv4 | ${Array.isArray(ipv4.address) ? ipv4.address.join(", ") : ipv4.address} |`);
        if (ipv4?.gateway) parts.push(`| Gateway | ${ipv4.gateway} |`);
        if (ipv4?.nameservers) parts.push(`| DNS | ${Array.isArray(ipv4.nameservers) ? ipv4.nameservers.join(", ") : ipv4.nameservers} |`);
        parts.push("");
      }
      return parts.join("\n");
    }

    case "resolution": {
      const d = await supervisorApi<Record<string, unknown>>("/resolution/info");
      const issues = d.issues as Array<Record<string, unknown>> | undefined;
      const suggestions = d.suggestions as Array<Record<string, unknown>> | undefined;
      const unhealthy = d.unhealthy as string[] | undefined;
      const unsupported = d.unsupported as string[] | undefined;

      const parts = ["**Resolution Center**", ""];

      if (unhealthy?.length) {
        parts.push(`❌ **Unhealthy reasons:** ${unhealthy.join(", ")}`);
      }
      if (unsupported?.length) {
        parts.push(`⚠️ **Unsupported reasons:** ${unsupported.join(", ")}`);
      }

      if (issues?.length) {
        parts.push("", `**Issues (${issues.length}):**`);
        for (const i of issues) {
          parts.push(`- [${i.type}] ${i.context}: ${i.reference ?? ""} ${i.uuid ? `(${i.uuid})` : ""}`);
        }
      } else {
        parts.push("✅ No issues found.");
      }

      if (suggestions?.length) {
        parts.push("", `**Suggestions (${suggestions.length}):**`);
        for (const s of suggestions) {
          parts.push(`- [${s.type}] ${s.context}: ${s.reference ?? ""} ${s.uuid ? `(${s.uuid})` : ""}`);
        }
      }

      return parts.join("\n");
    }

    case "resources": {
      return getSystemResources();
    }

    case "docker": {
      return await getDockerStats();
    }

    default:
      throw new Error(`Unknown action '${action}'.`);
  }
}
