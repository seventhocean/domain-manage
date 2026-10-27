// Compatibility API over the unified SQLite store. JSON is migration input only.
import { join } from "node:path";
import { encodeSetting, decodeSetting } from "./apps/api/src/db/secrets.js";
import { sqlite, DATA_DIR } from "./apps/api/src/db/index.js";
import {
  listResources,
  getResource,
  saveResource,
  trashResource,
  getRelations,
  addRelation,
  removeRelation,
  normalizeHostname,
  deployments,
  saveDeployment,
  removeDeployment,
} from "./apps/api/src/modules/resources.js";
import { deploymentInputSchema } from "./packages/contracts/index.js";

export const SCREENSHOTS_DIR = join(DATA_DIR, "screenshots");
export const COVERS_DIR = join(DATA_DIR, "covers");
const lifecycleStatus = {
  active: "running",
  paused: "stopped",
  retired: "stopped",
  archived: "stopped",
  planned: "maintenance",
};
function legacy(r) {
  if (!r) return null;
  const common = {
    ...r.details,
    id: r.id,
    name: r.name,
    notes: r.notes,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
  if (r.type === "service")
    return {
      ...common,
      status: lifecycleStatus[r.lifecycle],
      domain: getRelations(r.id)
        .filter((l) => l.kind === "uses_hostname" && l.source_id === r.id)
        .map((l) => getResource(l.target_id))
        .filter(Boolean)
        .map((d) => d.details.domain)
        .join(", "),
    };
  if (r.type === "domain")
    return {
      ...common,
      domain: r.details.domain,
      service_ids: getRelations(r.id)
        .filter(
          (l) =>
            l.kind === "uses_hostname" &&
            l.target_id === r.id &&
            getResource(l.source_id),
        )
        .map((l) => l.source_id),
    };
  return common;
}
const list = (type) =>
  listResources()
    .filter((r) => r.type === type)
    .map(legacy);
const get = (id, type) => {
  const r = getResource(id);
  return r?.type === type ? legacy(r) : null;
};
function save(type, patch, id) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch))
    throw Object.assign(new Error("请求内容必须为对象"), { status: 400 });
  return sqlite.transaction(() => {
    const before = id ? getResource(id) : null;
    if (id && before?.type !== type) return null;
    const allowed = {
      service: [
        "name",
        "notes",
        "cover_image",
        "screenshots",
        "domain",
        "status",
        "probe",
        "kind",
        "title",
        "auto_created",
      ],
      domain: [
        "domain",
        "alias",
        "ip_address",
        "dns_provider",
        "dns_status",
        "expiry_date",
        "ssl_status",
        "registrar",
        "notes",
        "service_ids",
        "brand_color",
        "probe",
        "cf_zone_id",
        "cf_records",
        "address_source",
      ],
      host: [
        "name",
        "provider",
        "ip",
        "ssh_port",
        "region",
        "notes",
        "komari_uuid",
        "komari",
      ],
    }[type];
    const clean = Object.fromEntries(
      Object.entries(patch).filter(([key]) => allowed.includes(key)),
    );
    const details = { ...(before?.details || {}), ...clean };
    delete details.service_ids;
    if (type === "service") delete details.domain;
    const name = String(
      clean.name ||
        clean.alias ||
        before?.name ||
        clean.domain ||
        clean.ip ||
        "未命名资源",
    );
    const status = clean.status;
    const resource = saveResource(
      {
        type,
        name,
        purpose: before?.purpose || "",
        notes: String(clean.notes ?? before?.notes ?? ""),
        lifecycle:
          status === "stopped"
            ? "paused"
            : status === "maintenance"
              ? "planned"
              : status === "running"
                ? "active"
                : before?.lifecycle || "active",
        tags: before?.tags || [],
        management_url: before?.management_url || "",
        project_ids: before?.project_ids || [],
        details,
      },
      id,
      before?.revision,
      "legacy-api",
    );
    if (type === "service" && typeof clean.domain === "string") {
      const desired = new Set(
        clean.domain
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean)
          .map(normalizeHostname),
      );
      for (const link of getRelations(resource.id).filter(
        (l) => l.kind === "uses_hostname" && l.source_id === resource.id,
      )) {
        const target = getResource(link.target_id);
        if (!target || !desired.has(String(target.details.domain)))
          removeRelation(link.id);
      }
      for (const domain of desired) {
        let target = listResources().find(
          (r) => r.type === "domain" && r.details.domain === domain,
        );
        if (!target)
          target = saveResource({
            type: "domain",
            name: domain,
            purpose: "",
            lifecycle: "active",
            notes: "",
            tags: [],
            management_url: "",
            project_ids: [],
            details: { domain, dns_status: "inactive" },
          });
        addRelation({
          source_id: resource.id,
          target_id: target.id,
          kind: "uses_hostname",
          notes: "",
        });
      }
    }
    if (type === "domain" && Array.isArray(clean.service_ids)) {
      const desired = new Set(clean.service_ids);
      for (const link of getRelations(resource.id).filter(
        (l) => l.kind === "uses_hostname" && l.target_id === resource.id,
      ))
        if (!desired.has(link.source_id)) removeRelation(link.id);
      for (const serviceId of desired)
        addRelation({
          source_id: serviceId,
          target_id: resource.id,
          kind: "uses_hostname",
          notes: "",
        });
    }
    return legacy(getResource(resource.id));
  })();
}
function remove(id, type) {
  const r = getResource(id);
  if (r?.type !== type) return false;
  return trashResource(id, r.revision);
}
export const getServices = () => list("service");
export const getService = (id) => get(id, "service");
export const createService = (input) => save("service", input);
export const updateService = (id, input) => save("service", input, id);
export const deleteService = (id) => remove(id, "service");
export const getDomains = () => list("domain");
export const getDomain = (id) => get(id, "domain");
export const createDomain = (input) => save("domain", input);
export const updateDomain = (id, input) => save("domain", input, id);
export const deleteDomain = (id) => remove(id, "domain");
export const getServers = () => list("host");
export const getServer = (id) => get(id, "host");
export const createServer = (input) => save("host", input);
export const updateServer = (id, input) => save("host", input, id);
export const deleteServer = (id) => remove(id, "host");
export function getDeployments(serviceId) {
  return deployments(serviceId).filter(
    (d) => getResource(d.service_id) && getResource(d.server_id),
  );
}
export function getDeployment(id) {
  return getDeployments().find((d) => d.id === id) || null;
}
export function createDeployment(input) {
  return saveDeployment(
    deploymentInputSchema.parse({
      service_id: input.service_id,
      server_id: input.server_id,
      port: String(input.port || ""),
      protocol: input.protocol || "https",
      path: input.path || "",
      container: input.container || "",
      environment: input.environment || "production",
      notes: input.notes || "",
    }),
  );
}
export function updateDeployment(id, patch) {
  const before = getDeployment(id);
  if (!before) return null;
  const { id: _, created_at, updated_at, ...input } = { ...before, ...patch };
  return saveDeployment(deploymentInputSchema.parse(input), id);
}
export const deleteDeployment = removeDeployment;
export function getSettings() {
  const settings = {};
  let unavailable = false;
  for (const row of sqlite.prepare("SELECT key,value FROM settings").all()) {
    try {
      settings[row.key] = decodeSetting(row.value);
    } catch {
      settings[row.key] = "";
      unavailable = true;
    }
  }
  return { ...settings, credential_unavailable: unavailable };
}
export function updateSettings(patch) {
  sqlite.transaction(() => {
    for (const [key, value] of Object.entries(patch))
      sqlite
        .prepare(
          "INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        )
        .run(key, encodeSetting(key, value));
  })();
  return getSettings();
}
export function getDashboardStats() {
  const services = getServices(),
    domains = getDomains(),
    servers = getServers();
  return {
    services: {
      total: services.length,
      running: services.filter((s) => s.status === "running").length,
    },
    domains: {
      total: domains.length,
      active: domains.filter((d) => d.dns_status === "active").length,
    },
    servers: { total: servers.length },
    expiring_soon: [],
    alerts: [],
  };
}
