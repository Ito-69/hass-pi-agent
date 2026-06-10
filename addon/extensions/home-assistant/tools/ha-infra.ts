/**
 * Home Assistant infrastructure health tool.
 *
 * Ping hosts, check LLM server status, perform scan of known network hosts.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "@earendil-works/pi-ai";
import { StringEnum } from "@earendil-works/pi-ai";
import { supervisorApi } from "../lib/supervisor.js";
import { renderMarkdownResult, renderToolCall } from "../lib/format.js";
import { createConnection } from "net";

export function registerInfraTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "ha_infra",
    label: "HA Infra",
    description: "Monitor local network infrastructure, ping hosts, and check LLM server status. Actions: ping, llm_status, scan.",

    parameters: Type.Object({
      action: StringEnum(
        ["ping", "llm_status", "scan"] as const,
        { description: "Action to perform" }
      ),
      targets: Type.Optional(Type.String({
        description: "Comma-separated list of host:port or name=host:port targets (only for ping action)"
      }))
    }),

    renderCall(args: Record<string, unknown>, theme: any) {
      return renderToolCall("HA Infra", args, theme);
    },

    renderResult(result: any) {
      return renderMarkdownResult(result);
    },

    async execute(toolCallId, params, signal, onUpdate, ctx) {
      let result = "";
      if (params.action === "ping") {
        const targets = params.targets || process.env.INFRA_HOSTS || "llama.cpp=192.168.68.50:8080";
        result = await handlePingAction(targets);
      } else if (params.action === "llm_status") {
        result = await checkLlmStatus();
      } else if (params.action === "scan") {
        result = await performScan();
      }
      return { content: [{ type: "text" as const, text: result }] };
    }
  });
}

function tcpPing(host: string, port: number, timeoutMs = 3000): Promise<{ success: boolean; latency?: number; error?: string }> {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = createConnection({ host, port, timeout: timeoutMs });
    
    socket.on("connect", () => {
      const latency = Date.now() - start;
      socket.destroy();
      resolve({ success: true, latency });
    });

    socket.on("error", (err) => {
      socket.destroy();
      resolve({ success: false, error: err.message });
    });

    socket.on("timeout", () => {
      socket.destroy();
      resolve({ success: false, error: "timeout" });
    });
  });
}

async function handlePingAction(targetsStr: string): Promise<string> {
  const parts = ["## Ping Results", ""];
  const targets = targetsStr.split(",").map((s) => s.trim()).filter(Boolean);
  
  for (const target of targets) {
    let name = target;
    let hostPort = target;
    if (target.includes("=")) {
      const idx = target.indexOf("=");
      name = target.substring(0, idx);
      hostPort = target.substring(idx + 1);
    }
    
    const colonIdx = hostPort.lastIndexOf(":");
    if (colonIdx === -1) {
      parts.push(`- **${name}:** ⚠️ Invalid format (missing port). Format: host:port or name=host:port`);
      continue;
    }
    const host = hostPort.substring(0, colonIdx);
    const port = parseInt(hostPort.substring(colonIdx + 1));
    
    const pingRes = await tcpPing(host, port);
    if (pingRes.success) {
      parts.push(`- **${name}** (\`${host}:${port}\`): 🟢 Online (latency: ${pingRes.latency}ms)`);
    } else {
      parts.push(`- **${name}** (\`${host}:${port}\`): ❌ Offline (error: ${pingRes.error})`);
    }
  }
  
  return parts.join("\n");
}

async function checkLlmStatus(): Promise<string> {
  const apiBase = process.env.OPENAI_API_BASE || "http://192.168.68.50:8080/v1";
  const url = apiBase.endsWith("/") ? `${apiBase}models` : `${apiBase}/models`;
  
  try {
    const res = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY || "dummy"}`
      },
      signal: AbortSignal.timeout(3000)
    });
    if (!res.ok) {
      return `❌ Llama.cpp server at \`${apiBase}\` returned HTTP ${res.status}: ${res.statusText}`;
    }
    const data = await res.json() as any;
    const models = data.data || [];
    if (!models.length) {
      return `⚠️ Llama.cpp server at \`${apiBase}\` reachable but returned 0 models.`;
    }
    const modelNames = models.map((m: any) => `\`${m.id}\``).join(", ");
    return `🟢 Llama.cpp server at \`${apiBase}\` is healthy.\n**Available models:** ${modelNames}`;
  } catch (err) {
    return `❌ Llama.cpp server at \`${apiBase}\` is unreachable: ${(err as Error).message}`;
  }
}

async function performScan(): Promise<string> {
  const parts = ["# Infrastructure Scan", ""];

  // 1. HA Supervisor
  try {
    const start = Date.now();
    await supervisorApi("/supervisor/ping");
    const latency = Date.now() - start;
    parts.push(`- **HA Supervisor:** 🟢 Online (${latency}ms)`);
  } catch (err) {
    parts.push(`- **HA Supervisor:** ❌ Offline: ${(err as Error).message}`);
  }

  // 2. llama.cpp / Local LLM Server
  const llmRes = await checkLlmStatus();
  parts.push(`- **LLM Server:** ${llmRes}`);

  // 3. Custom hosts from INFRA_HOSTS
  const infraHosts = process.env.INFRA_HOSTS || "llama.cpp=192.168.68.50:8080";
  if (infraHosts) {
    parts.push("", "### Network Hosts");
    const targets = infraHosts.split(",").map((s) => s.trim()).filter(Boolean);
    for (const target of targets) {
      let name = target;
      let hostPort = target;
      if (target.includes("=")) {
        const idx = target.indexOf("=");
        name = target.substring(0, idx);
        hostPort = target.substring(idx + 1);
      }
      
      const colonIdx = hostPort.lastIndexOf(":");
      if (colonIdx === -1) {
        parts.push(`- **${name}:** ⚠️ Invalid host format (missing port)`);
        continue;
      }
      const host = hostPort.substring(0, colonIdx);
      const port = parseInt(hostPort.substring(colonIdx + 1));
      
      const pingRes = await tcpPing(host, port);
      if (pingRes.success) {
        parts.push(`- **${name}** (\`${host}:${port}\`): 🟢 Online (${pingRes.latency}ms)`);
      } else {
        parts.push(`- **${name}** (\`${host}:${port}\`): ❌ Offline (${pingRes.error})`);
      }
    }
  }

  return parts.join("\n");
}
