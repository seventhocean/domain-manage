import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  AtSign,
  BookOpen,
  Box,
  Check,
  Cloud,
  Code2,
  Copy,
  Cpu,
  Database,
  ExternalLink,
  FileCode,
  Film,
  FolderLock,
  Globe2,
  HardDrive,
  KeyRound,
  Layers,
  MessageSquare,
  Music,
  Radio,
  Server,
  Shapes,
  Shield,
  Sparkles,
  Terminal,
  Zap,
} from "lucide-react";
import React, { useState } from "react";
import { Link } from "react-router-dom";
import type { Resource, ResourceType } from "../../../../packages/contracts";
import { lifecycleLabels, typeLabels } from "../../../../packages/contracts";
import { flagForRegion, getCardFacts, getSshConnection } from "./resource-data";

const typeDefaultIcons = {
  domain: Globe2,
  host: Server,
  service: Box,
  database: Database,
  storage: HardDrive,
  cloud: Cloud,
  subscription: KeyRound,
  account: Layers,
  other: Shapes,
};

const typeTintColors: Record<ResourceType, string> = {
  domain: "#3B82F6", // blue
  host: "#8B5CF6", // purple
  service: "#6C5CE7", // indigo-violet
  database: "#F59E0B", // amber
  storage: "#EC4899", // pink
  cloud: "#06B6D4", // cyan
  subscription: "#10B981", // emerald
  account: "#6366F1", // indigo
  other: "#8B8F99", // muted
};

// Known self-hosted application brands and custom icon badges
interface BrandDef {
  name: string;
  color: string;
  bg: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  tag: string;
}

