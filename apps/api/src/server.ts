import express, { type ErrorRequestHandler } from "express";
import { existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { ZodError } from "zod";
import { createLegacyApp } from "../../../server.js";
import { registerRoutes } from "./modules/routes.js";
import { sqlite } from "./db/index.js";

const web = resolve("dist/web");
const app = createLegacyApp({
  publicMiddleware(app) {
    app.get("/healthz", (_req, res) => res.json({ ok: true }));
    app.use(
      "/assets",
      express.static(join(web, "assets"), { immutable: true, maxAge: "1y" }),
    );
    app.use("/assets", (_req, res) => res.status(404).end());
  },
  protectedRoutes: registerRoutes,
  serveFrontend(_req, res) {
    res.setHeader("Cache-Control", "no-store");
    if (existsSync(join(web, "index.html")))
      res.sendFile(join(web, "index.html"));
    else
      res
        .status(503)
        .type("text/plain")
        .send(
          "前端尚未构建，请运行 npm run build 或使用 npm run dev 的前端地址。",
        );
  },
});
app.use("/api", (_req, res) => res.status(404).json({ error: "接口不存在" }));
app.get("/{*path}", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.sendFile(join(web, "index.html"));
});
const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({
      error: error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("；"),
    });
    return;
  }
  const conflict =
    typeof error.code === "string" &&
    error.code.startsWith("SQLITE_CONSTRAINT");
  const status = error.status || (conflict ? 409 : 500);
  if (status >= 500) console.error("[request]", error.message);
  res.status(status).json({
    error:
      status >= 500
        ? "操作失败，请查看服务日志并重试"
        : conflict
          ? "记录重复或关联约束不满足"
          : error.message,
  });
};
app.use(errorHandler);
const port = Number(process.env.PORT || 3000);
const server = app.listen(port, process.env.HOST || "127.0.0.1", () =>
  console.log(`资源台已启动，端口 ${port}；数据存储 SQLite`),
);
let stopping = false;
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    server.close(() => {
      sqlite.close();
      process.exit(0);
    });
    setTimeout(() => {
      server.closeAllConnections();
      sqlite.close();
      process.exit(0);
    }, 10000).unref();
  });
