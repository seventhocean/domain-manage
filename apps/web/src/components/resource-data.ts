import type { Resource } from "../../../../packages/contracts";
import { typeLabels } from "../../../../packages/contracts";

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

// Geography is derived only from a recorded region, never from a resource name.
export function flagForRegion(region: string): string {
  const regions: Array<[RegExp, string]> = [
    [/(?:\b(?:hk|hong\s*kong)\b|香港)/i, "🇭🇰"],
    [/(?:\b(?:cn|china|beijing|shanghai|guangzhou)\b|中国|国内|广州|上海|北京)/i, "🇨🇳"],
    [/(?:\b(?:us|usa|united\s*states|los\s*angeles)\b|美国|美西|美东|洛杉矶|圣何塞)/i, "🇺🇸"],
    [/(?:\b(?:jp|japan|tokyo)\b|东京|日本)/i, "🇯🇵"],
    [/(?:\b(?:sg|singapore)\b|新加坡)/i, "🇸🇬"],
    [/(?:\b(?:tw|taiwan)\b|台湾)/i, "🇹🇼"],
    [/(?:\b(?:kr|korea|seoul)\b|韩国|首尔)/i, "🇰🇷"],
    [/(?:\b(?:de|germany|frankfurt)\b|德国|法兰克福)/i, "🇩🇪"],
    [/(?:\b(?:eu|europe)\b|欧洲)/i, "🇪🇺"],
  ];
  return regions.find(([pattern]) => pattern.test(region))?.[1] || "";
}

function observedSpecs(details: Record<string, unknown>): string {
  const explicit = text(details.specs);
  if (explicit) return explicit;
  const snapshot = record(details.komari);
  const cpuName = text(details.cpu_name) || text(snapshot.cpu_name);
  const cores = details.cpu_cores ?? snapshot.cpu_cores;
  const memory = details.mem_total ?? snapshot.mem_total;
  const parts = [cpuName];
  if (typeof cores === "number" && Number.isInteger(cores) && cores > 0)
    parts.push(`${cores} 核`);
  if (typeof memory === "number" && Number.isFinite(memory) && memory > 0) {
    const gib = memory / (1024 ** 3);
    parts.push(`${Number(gib.toFixed(2))} GiB 内存`);
  }
  return parts.filter(Boolean).join(" · ");
}

function proxyLabel(details: Record<string, unknown>): string | undefined {
  if (typeof details.proxied === "boolean")
    return details.proxied ? "已代理" : "仅 DNS";
  const records = Array.isArray(details.cf_records)
    ? details.cf_records.map(record).filter((item) =>
      ["A", "AAAA", "CNAME"].includes(text(item.type)),
    )
    : [];
  if (!records.length || records.some((item) => typeof item.proxied !== "boolean"))
    return undefined;
  const proxied = records.filter((item) => item.proxied === true).length;
  if (proxied === records.length) return "已代理";
  return proxied ? "部分代理" : "仅 DNS";
}

export function getCardFacts(resource: Resource) {
  const details = record(resource.details);
  const snapshot = record(details.komari);
  const region = text(details.region) ||
    (resource.type === "host" ? text(snapshot.region) : "");
  const provider = resource.type === "domain"
    ? text(details.dns_provider) || (text(details.cf_zone_id) ? "Cloudflare" : "")
    : text(details.provider);
  return {
    brandTag: typeLabels[resource.type],
    providerLabel: [provider, region].filter(Boolean).join(" · ") || undefined,
    flag: region ? flagForRegion(region) || undefined : undefined,
    specs: resource.type === "host" ? observedSpecs(details) || undefined : undefined,
    proxyLabel: resource.type === "domain" ? proxyLabel(details) : undefined,
  };
}

function normalizeIp(value: string): string | undefined {
  const address = value.trim().replace(/^\[([a-f\d:.]+)\]$/i, "$1");
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(address)) {
    // Reject shorthand and octal-looking addresses; do not reinterpret legacy text.
    return address.split(".").every((part) =>
      String(Number(part)) === part && Number(part) <= 255,
    ) ? address : undefined;
  }
  if (!address.includes(":") || !/^[a-f\d:.]+$/i.test(address)) return undefined;
  try {
    return new URL(`http://[${address}]/`).hostname.slice(1, -1);
  } catch {
    return undefined;
  }
}

export function getSshConnection(ip: unknown, sshPort: unknown) {
  const entries = text(ip).split(",").map((entry) => entry.trim()).filter(Boolean);
  const address = entries.map(normalizeIp).find(Boolean);
  if (!address) return undefined;
  const portMissing = sshPort === undefined || sshPort === null ||
    typeof sshPort === "string" && sshPort.trim() === "";
  const rawPort = portMissing ? "22" : typeof sshPort === "number" ? String(sshPort) : text(sshPort);
  if (!/^\d+$/.test(rawPort)) return undefined;
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return undefined;
  // Only validated IP literals and decimal ports reach the shell command.
  return {
    address,
    port,
    multipleAddresses: entries.length > 1,
    defaultPort: portMissing,
    command: `ssh -p ${port} root@${address}`,
  };
}
