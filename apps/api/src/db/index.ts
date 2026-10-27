import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import {
  mkdirSync,
  existsSync,
  readFileSync,
  copyFileSync,
  chmodSync,
  writeFileSync,
  renameSync,
} from "node:fs";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";
import { encodeSetting } from "./secrets.js";

export const DATA_DIR = resolve(process.env.DATA_DIR || "data");
mkdirSync(DATA_DIR, { recursive: true });
for (const directory of ["screenshots", "covers", "backups", "icons"])
  mkdirSync(join(DATA_DIR, directory), { recursive: true });
export const sqlite = new Database(join(DATA_DIR, "panel.db"));
chmodSync(join(DATA_DIR, "panel.db"), 0o600);
sqlite.pragma("foreign_keys = ON");
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("busy_timeout = 5000");
const version = sqlite.pragma("user_version", { simple: true }) as number;
if (version > 1)
  throw new Error("数据版本高于应用支持版本，请使用匹配的应用镜像");
sqlite.transaction(() => {
  sqlite.exec(`
  CREATE TABLE IF NOT EXISTS resources (
    id TEXT PRIMARY KEY, type TEXT NOT NULL CHECK(type IN ('domain','host','service','database','storage','cloud','subscription','account','other')),
    name TEXT NOT NULL, purpose TEXT NOT NULL DEFAULT '', lifecycle TEXT NOT NULL DEFAULT 'active', notes TEXT NOT NULL DEFAULT '',
    tags TEXT NOT NULL DEFAULT '[]', management_url TEXT NOT NULL DEFAULT '', details TEXT NOT NULL DEFAULT '{}',
    revision INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
  );
  CREATE INDEX IF NOT EXISTS resources_type ON resources(type, deleted_at);
  CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, name TEXT NOT NULL, purpose TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS project_resources (project_id TEXT NOT NULL REFERENCES projects(id), resource_id TEXT NOT NULL REFERENCES resources(id), PRIMARY KEY(project_id,resource_id));
  CREATE TABLE IF NOT EXISTS hostnames (id TEXT PRIMARY KEY REFERENCES resources(id), name TEXT NOT NULL UNIQUE);
  CREATE TABLE IF NOT EXISTS service_hostnames (id TEXT NOT NULL DEFAULT (lower(hex(randomblob(16)))) UNIQUE, service_id TEXT NOT NULL REFERENCES resources(id), hostname_id TEXT NOT NULL REFERENCES hostnames(id), PRIMARY KEY(service_id,hostname_id));
  CREATE TABLE IF NOT EXISTS relations (id TEXT PRIMARY KEY, source_id TEXT NOT NULL REFERENCES resources(id), target_id TEXT NOT NULL REFERENCES resources(id), kind TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, CHECK(source_id <> target_id), UNIQUE(source_id,target_id,kind));
  CREATE TABLE IF NOT EXISTS deployments (id TEXT PRIMARY KEY, service_id TEXT NOT NULL REFERENCES resources(id), server_id TEXT NOT NULL REFERENCES resources(id), protocol TEXT NOT NULL, port TEXT NOT NULL DEFAULT '', path TEXT NOT NULL DEFAULT '', container TEXT NOT NULL DEFAULT '', environment TEXT NOT NULL DEFAULT 'production', notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(service_id,server_id,protocol,port,path,container,environment));
  CREATE TABLE IF NOT EXISTS endpoints (id TEXT PRIMARY KEY, service_id TEXT NOT NULL REFERENCES resources(id), hostname_id TEXT REFERENCES hostnames(id), url TEXT NOT NULL, label TEXT NOT NULL DEFAULT '', environment TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(service_id,url,environment));
  CREATE TABLE IF NOT EXISTS history (id TEXT PRIMARY KEY, resource_id TEXT NOT NULL REFERENCES resources(id), action TEXT NOT NULL, source TEXT NOT NULL, at TEXT NOT NULL, changes TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS history_resource ON history(resource_id,at);
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  PRAGMA user_version = 1;
  `);
})();
export const db = drizzle(sqlite);
export const timestamp = () => new Date().toISOString();
export const uid = () => randomUUID();