const BRAND_PATTERNS: Array<{ pattern: RegExp; def: BrandDef }> = [
  {
    pattern: /nextcloud/i,
    def: { name: "Nextcloud", color: "#FFFFFF", bg: "#0082c9", icon: Cloud, tag: "NC" },
  },
  {
    pattern: /komari/i,
    def: { name: "Komari", color: "#FFFFFF", bg: "#10b981", icon: Activity, tag: "KM" },
  },
  {
    pattern: /vaultwarden|bitwarden/i,
    def: { name: "Vaultwarden", color: "#FFFFFF", bg: "#175ddc", icon: Shield, tag: "VW" },
  },
  {
    pattern: /jellyfin/i,
    def: { name: "Jellyfin", color: "#FFFFFF", bg: "#aa5cc3", icon: Film, tag: "JF" },
  },
  {
    pattern: /emby/i,
    def: { name: "Emby", color: "#FFFFFF", bg: "#52b54b", icon: Film, tag: "EB" },
  },
  {
    pattern: /plex/i,
    def: { name: "Plex", color: "#FFFFFF", bg: "#e5a00d", icon: Film, tag: "PX" },
  },
  {
    pattern: /docker|portainer/i,
    def: { name: "Docker", color: "#FFFFFF", bg: "#2496ed", icon: Box, tag: "DK" },
  },
  {
    pattern: /青龙|qinglong/i,
    def: { name: "青龙面板", color: "#FFFFFF", bg: "#059669", icon: Terminal, tag: "QL" },
  },
  {
    pattern: /宝塔|bt[- ]?panel/i,
    def: { name: "宝塔面板", color: "#FFFFFF", bg: "#20a53a", icon: Cpu, tag: "BT" },
  },
  {
    pattern: /alist/i,
    def: { name: "AList", color: "#FFFFFF", bg: "#1890ff", icon: HardDrive, tag: "AL" },
  },
  {
    pattern: /cloudreve/i,
    def: { name: "Cloudreve", color: "#FFFFFF", bg: "#3f51b5", icon: Cloud, tag: "CR" },
  },
  {
    pattern: /immich/i,
    def: { name: "Immich", color: "#FFFFFF", bg: "#4250af", icon: Film, tag: "IM" },
  },
  {
    pattern: /navidrome/i,
    def: { name: "Navidrome", color: "#FFFFFF", bg: "#007acc", icon: Music, tag: "ND" },
  },
  {
    pattern: /uptime\s*kuma/i,
    def: { name: "Uptime Kuma", color: "#FFFFFF", bg: "#5cd87a", icon: Activity, tag: "UK" },
  },
  {
    pattern: /home\s*assistant/i,
    def: { name: "Home Assistant", color: "#FFFFFF", bg: "#18bcf2", icon: Radio, tag: "HA" },
  },
  {
    pattern: /openwrt|clash|mihomo|router/i,
    def: { name: "OpenWrt/网络", color: "#FFFFFF", bg: "#00b5e2", icon: Radio, tag: "RT" },
  },
  {
    pattern: /gitea|forgejo/i,
    def: { name: "Gitea", color: "#FFFFFF", bg: "#609926", icon: FileCode, tag: "GT" },
  },
  {
    pattern: /gitlab/i,
    def: { name: "GitLab", color: "#FFFFFF", bg: "#fc6d26", icon: FileCode, tag: "GL" },
  },
  {
    pattern: /nginx/i,
    def: { name: "Nginx", color: "#FFFFFF", bg: "#009639", icon: Radio, tag: "NX" },
  },
  {
    pattern: /cloudflare/i,
    def: { name: "Cloudflare", color: "#FFFFFF", bg: "#f38020", icon: Cloud, tag: "CF" },
  },
  {
    pattern: /minio/i,
    def: { name: "MinIO", color: "#FFFFFF", bg: "#c72c48", icon: HardDrive, tag: "MO" },
  },
  {
    pattern: /mysql|mariadb/i,
    def: { name: "MySQL", color: "#FFFFFF", bg: "#00758f", icon: Database, tag: "SQL" },
  },
  {
    pattern: /postgres/i,
    def: { name: "PostgreSQL", color: "#FFFFFF", bg: "#336791", icon: Database, tag: "PG" },
  },
  {
    pattern: /redis/i,
    def: { name: "Redis", color: "#FFFFFF", bg: "#d82c20", icon: Database, tag: "RD" },
  },
  // --- 常用平台账号 ---
  {
    pattern: /小红书|redbook/i,
    def: { name: "小红书", color: "#FFFFFF", bg: "#FF2442", tag: "RED" },
  },
  {
    pattern: /抖音|tiktok/i,
    def: { name: "抖音", color: "#FFFFFF", bg: "#FE2C55", tag: "DY" },
  },
  {
    pattern: /推特|twitter|\bx\b/i,
    def: { name: "推特/X", color: "#FFFFFF", bg: "#1DA1F2", tag: "X" },
  },
  {
    pattern: /nodeseek/i,
    def: { name: "NodeSeek", color: "#FFFFFF", bg: "#FF6600", tag: "NS" },
  },
  {
    pattern: /github/i,
    def: { name: "GitHub", color: "#FFFFFF", bg: "#24292F", tag: "GH" },
  },
  {
    pattern: /telegram|tg\b/i,
    def: { name: "Telegram", color: "#FFFFFF", bg: "#229ED9", tag: "TG" },
  },
  {
    pattern: /youtube/i,
    def: { name: "YouTube", color: "#FFFFFF", bg: "#FF0000", tag: "YT" },
  },
  {
    pattern: /bilibili|b站/i,
    def: { name: "Bilibili", color: "#FFFFFF", bg: "#00A1D6", tag: "BILI" },
  },
  // --- 大模型与买的各种 API ---
  {
    pattern: /openai|chatgpt/i,
    def: { name: "OpenAI", color: "#FFFFFF", bg: "#10A37F", tag: "OAI" },
  },
  {
    pattern: /claude|anthropic/i,
    def: { name: "Claude", color: "#FFFFFF", bg: "#D97706", tag: "CLD" },
  },
  {
    pattern: /deepseek/i,
    def: { name: "DeepSeek", color: "#FFFFFF", bg: "#4D6BFE", tag: "DS" },
  },
  {
    pattern: /gemini/i,
    def: { name: "Gemini", color: "#FFFFFF", bg: "#1A73E8", tag: "GEM" },
  },
];

const MONOGRAM_COLORS = [
  "#6C5CE7", // violet
  "#2563EB", // blue
  "#059669", // emerald
  "#D97706", // amber
  "#7C3AED", // purple
  "#0891B2", // cyan
  "#DB2777", // pink
  "#EA580C", // orange
];

function stringHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getTagStyle(tag: string): { bg: string; color: string; border: string } {
  const clean = tag.trim().toLowerCase();

  if (/建站|核心|主力/i.test(clean)) {
    return {
      bg: "rgba(16, 185, 129, 0.16)",
      color: "#34D399",
      border: "rgba(16, 185, 129, 0.4)",
    };
  }
  if (/代理|翻墙|科学|加速/i.test(clean)) {
    return {
      bg: "rgba(168, 85, 247, 0.18)",
      color: "#C084FC",
      border: "rgba(168, 85, 247, 0.45)",
    };
  }
  if (/香港|hk|港/i.test(clean)) {
    return {
      bg: "rgba(6, 182, 212, 0.16)",
      color: "#22D3EE",
      border: "rgba(6, 182, 212, 0.4)",
    };
  }
  if (/国内|上海|广州|北京|阿里|腾讯|火山/i.test(clean)) {
    return {
      bg: "rgba(244, 63, 94, 0.16)",
      color: "#FB7185",
      border: "rgba(244, 63, 94, 0.4)",
    };
  }
  if (/美西|美国|us|洛杉矶|圣何塞/i.test(clean)) {
    return {
      bg: "rgba(59, 130, 246, 0.16)",
      color: "#60A5FA",
      border: "rgba(59, 130, 246, 0.4)",
    };
  }
  if (/高防|安全|盾/i.test(clean)) {
    return {
      bg: "rgba(245, 158, 11, 0.16)",
      color: "#FBBF24",
      border: "rgba(245, 158, 11, 0.4)",
    };
  }
  if (/常用|生产|办公|自动化/i.test(clean)) {
    return {
      bg: "rgba(246, 130, 31, 0.16)",
      color: "#FB923C",
      border: "rgba(246, 130, 31, 0.4)",
    };
  }
  if (/闲置|测试|备用/i.test(clean)) {
    return {
      bg: "rgba(148, 163, 184, 0.16)",
      color: "#CBD5E1",
      border: "rgba(148, 163, 184, 0.35)",
    };
  }
  if (/自媒体|生活|分享/i.test(clean)) {
    return {
      bg: "rgba(236, 72, 153, 0.16)",
      color: "#F472B6",
      border: "rgba(236, 72, 153, 0.4)",
    };
  }
  if (/开源|代码|极客/i.test(clean)) {
    return {
      bg: "rgba(99, 102, 241, 0.16)",
      color: "#818CF8",
      border: "rgba(99, 102, 241, 0.4)",
    };
  }
  if (/ai|大模型|gpt|token/i.test(clean)) {
    return {
      bg: "rgba(217, 70, 239, 0.16)",
      color: "#E879F9",
      border: "rgba(217, 70, 239, 0.4)",
    };
  }

  const hues = [
    { bg: "rgba(99, 102, 241, 0.15)", color: "#A5B4FC", border: "rgba(99, 102, 241, 0.35)" },
    { bg: "rgba(14, 165, 233, 0.15)", color: "#7DD3FC", border: "rgba(14, 165, 233, 0.35)" },
    { bg: "rgba(16, 185, 129, 0.15)", color: "#6EE7B7", border: "rgba(16, 185, 129, 0.35)" },
    { bg: "rgba(245, 158, 11, 0.15)", color: "#FCD34D", border: "rgba(245, 158, 11, 0.35)" },
    { bg: "rgba(244, 63, 94, 0.15)", color: "#FDA4AF", border: "rgba(244, 63, 94, 0.35)" },
  ];
  return hues[stringHash(tag) % hues.length];
}

export function TagBadge({
  tag,
  size = "sm",
  onRemove,
  active,
  onClick,
}: {
  tag: string;
  size?: "sm" | "md";
  onRemove?: () => void;
  active?: boolean;
  onClick?: () => void;
}) {
  const style = getTagStyle(tag);
  return (
    <span
      className={`bento-tag ${size === "md" ? "bento-tag-md" : ""} ${active ? "active" : ""}`}
      style={{
        backgroundColor: style.bg,
        color: style.color,
        borderColor: style.border,
      }}
      onClick={onClick}
    >
      <span>{tag}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="bento-tag-del"
        >
          ×
        </button>
      )}
    </span>
  );
}

function getMonogram(name: string): { text: string; bg: string } {
  const clean = name.trim();
  if (!clean) return { text: "??", bg: "#6C5CE7" };
  const parts = clean.split(/[-_\s.]+/).filter(Boolean);
  let text = "";
  if (parts.length >= 2) {
    text = (parts[0][0] + parts[1][0]).toUpperCase();
  } else if (clean.length >= 2) {
    text = clean.slice(0, 2).toUpperCase();
  } else {
    text = clean.toUpperCase();
  }
  const colorIndex = stringHash(clean) % MONOGRAM_COLORS.length;
  return { text, bg: MONOGRAM_COLORS[colorIndex] };
}

