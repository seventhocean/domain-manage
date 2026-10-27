import type { Express } from "express";
import { join } from "node:path";
import { chmodSync } from "node:fs";
import { sqlite, DATA_DIR, timestamp, uid } from "../db/index.js";
import {
  resourceInputSchema,
  resourceUpdateSchema,
  projectInputSchema,
  relationInputSchema,
  deploymentInputSchema,
  endpointInputSchema,
} from "../../../../packages/contracts/index.js";
import {
  listResources,
  getResource,
  saveResource,
  resourceDetail,
  trashResource,
  restoreResource,
  getRelations,
  addRelation,
  removeRelation,
  deployments,
  saveDeployment,
  removeDeployment,
  endpoints,
  addEndpoint,
  removeEndpoint,
  requireResource,
  fail,
} from "./resources.js";
function portableDetails(
  value: Record<string, unknown>,
  account = false,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([key]) =>
          !/(password|secret|token|api_key|authorization)/i.test(key) &&
          !(account && key === "login_identifier"),
      )
      .map(([key, item]) => [
        key,
        item && typeof item === "object" && !Array.isArray(item)
          ? portableDetails(item as Record<string, unknown>)
          : item,
      ]),
  );
}
export function registerRoutes(app: Express) {
  app.get("/api/cmdb/resources", (_req, res) => res.json(listResources()));
  app.get("/api/cmdb/trash", (_req, res) =>
    res.json(listResources(true).filter((r) => r.deleted_at)),
  );
  app.get("/api/cmdb/resources/:id", (req, res) =>
    res.json(resourceDetail(String(req.params.id))),
  );
  app.post("/api/cmdb/resources", (req, res) =>
    res.status(201).json(saveResource(resourceInputSchema.parse(req.body))),
  );
  app.put("/api/cmdb/resources/:id", (req, res) => {
    const { revision, ...input } = resourceUpdateSchema.parse(req.body);
    res.json(saveResource(input, String(req.params.id), revision));
  });
  app.delete("/api/cmdb/resources/:id", (req, res) => {
    if (!Number.isInteger(req.body?.revision)) fail(400, "请提供资源版本");
    trashResource(String(req.params.id), req.body.revision);
    res.json({ ok: true });
  });
  app.post("/api/cmdb/resources/:id/restore", (req, res) =>
    res.json(restoreResource(String(req.params.id))),
  );
  app.get("/api/cmdb/projects", (_req, res) =>
    res.json(
      sqlite
        .prepare(
          "SELECT p.*,count(CASE WHEN r.deleted_at IS NULL THEN r.id END) AS resource_count FROM projects p LEFT JOIN project_resources pr ON p.id=pr.project_id LEFT JOIN resources r ON r.id=pr.resource_id GROUP BY p.id ORDER BY p.created_at",
        )
        .all(),
    ),
  );
  app.post("/api/cmdb/projects", (req, res) => {
    const input = projectInputSchema.parse(req.body);
    const row = { ...input, id: uid(), created_at: timestamp() };
    sqlite
      .prepare(
        "INSERT INTO projects(id,name,purpose,created_at) VALUES(@id,@name,@purpose,@created_at)",
      )
      .run(row);
    res.status(201).json({ ...row, resource_count: 0 });
  });
  app.get("/api/cmdb/relations", (req, res) =>
    res.json(
      getRelations(
        typeof req.query.resource_id === "string"
          ? req.query.resource_id
          : undefined,
      ),
    ),
  );
  app.post("/api/cmdb/relations", (req, res) =>
    res
      .status(201)
      .json({ id: addRelation(relationInputSchema.parse(req.body)) }),
  );
  app.delete("/api/cmdb/relations/:id", (req, res) => {
    removeRelation(String(req.params.id));
    res.json({ ok: true });
  });
  app.get("/api/cmdb/deployments", (_req, res) => res.json(deployments()));
  app.post("/api/cmdb/deployments", (req, res) =>
    res.status(201).json(saveDeployment(deploymentInputSchema.parse(req.body))),
  );
  app.delete("/api/cmdb/deployments/:id", (req, res) => {
    if (!removeDeployment(String(req.params.id))) fail(404, "部署不存在");
    res.json({ ok: true });
  });
  app.post("/api/cmdb/endpoints", (req, res) =>
    res.status(201).json(addEndpoint(endpointInputSchema.parse(req.body))),
  );
  app.delete("/api/cmdb/endpoints/:id", (req, res) => {
    removeEndpoint(String(req.params.id));
    res.json({ ok: true });
  });
  app.post("/api/cmdb/discovery/accept", (req, res) => {
    const domain = requireResource(String(req.body?.domain_id), "domain");
    const host = requireResource(String(req.body?.server_id), "host");
    const probe = domain.details.probe as
      | {
          ok?: boolean;
          status?: number;
          scheme?: string;
          placeholder?: boolean;
          tls_invalid?: boolean;
          kind?: string;
        }
      | undefined;
    if (
      !probe?.ok ||
      !probe.status ||
      probe.status >= 400 ||
      probe.placeholder ||
      probe.tls_invalid
    )
      fail(400, "该域名尚未通过有效入口检查，请手工复核");
    const result = sqlite.transaction(() => {
      const existing = getRelations(domain.id).find(
        (r) =>
          r.kind === "uses_hostname" &&
          r.target_id === domain.id &&
          getResource(r.source_id),
      );
      if (existing) return requireResource(existing.source_id);
      const service = saveResource(
        {
          type: "service",
          name: String(req.body?.name || domain.name),
          purpose: "",
          lifecycle: "active",
          notes: "已确认的发现建议；内部部署端口待核实。",
          tags: [],
          management_url: "",
          project_ids: domain.project_ids,
          details: { kind: probe!.kind || "", auto_created: true },
        },
        undefined,
        undefined,
        "discovery-confirmed",
      );
      addEndpoint({
        service_id: service.id,
        url: `${probe!.scheme === "http" ? "http" : "https"}://${domain.details.domain}/`,
        label: "访问入口",
        environment: "production",
      });
      saveDeployment({
        service_id: service.id,
        server_id: host.id,
        protocol: probe!.scheme === "http" ? "http" : "https",
        port: "",
        path: "",
        container: "",
        environment: "production",
        notes: "根据 IP 匹配后由用户确认；内部端口未探测",
      });
      return requireResource(service.id);
    })();
    res.status(201).json(result);
  });
  app.get("/api/cmdb/export", (_req, res) => {
    const data = sqlite.transaction(() => ({
      schema_version: 1,
      exported_at: timestamp(),
      resources: listResources(true).map((resource) => ({
        ...resource,
        details: portableDetails(resource.details, resource.type === "account"),
      })),
      projects: sqlite.prepare("SELECT * FROM projects").all(),
      relations: getRelations(),
      deployments: deployments(),
      endpoints: endpoints(),
    }))();
    res.attachment(`cmdb-${Date.now()}.json`).json(data);
  });
  app.post("/api/cmdb/backups", async (_req, res) => {
    const name = `panel-${Date.now()}-${uid()}.db`;
    await sqlite.backup(join(DATA_DIR, "backups", name));
    chmodSync(join(DATA_DIR, "backups", name), 0o600);
    res
      .status(201)
      .json({ name, note: "数据库快照；附件与环境密钥需另行备份。" });
  });
  app.get("/api/cmdb/system", (_req, res) => {
    const migration = sqlite
      .prepare("SELECT value FROM metadata WHERE key='legacy_import'")
      .get() as { value: string } | undefined;
    res.json({
      version: "0.2.0",
      storage: "SQLite",
      schema_version: 1,
      resources: listResources().length,
      projects: (
        sqlite.prepare("SELECT count(*) AS n FROM projects").get() as {
          n: number;
        }
      ).n,
      migration: migration ? JSON.parse(migration.value) : null,
      backup_scope: "database",
      docker_ready: true,
    });
  });
}