// The source file is never rewritten. Initial migration is one SQLite transaction.
export function migrateLegacy() {
  const file = join(DATA_DIR, "data.json");
  if (
    !existsSync(file) ||
    sqlite.prepare("SELECT 1 FROM metadata WHERE key='legacy_import'").get()
  )
    return;
  if (
    (
      sqlite.prepare("SELECT count(*) AS n FROM resources").get() as {
        n: number;
      }
    ).n
  )
    throw new Error(
      "SQLite 已有数据且旧台账未迁移，请先使用迁移预检处理，拒绝自动覆盖",
    );
  const raw = readFileSync(file, "utf8");
  const data = JSON.parse(raw);
  for (const key of ["services", "domains", "servers", "deployments"])
    if (data[key] !== undefined && !Array.isArray(data[key]))
      throw new Error(`旧数据 ${key} 必须为数组`);
  const report: {
    backup: string;
    counts: Record<string, number>;
    warnings: string[];
  } = { backup: "", counts: {}, warnings: [] };
  const backup = join(
    DATA_DIR,
    "backups",
    `legacy-${Date.now()}-${uid()}.json`,
  );
  copyFileSync(file, backup);
  chmodSync(backup, 0o600);
  report.backup = backup;
  sqlite.transaction(() => {
    const insert = sqlite.prepare(
      "INSERT INTO resources(id,type,name,purpose,lifecycle,notes,tags,management_url,details,revision,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,1,?,?)",
    );
    const host = sqlite.prepare("INSERT INTO hostnames(id,name) VALUES(?,?)");
    const link = sqlite.prepare(
      "INSERT OR IGNORE INTO service_hostnames(service_id,hostname_id) VALUES(?,?)",
    );
    const exists = (id: string, type: string) =>
      sqlite
        .prepare("SELECT 1 FROM resources WHERE id=? AND type=?")
        .get(id, type);
    const domainMap = new Map<string, string>();
    for (const [collection, type] of [
      ["domains", "domain"],
      ["servers", "host"],
      ["services", "service"],
    ]) {
      report.counts[collection] = (data[collection] || []).length;
      for (const old of data[collection] || []) {
        if (typeof old.id !== "string" || !old.id)
          throw new Error(`${collection} 存在缺少 ID 的旧记录`);
        const details = { ...old };
        delete details.id;
        const name = String(
          old.name || old.alias || old.domain || old.ip || "未命名资源",
        );
        const lifecycle = old.status === "stopped" ? "paused" : "active";
        if (type === "domain" && old.ip_address)
          details.address_source = "legacy_unverified";
        insert.run(
          old.id,
          type,
          name,
          String(old.purpose || ""),
          lifecycle,
          String(old.notes || ""),
          JSON.stringify(Array.isArray(old.tags) ? old.tags : []),
          "",
          JSON.stringify(details),
          old.created_at || timestamp(),
          old.updated_at || timestamp(),
        );
        if (type === "domain") {
          const domain = String(old.domain || "")
            .trim()
            .toLowerCase()
            .replace(/\.$/, "");
          if (!domain) throw new Error("旧域名为空，请先修正副本后重试");
          host.run(old.id, domain);
          domainMap.set(domain, old.id);
        }
      }
    }
    const ensureDomain = (name: string) => {
      const normalized = name.toLowerCase().replace(/\.$/, "");
      if (domainMap.has(normalized)) return domainMap.get(normalized)!;
      const id = uid();
      const time = timestamp();
      insert.run(
        id,
        "domain",
        normalized,
        "",
        "active",
        "",
        "[]",
        "",
        JSON.stringify({ domain: normalized, legacy_association: true }),
        time,
        time,
      );
      host.run(id, normalized);
      domainMap.set(normalized, id);
      return id;
    };
    for (const service of data.services || [])
      for (const domain of String(service.domain || "")
        .split(",")
        .map((d: string) => d.trim())
        .filter(Boolean))
        link.run(service.id, ensureDomain(domain));
    for (const domain of data.domains || [])
      for (const serviceId of domain.service_ids || []) {
        if (exists(serviceId, "service")) link.run(serviceId, domain.id);
        else
          report.warnings.push(
            `域名 ${domain.domain} 引用了不存在的服务 ${serviceId}，保留于旧字段`,
          );
      }
    const insertDep = sqlite.prepare(
      "INSERT OR IGNORE INTO deployments(id,service_id,server_id,protocol,port,path,container,environment,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?,'production',?,?,?)",
    );
    for (const dep of data.deployments || []) {
      if (
        !exists(dep.service_id, "service") ||
        !exists(dep.server_id, "host")
      ) {
        report.warnings.push(`部署 ${dep.id} 关联缺失，原记录保留于迁移报告`);
        continue;
      }
      insertDep.run(
        dep.id,
        dep.service_id,
        dep.server_id,
        dep.protocol || "https",
        String(dep.port || ""),
        dep.path || "",
        dep.container || "",
        dep.notes || "",
        dep.created_at || timestamp(),
        dep.updated_at || timestamp(),
      );
    }
    for (const [key, value] of Object.entries(data.settings || {})) {
      if (
        ["cf_api_token", "komari_api_key"].includes(key) &&
        value &&
        !process.env.CREDENTIAL_KEY
      ) {
        report.warnings.push(
          `${key} 未导入：请通过环境变量或配置 CREDENTIAL_KEY 后重设，原值保留在原始备份`,
        );
        continue;
      }
      sqlite
        .prepare("INSERT INTO settings(key,value) VALUES(?,?)")
        .run(key, encodeSetting(key, value));
    }
    // Sessions issued by the JSON implementation are deliberately invalidated.
    sqlite
      .prepare(
        "INSERT OR REPLACE INTO settings(key,value) VALUES('session_version',?)",
      )
      .run(JSON.stringify(uid()));
    sqlite
      .prepare("INSERT INTO metadata(key,value) VALUES('legacy_import',?)")
      .run(JSON.stringify({ at: timestamp(), ...report }));
  })();
  const reportFile = join(DATA_DIR, "backups", "migration-report.json");
  writeFileSync(reportFile + ".tmp", JSON.stringify(report, null, 2), {
    mode: 0o600,
  });
  renameSync(reportFile + ".tmp", reportFile);
}
migrateLegacy();
