#!/usr/bin/env node
// Compatibility entry: safe preflight by default; never runs the historical lossy migration.
import { existsSync } from "node:fs";
if (!existsSync(new URL("./dist/scripts/migrate.js", import.meta.url))) {
  console.error(
    "请先运行 npm run build，然后使用 npm run migrate（默认预检）。",
  );
  process.exit(1);
}
await import("./dist/scripts/migrate.js");
