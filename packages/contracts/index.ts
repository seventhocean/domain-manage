import { z } from "zod";

export const resourceTypes = [
  "domain",
  "host",
  "service",
  "database",
  "storage",
  "cloud",
  "subscription",
  "account",
  "other",
] as const;
export const typeLabels: Record<ResourceType, string> = {
  domain: "域名",
  host: "主机",
  service: "服务",
  database: "数据库",
  storage: "存储",
  cloud: "云资源",
  subscription: "订阅与 API",
  account: "平台账号",
  other: "其他资源",
};
export type ResourceType = (typeof resourceTypes)[number];
export const lifecycleLabels = {
  planned: "规划中",
  active: "使用中",
  paused: "已暂停",
  retired: "已退役",
  archived: "已归档",
};
export type Lifecycle = keyof typeof lifecycleLabels;
export const safeUrl = z
  .string()
  .max(2048)
  .refine((value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return (
        ["http:", "https:"].includes(url.protocol) &&
        !url.username &&
        !url.password
      );
    } catch {
      return false;
    }
  }, "请输入不含账号口令的 HTTP(S) 地址");
export const resourceInputSchema = z
  .object({
    type: z.enum(resourceTypes),
    name: z.string().trim().min(1, "请填写资源名称").max(120),
    purpose: z.string().max(500),
    lifecycle: z.enum(["planned", "active", "paused", "retired", "archived"]),
    notes: z.string().max(10000),
    tags: z.array(z.string().trim().min(1).max(32)).max(20),
    management_url: safeUrl,
    project_ids: z.array(z.string().min(1).max(100)).max(30),
    details: z.record(z.string().max(80), z.unknown()),
  })
  .strict();
export type ResourceInput = z.infer<typeof resourceInputSchema>;
export type Resource = ResourceInput & {
  id: string;
  revision: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};
export const resourceUpdateSchema = resourceInputSchema.extend({
  revision: z.number().int().positive(),
});
export const projectInputSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    purpose: z.string().max(1000),
  })
  .strict();
export type Project = z.infer<typeof projectInputSchema> & {
  id: string;
  resource_count: number;
  created_at: string;
};
export const relationInputSchema = z
  .object({
    source_id: z.string().min(1),
    target_id: z.string().min(1),
    kind: z.enum(["depends_on", "backs_up_to", "related_to", "uses_hostname"]),
    notes: z.string().max(1000),
  })
  .strict();
export type Relation = z.infer<typeof relationInputSchema> & {
  id: string;
  created_at: string;
  derived?: boolean;
};
export const deploymentInputSchema = z
  .object({
    service_id: z.string().min(1),
    server_id: z.string().min(1),
    protocol: z.enum(["http", "https", "tcp", "udp"]),
    port: z
      .string()
      .refine(
        (v) => !v || (/^\d+$/.test(v) && +v >= 1 && +v <= 65535),
        "端口需在 1–65535 之间",
      ),
    path: z.string().max(1000),
    container: z.string().max(120),
    environment: z.enum(["production", "staging", "development"]),
    notes: z.string().max(2000),
  })
  .strict();
export type Deployment = z.infer<typeof deploymentInputSchema> & {
  id: string;
  created_at: string;
  updated_at: string;
};
export const endpointInputSchema = z
  .object({
    service_id: z.string().min(1),
    url: safeUrl.refine(Boolean, "请填写入口地址"),
    label: z.string().max(120),
    environment: z.enum(["production", "staging", "development"]),
  })
  .strict();
export type Endpoint = z.infer<typeof endpointInputSchema> & {
  id: string;
  hostname_id: string | null;
  created_at: string;
};
export type HistoryEntry = {
  id: string;
  resource_id: string;
  action: string;
  source: string;
  at: string;
  changes: Record<string, { before: unknown; after: unknown }>;
};
export type ResourceDetail = {
  resource: Resource;
  relations: Relation[];
  deployments: Deployment[];
  endpoints: Endpoint[];
  history: HistoryEntry[];
};
export const relationLabels: Record<string, string> = {
  depends_on: "依赖",
  backs_up_to: "备份到",
  related_to: "关联",
  uses_hostname: "使用域名",
  deployed_on: "部署于",
};