export function ResourceIcon({
  type,
  name,
  resource,
  size = 18,
}: {
  type: ResourceType;
  name?: string;
  resource?: Resource;
  size?: number;
}) {
  const [imgError, setImgError] = useState(false);

  const candidateName = resource?.name || name || "";
  const probeKind = String(resource?.details?.probe_kind || "");
  const searchStr = `${candidateName} ${probeKind} ${resource?.purpose || ""}`;

  // 1. Check if probe or details has a custom favicon
  const faviconUrl = !imgError && resource?.details?.favicon
    ? String(resource.details.favicon)
    : "";

  if (faviconUrl) {
    return (
      <span className="resource-icon overflow-hidden bg-surface-2 border border-border">
        <img
          src={faviconUrl}
          alt=""
          className="w-full h-full object-contain p-1"
          onError={() => setImgError(true)}
        />
      </span>
    );
  }

  // 2. Check known brand match
  for (const { pattern, def } of BRAND_PATTERNS) {
    if (pattern.test(searchStr)) {
      const BrandIcon = def.icon || Box;
      return (
        <span
          className="resource-icon"
          style={{
            backgroundColor: `${def.bg}1f`,
            borderColor: `${def.bg}44`,
            color: def.bg,
          }}
          title={def.name}
        >
          <BrandIcon size={size} strokeWidth={1.8} />
        </span>
      );
    }
  }

  // 3. For services without brand match, use high-contrast monogram tile
  if (type === "service" && candidateName) {
    const mono = getMonogram(candidateName);
    return (
      <span
        className="resource-icon font-mono font-semibold"
        style={{
          backgroundColor: `${mono.bg}22`,
          borderColor: `${mono.bg}4f`,
          color: mono.bg,
          fontSize: "11px",
          letterSpacing: "-0.5px",
        }}
        title={candidateName}
      >
        {mono.text}
      </span>
    );
  }

  // 4. Default by type with subtle brand tint
  const DefaultIcon = typeDefaultIcons[type] || Box;
  const tint = typeTintColors[type] || "#8B8F99";

  return (
    <span
      className="resource-icon"
      style={{
        backgroundColor: `${tint}14`,
        borderColor: `${tint}2e`,
        color: tint,
      }}
    >
      <DefaultIcon size={size} strokeWidth={1.7} />
    </span>
  );
}

// Helper to determine the best card scene cover
export function getSceneCover(resource: Resource): string {
  if (resource.details?.cover_image) {
    return String(resource.details.cover_image);
  }
  const text = `${resource.name} ${resource.purpose} ${resource.type} ${JSON.stringify(resource.details)}`.toLowerCase();

  if (/media|jellyfin|emby|plex|immich|photo|music|video|stream|audio|movie/i.test(text)) {
    return "/art/cover-media-v1.png";
  }
  if (/storage|nextcloud|alist|minio|drive|disk|nas|pan|cloudreve|db|database|mysql|postgres|redis|sql/i.test(text)) {
    return "/art/cover-storage-v1.png";
  }
  if (/network|domain|gateway|route|openwrt|nginx|cf|cloudflare|dns|proxy|vpn|clash|frp/i.test(text)) {
    return "/art/cover-network-v1.png";
  }
  return "/art/cover-ops-v1.png";
}

export function getFlagEmoji(region: string): string {
  return flagForRegion(region);
}

export function ResourceBadge({
  label,
  color = "slate",
}: {
  label: string;
  color?: "green" | "purple" | "slate" | "amber";
}) {
  const colorMap = {
    green: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    purple: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    slate: "bg-slate-800 text-slate-300 border-slate-700/50",
    amber: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  };
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono border leading-none ${colorMap[color] || colorMap.slate}`}
    >
      {label}
    </span>
  );
}

export function Status({ value }: { value: Resource["lifecycle"] }) {
  return (
    <span className="status-label">
      <i className={`dot ${value}`} />
      {lifecycleLabels[value]}
    </span>
  );
}

export function CopyValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  return (
    <button
      className="copy-value"
      type="button"
      title={error ? "复制失败，请手动选择内容" : "复制"}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          setError(true);
        }
      }}
    >
      <span className="mono">{value || "—"}</span>
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

export function External({ url, label }: { url: string; label?: string }) {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol))
      return <span>地址无效</span>;
  } catch {
    return <span>未记录</span>;
  }
  return (
    <a
      className="external"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
    >
      {label || url}
      <ExternalLink size={13} />
    </a>
  );
}

export function primaryValue(resource: Resource) {
  return String(
    resource.details.domain ||
      resource.details.ip ||
      resource.details.address ||
      resource.details.plan ||
      typeLabels[resource.type],
  );
}

export function relativeTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "未知";
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins} 分钟前`;
  if (mins < 1440) return `${Math.floor(mins / 60)} 小时前`;
  return date.toLocaleDateString("zh-CN");
}

