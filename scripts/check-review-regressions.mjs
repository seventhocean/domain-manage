// Run with: node --import tsx scripts/check-review-regressions.mjs
// Uses its own temporary DATA_DIR and a loopback-only ephemeral HTTP server.
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { isIP } from "node:net";

const fixture = mkdtempSync(join(tmpdir(), "cmdb-regressions-"));
process.env.DATA_DIR = fixture;
process.env.AUTH_PASSWORD = randomBytes(24).toString("hex");
process.env.CF_API_TOKEN = "";
process.env.KOMARI_API_KEY = "";
process.env.CREDENTIAL_KEY = "";
let sqlite, server;
let checked = 0;
async function check(name, run) {
  await run();
  checked += 1;
  console.log(`通过：${name}`);
}

try {
  const { createLegacyApp } = await import("../server.js");
  ({ sqlite } = await import("../apps/api/src/db/index.ts"));
  const { registerRoutes } = await import("../apps/api/src/modules/routes.ts");
  const { saveResource } = await import("../apps/api/src/modules/resources.ts");
  const { resourceFormDefaults, resourceFormInput } = await import(
    "../apps/web/src/features/resources/form-state.ts"
  );
  const { getCardFacts, getSshConnection } = await import(
    "../apps/web/src/components/resource-data.ts"
  );

  for (const [id, name] of [["project-a", "示例项目 A"], ["project-b", "示例项目 B"]])
    sqlite.prepare("INSERT INTO projects(id,name,created_at) VALUES(?,?,?)")
      .run(id, name, new Date().toISOString());

  const domainValues = {
    ...resourceFormDefaults(undefined, "domain"),
    domain: "www.example.test",
    address: "203.0.113.5",
    managementUrl: "https://dns.example.test/console",
    name: "示例网站",
    lifecycle: "planned",
    projectIds: ["project-a"],
  };
  let domain;
  await check("域名标识、解析目标、管理地址分别持久化", () => {
    domain = saveResource(resourceFormInput(domainValues));
    assert.equal(domain.details.domain, "www.example.test");
    assert.equal(domain.details.ip_address, "203.0.113.5");
    assert.equal(domain.management_url, "https://dns.example.test/console");
    assert.equal(domain.name, "示例网站");
    assert.equal(sqlite.prepare("SELECT name FROM hostnames WHERE id=?").get(domain.id).name,
      "www.example.test");
  });
  await check("不同域名可指向同一个 IP", () => {
    const second = saveResource(resourceFormInput({
      ...domainValues, domain: "api.example.test", name: "示例 API",
    }));
    assert.equal(second.details.domain, "api.example.test");
    assert.equal(second.details.ip_address, domain.details.ip_address);
  });
  await check("有管理 URL 的域名可再次编辑，归属和生命周期可更新", () => {
    const values = {
      ...resourceFormDefaults(domain), purpose: "修改用途",
      projectIds: ["project-b"], lifecycle: "paused",
    };
    domain = saveResource(resourceFormInput(values, domain), domain.id, domain.revision);
    assert.equal(domain.details.domain, "www.example.test");
    assert.equal(domain.details.ip_address, "203.0.113.5");
    assert.equal(domain.purpose, "修改用途");
    assert.equal(domain.lifecycle, "paused");
    assert.deepEqual(domain.project_ids, ["project-b"]);
  });
  await check("有管理 URL 的主机可编辑且不覆盖 IP、配置和旧字段", () => {
    let host = saveResource({
      type: "host", name: "示例主机", purpose: "", lifecycle: "active", notes: "保留原备注 · 原配置",
      tags: [], management_url: "https://console.example.test/", project_ids: ["project-a"],
      details: { ip: "203.0.113.10, 2001:db8::10", provider: "真实供应商", price: 0,
        specs: "2C 2G", ssh_port: 2222, legacy: { keep: true } },
    });
    const details = host.details;
    const values = { ...resourceFormDefaults(host), purpose: "仅修改用途" };
    assert.equal(values.address, "203.0.113.10, 2001:db8::10");
    host = saveResource(resourceFormInput(values, host), host.id, host.revision);
    assert.deepEqual(host.details, details);
    assert.equal(host.management_url, "https://console.example.test/");
    assert.equal(host.notes, "保留原备注 · 原配置");
  });
  await check("服务入口修改不会覆盖已有主机名证据", () => {
    const service = saveResource({
      type: "service", name: "示例服务", purpose: "", lifecycle: "active", notes: "", tags: [],
      management_url: "https://old.example.test/", project_ids: [], details: { domain: "bound.example.test" },
    });
    const input = resourceFormInput({ ...resourceFormDefaults(service), address: "new.example.test" }, service);
    assert.equal(input.management_url, "https://new.example.test");
    assert.equal(input.details.domain, "bound.example.test");
  });
  await check("表单拒绝携带口令或非 HTTP(S) 的管理地址", () => {
    for (const url of ["https://user:password@example.test/", "javascript:alert(1)", "ftp://example.test/"])
      assert.throws(() => resourceFormInput({ ...domainValues, managementUrl: url }));
  });

  const exampleHost = {
    ...domain, type: "host", name: "腾讯云示例", notes: "", details: {
      provider: "腾讯云", region: "北京", specs: "2C 2G", ip: "203.0.113.10", ssh_port: 2222,
    },
  };
  await check("卡片仅展示已记录的地域与配置", () => {
    const facts = getCardFacts(exampleHost);
    assert.equal(facts.providerLabel, "腾讯云 · 北京");
    assert.equal(facts.specs, "2C 2G");
    const unknown = getCardFacts({ ...exampleHost, details: {} });
    assert.equal(unknown.providerLabel, undefined);
    assert.equal(unknown.specs, undefined);
    assert.equal(unknown.flag, undefined);
  });
  await check("域名不再统一声称 Cloudflare 和开启代理", () => {
    const facts = getCardFacts({ ...domain, details: { dns_provider: "Route53", proxied: false } });
    assert.equal(facts.providerLabel, "Route53");
    assert.equal(facts.proxyLabel, "仅 DNS");
    assert.equal(getCardFacts({ ...domain, details: {} }).proxyLabel, undefined);
    assert.equal(getCardFacts({ ...domain, details: { cf_records: [
      { type: "A", proxied: true }, { type: "AAAA", proxied: false },
    ] } }).proxyLabel, "部分代理");
  });
  await check("SSH 选择有效地址并使用记录的端口", () => {
    const ssh = getSshConnection("203.0.113.10, 203.0.113.11", 2222);
    assert.equal(ssh.command, "ssh -p 2222 root@203.0.113.10");
    assert.equal(ssh.multipleAddresses, true);
    assert.equal(getSshConnection("203.0.113.10", "").command, "ssh -p 22 root@203.0.113.10");
    const ipv6 = getSshConnection("[2001:db8::10]", "2200");
    assert.equal(isIP(ipv6.address), 6);
    assert.equal(ipv6.port, 2200);
  });
  await check("SSH 不把无效 IP、端口和命令片段带入 Shell", () => {
    for (const value of ["$(id)", "203.0.113.10;id", "203.0.113.999", "010.0.0.1", "example.test"])
      assert.equal(getSshConnection(value, 22), undefined);
    for (const port of ["22;id", 0, 65536, "2222.5", {}])
      assert.equal(getSshConnection("203.0.113.10", port), undefined);
  });

  const app = createLegacyApp({ protectedRoutes: registerRoutes });
  app.set("env", "test");
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  const login = await fetch(`${base}/api/auth/login`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ password: process.env.AUTH_PASSWORD }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64",
  );
  const uploadJson = (base64, authenticated = true) => fetch(`${base}/api/cmdb/upload`, {
    method: "POST", headers: { "content-type": "application/json", ...(authenticated ? { cookie } : {}) },
    body: JSON.stringify({ base64 }),
  });
  const uploadFile = (bytes, name, type) => {
    const form = new FormData();
    form.append("file", new Blob([bytes], { type }), name);
    return fetch(`${base}/api/cmdb/upload`, { method: "POST", headers: { cookie }, body: form });
  };
  await check("上传仍要求登录", async () => {
    const result = await uploadJson(`data:image/png;base64,${png.toString("base64")}`, false);
    assert.equal(result.status, 401);
  });
  await check("有效 Base64 PNG 可上传和访问", async () => {
    const result = await uploadJson(`data:image/png;base64,${png.toString("base64")}`);
    assert.equal(result.status, 200);
    const { url } = await result.json();
    const image = await fetch(base + url, { headers: { cookie } });
    assert.equal(image.headers.get("content-type"), "image/png");
    assert.equal(image.headers.get("x-content-type-options"), "nosniff");
    assert.deepEqual(Buffer.from(await image.arrayBuffer()), png);
  });
  await check("有效 Multipart PNG 可上传", async () => {
    const result = await uploadFile(png, "clipboard.png", "image/png");
    assert.equal(result.status, 200);
    assert.match((await result.json()).url, /^\/covers\/.+\.png$/);
  });
  await check("拒绝 HTML、SVG、伪造图片和畸形 Base64，且不遗留文件", async () => {
    const count = readdirSync(join(fixture, "covers")).length;
    const invalid = [
      "data:image/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
      "data:image/svg+xml;base64,PHN2Zy8+",
      "data:image/png;base64,bm90IGFuIGltYWdl",
      `data:image/jpeg;base64,${png.toString("base64")}`,
      "data:image/png;base64,%%%", "data:image/png;base64,", "data:image/png;base64,a",
    ];
    for (const value of invalid) assert.equal((await uploadJson(value)).status, 400);
    assert.equal((await uploadFile(Buffer.from("not an image"), "invalid.png", "image/png")).status, 400);
    assert.equal((await uploadFile(Buffer.from("<script>1</script>"), "payload.html", "text/html")).status, 400);
    assert.equal(readdirSync(join(fixture, "covers")).length, count);
  });
  await check("Base64 与 Multipart 都拒绝超过 5 MiB 的封面", async () => {
    const count = readdirSync(join(fixture, "covers")).length;
    const bytes = Buffer.alloc(5 * 1024 * 1024 + 1);
    png.copy(bytes);
    assert.equal((await uploadJson(`data:image/png;base64,${bytes.toString("base64")}`)).status, 413);
    assert.equal((await uploadFile(bytes, "large.png", "image/png")).status, 413);
    assert.equal(readdirSync(join(fixture, "covers")).length, count);
  });
  await check("历史 HTML/SVG 附件也不能作为同源页面执行", async () => {
    for (const name of ["old.html", "old.svg"]) {
      writeFileSync(join(fixture, "covers", name), "<script>window.invalid=true</script>");
      assert.equal((await fetch(`${base}/covers/${name}`, { headers: { cookie } })).status, 404);
    }
  });
  console.log(`共 ${checked} 组回归检查通过；仅使用临时数据。`);
} finally {
  if (server?.listening) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
  sqlite?.close();
  rmSync(fixture, { recursive: true, force: true });
}
