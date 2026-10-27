import { eq, isNull } from "drizzle-orm";
import { domainToASCII } from "node:url";
import { isIP } from "node:net";
import { db, sqlite, timestamp, uid } from "../db/index.js";
import { resources } from "../db/schema.js";
import {
  resourceInputSchema,
  type Resource,
  type ResourceInput,
  type Relation,
  type Deployment,
  type Endpoint,
  type HistoryEntry,
} from "../../../../packages/contracts/index.js";

export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const fail = (status: number, message: string): never => {
  throw new AppError(status, message);
};
const rowFor = (id: string) =>
  db.select().from(resources).where(eq(resources.id, id)).get();
export function getResource(
  id: string,
  includeDeleted = false,
): Resource | null {
  const row = rowFor(id);
  if (!row || (row.deleted_at && !includeDeleted)) return null;
  const project_ids = (
    sqlite
      .prepare("SELECT project_id FROM project_resources WHERE resource_id=?")
      .all(id) as { project_id: string }[]
  ).map((p) => p.project_id);
  return { ...row, project_ids };
}
export function listResources(includeDeleted = false): Resource[] {
  return (
    includeDeleted
      ? db.select().from(resources).all()
      : db.select().from(resources).where(isNull(resources.deleted_at)).all()
  ).map((row) => getResource(row.id, includeDeleted)!);
}
export function requireResource(id: string, type?: string) {
  const r = getResource(id);
  if (!r || (type && r.type !== type)) fail(404, "关联资源不存在或类型不匹配");
  return r!;
}
export function history(
  id: string,
  action: string,
  changes: Record<string, { before: unknown; after: unknown }>,
  source = "manual",
) {
  sqlite
    .prepare(
      "INSERT INTO history(id,resource_id,action,source,at,changes) VALUES(?,?,?,?,?,?)",
    )
    .run(uid(), id, action, source, timestamp(), JSON.stringify(changes));
}
function touch(
  id: string,
  action: string,
  changes: Record<string, { before: unknown; after: unknown }>,
  source = "manual",
) {
  sqlite
    .prepare("UPDATE resources SET revision=revision+1,updated_at=? WHERE id=?")
    .run(timestamp(), id);
  history(id, action, changes, source);
}
export function normalizeHostname(value: unknown): string {
  const name = domainToASCII(
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\.$/, ""),
  );
  if (
    !name ||
    name.length > 253 ||
    !name.includes(".") ||
    name
      .split(".")
      .some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))
  )
    fail(400, "请填写有效的完整域名，不包含协议或路径");
  return name;
}
function validateDetails(input: ResourceInput) {
  const details = { ...input.details };
  if (input.type === "domain")
    details.domain = normalizeHostname(details.domain);
  if (input.type === "host") {
    const ips = String(details.ip || "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    if (ips.some((ip) => !isIP(ip)))
      fail(400, "主机 IP 格式无效，多个 IP 请用逗号分隔");
    details.ip = [...new Set(ips)].join(", ");
  }
  for (const key of ["port", "ssh_port"])
    if (
      details[key] !== undefined &&
      details[key] !== "" &&
      details[key] !== null &&
      (!Number.isInteger(Number(details[key])) ||
        +String(details[key]) < 1 ||
        +String(details[key]) > 65535)
    )
      fail(400, "端口需在 1–65535 之间");
  if (JSON.stringify(details).length > 64000) fail(400, "资源扩展信息过大");
  return details;
}
export function saveResource(
  input: ResourceInput,
  id?: string,
  revision?: number,
  source = "manual",
): Resource {
  const parsed = resourceInputSchema.parse(input);
  return sqlite.transaction(() => {
    const before = id ? requireResource(id) : null;
    if (before && revision !== undefined && before.revision !== revision)
      fail(409, "这条资源已被其他页面更新，请重新加载后合并修改");
    if (before && before.type !== parsed.type)
      fail(400, "已建档资源的类型不可直接变更，请新建后迁移关联");
    for (const project of parsed.project_ids)
      if (!sqlite.prepare("SELECT 1 FROM projects WHERE id=?").get(project))
        fail(400, "项目不存在，请刷新项目列表");
    const details = validateDetails(parsed);
    if (parsed.type === "domain") {
      const duplicate = sqlite
        .prepare("SELECT id FROM hostnames WHERE name=? AND id<>?")
        .get(details.domain, id || "");
      if (duplicate) fail(409, "这个域名已经存在（含回收站），请使用现有记录");
    }
    const resourceId = id || uid(),
      time = timestamp();
    const fields = {
      ...parsed,
      tags: [...new Set(parsed.tags)],
      details,
      updated_at: time,
    };
    const { project_ids, ...columns } = fields;
    if (before)
      db.update(resources)
        .set({ ...columns, revision: before.revision + 1 })
        .where(eq(resources.id, resourceId))
        .run();
    else
      db.insert(resources)
        .values({ ...columns, id: resourceId, created_at: time, revision: 1 })
        .run();
    sqlite
      .prepare("DELETE FROM project_resources WHERE resource_id=?")
      .run(resourceId);
    for (const project of new Set(project_ids))
      sqlite
        .prepare(
          "INSERT INTO project_resources(project_id,resource_id) VALUES(?,?)",
        )
        .run(project, resourceId);
    if (parsed.type === "domain") {
      const oldHost = sqlite
        .prepare("SELECT name FROM hostnames WHERE id=?")
        .get(resourceId) as { name: string } | undefined;
      sqlite
        .prepare(
          "INSERT INTO hostnames(id,name) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name",
        )
        .run(resourceId, details.domain);
      if (oldHost && oldHost.name !== details.domain) {
        for (const binding of sqlite
          .prepare(
            "SELECT service_id FROM service_hostnames WHERE hostname_id=?",
          )
          .all(resourceId) as { service_id: string }[])
          touch(binding.service_id, "hostname_renamed", {
            hostname: { before: oldHost.name, after: details.domain },
          });
        // A renamed hostname cannot keep an endpoint URL referring to the old name.
        const endpoints = sqlite
          .prepare("SELECT id,url FROM endpoints WHERE hostname_id=?")
          .all(resourceId) as { id: string; url: string }[];
        for (const endpoint of endpoints) {
          const url = new URL(endpoint.url);
          url.hostname = String(details.domain);
          sqlite
            .prepare("UPDATE endpoints SET url=? WHERE id=?")
            .run(url.href, endpoint.id);
        }
        const freshDetails = { ...details };
        delete freshDetails.probe;
        db.update(resources)
          .set({ details: freshDetails })
          .where(eq(resources.id, resourceId))
          .run();
      }
    }
    const after = getResource(resourceId)!;
    const changes: Record<string, { before: unknown; after: unknown }> = {};
    for (const key of [
      "name",
      "purpose",
      "lifecycle",
      "notes",
      "tags",
      "management_url",
      "project_ids",
      "details",
    ] as const)
      if (JSON.stringify(before?.[key]) !== JSON.stringify(after[key]))
        changes[key] = { before: before?.[key] ?? null, after: after[key] };
    history(resourceId, before ? "updated" : "created", changes, source);
    return after;
  })();
}
export function trashResource(id: string, revision: number) {
  return sqlite.transaction(() => {
    const r = requireResource(id);
    if (r.revision !== revision) fail(409, "资源已更新，请刷新后再移入回收站");
    db.update(resources)
      .set({
        deleted_at: timestamp(),
        revision: r.revision + 1,
        updated_at: timestamp(),
      })
      .where(eq(resources.id, id))
      .run();
    history(id, "deleted", {
      lifecycle: { before: r.lifecycle, after: "回收站" },
    });
    return true;
  })();
}
export function restoreResource(id: string) {
  return sqlite.transaction(() => {
    const r = getResource(id, true);
    if (!r || !r.deleted_at) fail(404, "回收站中没有这条资源");
    db.update(resources)
      .set({
        deleted_at: null,
        revision: r!.revision + 1,
        updated_at: timestamp(),
      })
      .where(eq(resources.id, id))
      .run();
    history(id, "restored", {});
    return getResource(id)!;
  })();
}
export function getRelations(id?: string): Relation[] {
  const where = id ? " WHERE source_id=? OR target_id=?" : "";
  const args = id ? [id, id] : [];
  const explicit = sqlite
    .prepare("SELECT * FROM relations" + where)
    .all(...args) as Relation[];
  const hosts = sqlite
    .prepare(
      "SELECT id,service_id AS source_id,hostname_id AS target_id FROM service_hostnames" +
        (id ? " WHERE service_id=? OR hostname_id=?" : ""),
    )
    .all(...args) as { id: string; source_id: string; target_id: string }[];
  return [
    ...explicit,
    ...hosts.map((r) => ({
      ...r,
      kind: "uses_hostname" as const,
      notes: "服务与主机名关联",
      created_at: "",
      derived: false,
    })),
  ];
}
export function addRelation(input: Omit<Relation, "id" | "created_at">) {
  return sqlite.transaction(() => {
    const source = requireResource(input.source_id),
      target = requireResource(input.target_id);
    if (source.id === target.id) fail(400, "资源不能关联自身");
    let relationId: string = uid();
    if (input.kind === "uses_hostname") {
      if (source.type !== "service" || target.type !== "domain")
        fail(400, "主机名关联需从服务指向域名");
      const prior = sqlite
        .prepare(
          "SELECT id FROM service_hostnames WHERE service_id=? AND hostname_id=?",
        )
        .get(source.id, target.id) as { id: string } | undefined;
      if (prior) return prior.id;
      sqlite
        .prepare(
          "INSERT OR IGNORE INTO service_hostnames(service_id,hostname_id) VALUES(?,?)",
        )
        .run(source.id, target.id);
      relationId = (
        sqlite
          .prepare(
            "SELECT id FROM service_hostnames WHERE service_id=? AND hostname_id=?",
          )
          .get(source.id, target.id) as { id: string }
      ).id;
    } else {
      if (input.kind === "related_to" && source.id > target.id)
        [input.source_id, input.target_id] = [target.id, source.id];
      const prior = sqlite
        .prepare(
          "SELECT id FROM relations WHERE source_id=? AND target_id=? AND kind=?",
        )
        .get(input.source_id, input.target_id, input.kind) as
        { id: string } | undefined;
      if (prior) return prior.id;
      sqlite
        .prepare(
          "INSERT INTO relations(id,source_id,target_id,kind,notes,created_at) VALUES(?,?,?,?,?,?)",
        )
        .run(
          relationId,
          input.source_id,
          input.target_id,
          input.kind,
          input.notes,
          timestamp(),
        );
    }
    touch(source.id, "linked", {
      relation: {
        before: null,
        after: { kind: input.kind, target_id: target.id },
      },
    });
    touch(target.id, "linked", {
      relation: {
        before: null,
        after: { kind: input.kind, source_id: source.id },
      },
    });
    return relationId;
  })();
}
export function removeRelation(id: string) {
  return sqlite.transaction(() => {
    const special = sqlite
      .prepare(
        "SELECT service_id,hostname_id FROM service_hostnames WHERE id=?",
      )
      .get(id) as { service_id: string; hostname_id: string } | undefined;
    if (special) {
      if (
        sqlite
          .prepare(
            "SELECT 1 FROM endpoints WHERE service_id=? AND hostname_id=?",
          )
          .get(special.service_id, special.hostname_id)
      )
        fail(409, "该关联仍被访问入口使用，请先移除入口");
      sqlite.prepare("DELETE FROM service_hostnames WHERE id=?").run(id);
      touch(special.service_id, "unlinked", {});
      touch(special.hostname_id, "unlinked", {});
      return;
    }
    const row = sqlite
      .prepare("SELECT source_id,target_id FROM relations WHERE id=?")
      .get(id) as { source_id: string; target_id: string } | undefined;
    if (!row) fail(404, "关联不存在");
    sqlite.prepare("DELETE FROM relations WHERE id=?").run(id);
    touch(row!.source_id, "unlinked", {});
    touch(row!.target_id, "unlinked", {});
  })();
}
export function deployments(serviceId?: string) {
  return sqlite
    .prepare(
      "SELECT * FROM deployments" + (serviceId ? " WHERE service_id=?" : ""),
    )
    .all(...(serviceId ? [serviceId] : [])) as Deployment[];
}
export function saveDeployment(
  input: Omit<Deployment, "id" | "created_at" | "updated_at">,
  id?: string,
): Deployment {
  return sqlite.transaction(() => {
    requireResource(input.service_id, "service");
    const target = requireResource(input.server_id);
    if (!["host", "cloud"].includes(target.type))
      fail(400, "部署目标必须是主机或云托管资源");
    const old = id
      ? (sqlite.prepare("SELECT * FROM deployments WHERE id=?").get(id) as
          Deployment | undefined)
      : null;
    if (id && !old) fail(404, "部署记录不存在");
    const duplicate = sqlite
      .prepare(
        "SELECT * FROM deployments WHERE service_id=? AND server_id=? AND protocol=? AND port=? AND path=? AND container=? AND environment=? AND id<>?",
      )
      .get(
        input.service_id,
        input.server_id,
        input.protocol,
        input.port,
        input.path,
        input.container,
        input.environment,
        id || "",
      ) as Deployment | undefined;
    if (duplicate) return duplicate;
    const record = {
      ...input,
      id: id || uid(),
      created_at: old?.created_at || timestamp(),
      updated_at: timestamp(),
    };
    if (id)
      sqlite
        .prepare(
          "UPDATE deployments SET service_id=@service_id,server_id=@server_id,protocol=@protocol,port=@port,path=@path,container=@container,environment=@environment,notes=@notes,updated_at=@updated_at WHERE id=@id",
        )
        .run(record);
    else
      sqlite
        .prepare(
          "INSERT INTO deployments(id,service_id,server_id,protocol,port,path,container,environment,notes,created_at,updated_at) VALUES(@id,@service_id,@server_id,@protocol,@port,@path,@container,@environment,@notes,@created_at,@updated_at)",
        )
        .run(record);
    touch(input.service_id, "deployment_saved", {
      deployment: { before: old, after: record },
    });
    return record;
  })();
}
export function removeDeployment(id: string) {
  return sqlite.transaction(() => {
    const dep = sqlite
      .prepare("SELECT * FROM deployments WHERE id=?")
      .get(id) as Deployment | undefined;
    if (!dep) return false;
    sqlite.prepare("DELETE FROM deployments WHERE id=?").run(id);
    touch(dep.service_id, "deployment_removed", {
      deployment: { before: dep, after: null },
    });
    return true;
  })();
}
export function endpoints(id?: string) {
  return sqlite
    .prepare("SELECT * FROM endpoints" + (id ? " WHERE service_id=?" : ""))
    .all(...(id ? [id] : [])) as Endpoint[];
}
export function addEndpoint(
  input: Omit<Endpoint, "id" | "created_at" | "hostname_id">,
): Endpoint {
  return sqlite.transaction(() => {
    requireResource(input.service_id, "service");
    const url = new URL(input.url);
    url.hash = "";
    const existing = sqlite
      .prepare(
        "SELECT * FROM endpoints WHERE service_id=? AND url=? AND environment=?",
      )
      .get(input.service_id, url.href, input.environment) as
      Endpoint | undefined;
    if (existing) return existing;
    let hostname_id: string | null = null;
    if (!isIP(url.hostname.replace(/^\[|\]$/g, ""))) {
      const domain = normalizeHostname(url.hostname);
      let hostname = sqlite
        .prepare("SELECT id FROM hostnames WHERE name=?")
        .get(domain) as { id: string } | undefined;
      if (hostname) requireResource(hostname.id, "domain");
      else {
        const resource = saveResource(
          {
            type: "domain",
            name: domain,
            purpose: "",
            lifecycle: "active",
            notes: "",
            tags: [],
            management_url: "",
            project_ids: [],
            details: { domain },
          },
          undefined,
          undefined,
          "endpoint",
        );
        hostname = { id: resource.id };
      }
      hostname_id = hostname.id;
      addRelation({
        source_id: input.service_id,
        target_id: hostname_id,
        kind: "uses_hostname",
        notes: "",
      });
    }
    const row = {
      ...input,
      url: url.href,
      id: uid(),
      hostname_id,
      created_at: timestamp(),
    };
    sqlite
      .prepare(
        "INSERT INTO endpoints(id,service_id,hostname_id,url,label,environment,created_at) VALUES(@id,@service_id,@hostname_id,@url,@label,@environment,@created_at)",
      )
      .run(row);
    touch(input.service_id, "endpoint_added", {
      endpoint: { before: null, after: row },
    });
    return row;
  })();
}
export function removeEndpoint(id: string) {
  return sqlite.transaction(() => {
    const row = sqlite.prepare("SELECT * FROM endpoints WHERE id=?").get(id) as
      Endpoint | undefined;
    if (!row) fail(404, "入口不存在");
    sqlite.prepare("DELETE FROM endpoints WHERE id=?").run(id);
    touch(row!.service_id, "endpoint_removed", {
      endpoint: { before: row, after: null },
    });
  })();
}
export function resourceDetail(id: string) {
  return {
    resource: requireResource(id),
    relations: getRelations(id),
    deployments: deployments().filter(
      (d) => d.service_id === id || d.server_id === id,
    ),
    endpoints: endpoints(id),
    history: (
      sqlite
        .prepare(
          "SELECT * FROM history WHERE resource_id=? ORDER BY at DESC,rowid DESC LIMIT 100",
        )
        .all(id) as (Omit<HistoryEntry, "changes"> & { changes: string })[]
    ).map((row) => ({ ...row, changes: JSON.parse(row.changes) })),
  };
}