function getCardUrl(r: Resource): string {
  if (r.management_url) return r.management_url;
  const domain = String(r.details.domain || "").split(",")[0].trim();
  if (domain) {
    return domain.startsWith("http://") || domain.startsWith("https://")
      ? domain
      : `https://${domain}`;
  }
  const address = String(r.details.address || r.details.url || "");
  if (address) {
    return address.startsWith("http://") || address.startsWith("https://")
      ? address
      : `http://${address}`;
  }
  return "";
}

export interface CardTheme {
  gradient: string;
  accent: string;
  glowColor: string;
  flag?: string;
  providerLabel?: string;
  brandTag?: string;
  specs?: string;
  proxyLabel?: string;
}

function getCardPalette(resource: Resource): Pick<CardTheme, "gradient" | "accent" | "glowColor"> {
  const text = `${resource.name} ${resource.purpose} ${resource.notes || ""} ${JSON.stringify(resource.details || {})}`.toLowerCase();

  // 1. 社交与内容平台
  if (resource.type === "account" || /小红书|redbook/i.test(text)) {
    if (/小红书|redbook/i.test(text)) {
      return {
        gradient: "linear-gradient(135deg, #3D0811 0%, #881326 45%, #FF2442 100%)",
        accent: "#FF2442",
        glowColor: "rgba(255, 36, 66, 0.4)",
      };
    }
    if (/抖音|tiktok/i.test(text)) {
      return {
        gradient: "linear-gradient(135deg, #090A10 0%, #161823 45%, #1F1B3E 80%, #312E81 100%)",
        accent: "#FE2C55",
        glowColor: "rgba(254, 44, 85, 0.4)",
      };
    }
    if (/推特|twitter|\bx\b/i.test(text)) {
      return {
        gradient: "linear-gradient(135deg, #0A0A0C 0%, #18181D 55%, #272730 100%)",
        accent: "#FFFFFF",
        glowColor: "rgba(255, 255, 255, 0.2)",
      };
    }
    if (/nodeseek/i.test(text)) {
      return {
        gradient: "linear-gradient(135deg, #1C1917 0%, #431407 50%, #9A3412 80%, #EA580C 100%)",
        accent: "#F97316",
        glowColor: "rgba(249, 115, 22, 0.4)",
      };
    }
    if (/github/i.test(text)) {
      return {
        gradient: "linear-gradient(135deg, #0F172A 0%, #1E1B4B 50%, #4338CA 100%)",
        accent: "#818CF8",
        glowColor: "rgba(129, 140, 248, 0.4)",
      };
    }
    return {
      gradient: "linear-gradient(135deg, #1E1B4B 0%, #3730A3 50%, #4F46E5 100%)",
      accent: "#6366F1",
      glowColor: "rgba(99, 102, 241, 0.35)",
    };
  }

  // 2. 域名配色
  if (resource.type === "domain" || /domain|cloudflare|zone|dns/i.test(text)) {
    return {
      gradient: "linear-gradient(135deg, #2D1405 0%, #7C2D12 45%, #C2410C 80%, #F97316 100%)",
      accent: "#FB923C",
      glowColor: "rgba(249, 115, 22, 0.4)",
    };
  }

  // 3. 云服务器 / VPS
  if (resource.type === "host" || /vps|server|host|节点|主机/i.test(text)) {
    if (/wawo/i.test(text)) {
      return {
        gradient: "linear-gradient(135deg, #2A0845 0%, #581C87 45%, #7E22CE 80%, #A21CAF 100%)",
        accent: "#C084FC",
        glowColor: "rgba(192, 132, 252, 0.4)",
      };
    }
    if (/tyyun|炭云/i.test(text)) {
      if (/los|美西|美国/i.test(text)) {
        return {
          gradient: "linear-gradient(135deg, #0B192C 0%, #1E3E62 50%, #1E40AF 85%, #3B82F6 100%)",
          accent: "#60A5FA",
          glowColor: "rgba(96, 165, 250, 0.4)",
        };
      }
      return {
        gradient: "linear-gradient(135deg, #022C22 0%, #064E3B 50%, #047857 85%, #10B981 100%)",
        accent: "#34D399",
        glowColor: "rgba(52, 211, 153, 0.4)",
      };
    }
    if (/腾讯云|tencent/i.test(text)) {
      return {
        gradient: "linear-gradient(135deg, #082F49 0%, #0369A1 50%, #0284C7 85%, #38BDF8 100%)",
        accent: "#38BDF8",
        glowColor: "rgba(56, 189, 248, 0.4)",
      };
    }
    if (/火山|byte|字节/i.test(text)) {
      return {
        gradient: "linear-gradient(135deg, #042F2E 0%, #0F766E 50%, #0D9488 85%, #14B8A6 100%)",
        accent: "#2DD4BF",
        glowColor: "rgba(45, 212, 191, 0.4)",
      };
    }
    if (/阿里云|aliyun/i.test(text)) {
      return {
        gradient: "linear-gradient(135deg, #451A03 0%, #92400E 50%, #B45309 85%, #F59E0B 100%)",
        accent: "#FBBF24",
        glowColor: "rgba(251, 191, 36, 0.4)",
      };
    }
    if (/vmiss/i.test(text)) {
      return {
        gradient: "linear-gradient(135deg, #4C0519 0%, #881337 50%, #BE123C 85%, #F43F5E 100%)",
        accent: "#FB7185",
        glowColor: "rgba(251, 113, 133, 0.4)",
      };
    }
    if (/vmshell/i.test(text)) {
      return {
        gradient: "linear-gradient(135deg, #3B0764 0%, #581C87 50%, #7E22CE 85%, #A855F7 100%)",
        accent: "#C084FC",
        glowColor: "rgba(192, 132, 252, 0.4)",
      };
    }
    return {
      gradient: "linear-gradient(135deg, #111827 0%, #1F2937 50%, #374151 100%)",
      accent: "#9CA3AF",
      glowColor: "rgba(156, 163, 175, 0.25)",
    };
  }

  // 4. 自建在线服务
  if (resource.type === "service") {
    if (/komari/i.test(text)) {
      return {
        gradient: "linear-gradient(135deg, #022C22 0%, #047857 45%, #059669 80%, #10B981 100%)",
        accent: "#34D399",
        glowColor: "rgba(52, 211, 153, 0.4)",
      };
    }
    if (/ai|商店|winter/i.test(text)) {
      return {
        gradient: "linear-gradient(135deg, #311042 0%, #701A75 45%, #9D174D 80%, #DB2777 100%)",
        accent: "#F472B6",
        glowColor: "rgba(244, 114, 182, 0.4)",
      };
    }
    return {
      gradient: "linear-gradient(135deg, #1E1B4B 0%, #312E81 50%, #4338CA 100%)",
      accent: "#818CF8",
      glowColor: "rgba(129, 140, 248, 0.35)",
    };
  }

  // 5. 其他类型的中性暖色
  return {
    gradient: "linear-gradient(135deg, #1C1917 0%, #292524 50%, #44403C 100%)",
    accent: "#F59E0B",
    glowColor: "rgba(245, 158, 11, 0.35)",
  };
}

