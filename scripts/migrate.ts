// Dry-run uses an isolated copy of the complete source, never the live directory.
import {
  mkdtempSync,
  existsSync,
  readFileSync,
  copyFileSync,
  rmSync,
  mkdirSync,
} from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
const source = resolve(process.env.DATA_DIR || "data");
if (!existsSync(join(source, "data.json"))) {
  console.log("未找到旧版 data.json，无需迁移。");
  process.exit(0);
}
const apply = process.argv.includes("--apply");
const target = apply ? source : mkdtempSync(join(tmpdir(), "cmdb-migrate-"));
if (!apply) copyFileSync(join(source, "data.json"), join(target, "data.json"));
process.env.DATA_DIR = target;
try {
  const { sqlite } = await import("../apps/api/src/db/index.js");
  const report = sqlite
    .prepare("SELECT value FROM metadata WHERE key='legacy_import'")
    .get() as { value: string } | undefined;
  const migration = report ? JSON.parse(report.value) : null;
  console.log(
    JSON.stringify(
      {
        mode: apply ? "已应用" : "预检（未修改原始数据）",
        counts: migration?.counts,
        warnings: migration?.warnings || [],
        backup: apply ? migration?.backup : "临时副本中已验证原始备份",
      },
      null,
      2,
    ),
  );
  console.log(
    "关系校验：",
    (sqlite.pragma("foreign_key_check") as unknown[]).length === 0
      ? "通过"
      : "失败",
  );
  sqlite.close();
} finally {
  if (!apply) rmSync(target, { recursive: true, force: true });
}
