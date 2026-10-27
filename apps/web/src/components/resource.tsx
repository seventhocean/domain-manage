import {
  Box,
  Check,
  Cloud,
  Copy,
  Database,
  ExternalLink,
  Globe2,
  HardDrive,
  KeyRound,
  Layers,
  Server,
  Shapes,
} from "lucide-react";
import { useState } from "react";
import type { Resource, ResourceType } from "../../../../packages/contracts";
import { lifecycleLabels, typeLabels } from "../../../../packages/contracts";
const icons = {
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
export function ResourceIcon({ type }: { type: ResourceType }) {
  const Icon = icons[type];
  return (
    <span className="resource-icon">
      <Icon size={18} strokeWidth={1.6} />
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