export function getCardTheme(resource: Resource): CardTheme {
  // Appearance can be inferred; provider, location and specifications cannot.
  return { ...getCardPalette(resource), ...getCardFacts(resource) };
}

export function CopyIconButton({
  value,
  label = "复制",
}: {
  value: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="bento-copy-btn"
      title={`${label} ${value}`}
      onClick={async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {}
      }}
    >
      {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
      <span>{copied ? "已复制" : label}</span>
    </button>
  );
}

export function SshCopyButton({ ip, port }: { ip: string; port?: unknown }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  const connection = getSshConnection(ip, port);
  if (!connection) return null;
  const description = [
    connection.multipleAddresses ? `使用首个有效 IP：${connection.address}` : connection.address,
    connection.defaultPort ? "未记录端口，使用默认 22" : `端口 ${connection.port}`,
  ].join("；");
  return (
    <button
      type="button"
      className="bento-copy-btn"
      title={error ? `复制失败，请手动复制：${connection.command}` : `复制 SSH 命令（${description}）：${connection.command}`}
      aria-label={`复制 SSH 命令，${description}`}
      onClick={async (e) => {
        e.stopPropagation();
        setError(false);
        try {
          await navigator.clipboard.writeText(connection.command);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          setError(true);
        }
      }}
    >
      <Terminal size={11} />
      <span>{copied ? "已复制" : error ? "复制失败" : connection.multipleAddresses ? "SSH · 首个 IP" : "SSH"}</span>
    </button>
  );
}

// 统一 Bento 数字资产展厅大卡片
export function ShowcaseCard({
  resource,
  onEdit,
}: {
  resource: Resource;
  onEdit?: (r: Resource) => void;
}) {
  const url = getCardUrl(resource);
  const theme = getCardTheme(resource);
  const customCover =
    resource.details?.cover_image &&
    !String(resource.details.cover_image).startsWith("/art/cover-")
      ? String(resource.details.cover_image)
      : null;

  const price = String(resource.details?.price || "");
  const ip = String(resource.details?.ip || resource.details?.address || "");
  const flag = theme.flag;

  return (
    <article className="bento-card group">
      {/* 16:9.5 沉浸式视觉头部 */}
      <div
        className="bento-hero"
        style={{
          background: customCover ? undefined : theme.gradient,
        }}
      >
        {customCover ? (
          <img
            src={customCover}
            alt={resource.name}
            className="bento-hero-img"
            loading="lazy"
          />
        ) : (
          /* 无截图时的专属动态设计微标 */
          <div className="bento-hero-ambient">
            <div
              className="bento-hero-glow"
              style={{ background: theme.glowColor }}
            />
            <div className="bento-hero-inner">
              <span className="bento-hero-tag">
                {theme.brandTag || typeLabels[resource.type]}
              </span>
              <h3 className="bento-hero-main-title">
                {resource.type === "domain"
                  ? String(resource.details?.domain || resource.name)
                  : resource.name}
              </h3>
              {theme.specs ? (
                <span className="bento-hero-subspecs">{theme.specs}</span>
              ) : theme.providerLabel ? (
                <span className="bento-hero-provider">{theme.providerLabel}</span>
              ) : null}
            </div>
          </div>
        )}

        {/* 顶部悬浮信息药丸 */}
        <div className="bento-hero-badges">
          <div className="bento-hero-badge-left">
            {flag && <span className="bento-flag-pill">{flag}</span>}
            <span className="bento-provider-pill" title={theme.providerLabel}>
              {theme.providerLabel || typeLabels[resource.type]}
            </span>
          </div>

          <div className="bento-hero-badge-right">
            {price && (
              <span className="bento-price-pill" title="周期资费">
                {price}
              </span>
            )}
            {theme.proxyLabel && (
              <span className="bento-cf-pill">
                <Cloud size={11} /> {theme.proxyLabel}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 卡片主体信息 */}
      <div className="bento-body">
        <header className="bento-body-header">
          <ResourceIcon type={resource.type} resource={resource} size={17} />
          <Link
            to={`/resources/${resource.id}`}
            className="bento-body-title"
            title={resource.name}
          >
            {resource.name}
          </Link>
          <Status value={resource.lifecycle} />
        </header>

        <p className="bento-purpose">
          {resource.purpose || primaryValue(resource) || "暂无用途描述"}
        </p>

        {/* 核心参数条（单 IP / 域名，带单点一键复制） */}
        {(ip || url) && (
          <div className="bento-param-row">
            <span className="bento-param-val" title={ip || url}>
              {ip || url.replace(/^https?:\/\//, "")}
            </span>
            <div className="bento-param-actions">
              <CopyIconButton value={ip || url} label="复制" />
              {resource.type === "host" && ip && <SshCopyButton ip={ip} port={resource.details.ssh_port} />}
            </div>
          </div>
        )}

        {/* 底部操作与标签 */}
        <footer className="bento-footer">
          <div className="bento-tags">
            {resource.tags.slice(0, 4).map((tag) => (
              <TagBadge key={tag} tag={tag} />
            ))}
          </div>

          <div className="bento-actions">
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="bento-launch-btn"
                title="在新标签页中打开"
              >
                <span>{resource.type === "account" ? "主页" : "直达"}</span>
                <ArrowUpRight size={13} />
              </a>
            )}
            <Link
              to={`/resources/${resource.id}`}
              className="bento-detail-btn"
            >
              详情
            </Link>
          </div>
        </footer>
      </div>
    </article>
  );
}
