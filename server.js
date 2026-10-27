import express from "express";
import multer from "multer";
import { join, extname } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  unlinkSync,
} from "fs";
import { DATA_DIR } from "./apps/api/src/db/index.js";
import {
  createHash,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "crypto";
import {
  getServices,
  getService,
  createService,
  updateService,
  deleteService,
  getDomains,
  getDomain,
  createDomain,
  updateDomain,
  deleteDomain,
  getServers,
  getServer,
  createServer,
  updateServer,
  deleteServer,
  getDeployments,
  createDeployment,
  updateDeployment,
  deleteDeployment,
  getSettings,
  updateSettings,
  getDashboardStats,
  SCREENSHOTS_DIR,
  COVERS_DIR,
} from "./store.js";
import {
  getKomariOverview,
  resetKomariCache,
  normalizeBaseUrl,
} from "./komari.js";
import { probeDomain, mapPool } from "./probe.js";

/** @param {{publicMiddleware?: (app: import('express').Express) => void, protectedRoutes?: (app: import('express').Express) => void, serveFrontend?: (req: import('express').Request, res: import('express').Response) => void}} options */
export function createLegacyApp(options = {}) {
  const __dirname = process.cwd();
  const app = express();
  const ICONS_DIR = join(DATA_DIR, "icons");
  const setupFile = join(DATA_DIR, "setup-token");
  if (
    !process.env.AUTH_PASSWORD &&
    !getSettings().auth_password_hash &&
    !process.env.SETUP_TOKEN &&
    !existsSync(setupFile)
  )
    writeFileSync(setupFile, randomBytes(24).toString("hex"), {
      mode: 0o600,
      flag: "wx",
    });
  const setupToken =
    process.env.SETUP_TOKEN ||
    (existsSync(setupFile) ? readFileSync(setupFile, "utf8").trim() : "");
  function sessionVersion() {
    const base = getSettings().session_version || "0";
    return `${base}:${createHmac("sha256", getSessionSecret())
      .update(process.env.AUTH_PASSWORD || "")
      .digest("hex")
      .slice(0, 16)}`;
  }

  app.set("trust proxy", 1);

  // --- Auth helpers ---
  const SESSION_COOKIE = "dm_session";
  const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
  const MAX_LOGIN_FAILURES = 5;
  const LOGIN_LOCK_MS = 10 * 60 * 1000;

  const loginFailures = new Map(
    Object.entries(getSettings().login_failures || {}),
  );

  function parseCookies(req) {
    const header = req.headers.cookie || "";
    const cookies = {};
    for (const part of header.split(";")) {
      const index = part.indexOf("=");
      if (index === -1) continue;
      try {
        cookies[part.slice(0, index).trim()] = decodeURIComponent(
          part.slice(index + 1).trim(),
        );
      } catch {
        /* Ignore malformed cookies. */
      }
    }
    return cookies;
  }

  function getSessionSecret() {
    const settings = getSettings();
    if (settings.session_secret) return settings.session_secret;
    const secret = randomBytes(32).toString("hex");
    updateSettings({ session_secret: secret });
    return secret;
  }

  function hashPassword(password, salt = randomBytes(16).toString("hex")) {
    return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
  }

  function verifyPassword(password) {
    const envPassword = process.env.AUTH_PASSWORD;
    if (envPassword) {
      const actual = createHash("sha256").update(password).digest();
      const expected = createHash("sha256").update(envPassword).digest();
      return timingSafeEqual(actual, expected);
    }
    const stored = getSettings().auth_password_hash;
    if (!stored) return false;
    const [salt, expected] = stored.split(":");
    if (!salt || !expected) return false;
    const actual = scryptSync(password, salt, 64);
    const expectedBuffer = Buffer.from(expected, "hex");
    return (
      actual.length === expectedBuffer.length &&
      timingSafeEqual(actual, expectedBuffer)
    );
  }

  function issueSession(res) {
    const version = sessionVersion();
    const exp = Date.now() + SESSION_TTL_MS;
    const signature = createHmac("sha256", getSessionSecret())
      .update(`v1|${exp}|${version}`)
      .digest("hex");
    res.cookie(SESSION_COOKIE, `${exp}.${version}.${signature}`, {
      httpOnly: true,
      sameSite: "lax",
      secure: Boolean(res.req.secure),
      maxAge: SESSION_TTL_MS,
      path: "/",
    });
  }

  function isAuthenticated(req) {
    const token = parseCookies(req)[SESSION_COOKIE];
    if (!token) return false;
    const [expString, version, signature] = token.split(".");
    const exp = Number(expString);
    if (!exp || exp < Date.now() || !signature) return false;
    if (sessionVersion() !== version) return false;
    if (
      (getSettings().revoked_sessions || {})[
        createHash("sha256").update(token).digest("hex")
      ]
    )
      return false;
    const expected = createHmac("sha256", getSessionSecret())
      .update(`v1|${expString}|${version}`)
      .digest("hex");
    const actualBuffer = Buffer.from(signature, "hex");
    const expectedBuffer = Buffer.from(expected, "hex");
    return (
      actualBuffer.length === expectedBuffer.length &&
      timingSafeEqual(actualBuffer, expectedBuffer)
    );
  }

  function authRequired(req, res, next) {
    if (isAuthenticated(req)) return next();
    if (req.method === "GET" && req.path === "/login") return next();
    if (req.path.startsWith("/api/auth/")) return next();
    if (req.path.startsWith("/api/")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    return res.redirect("/login");
  }

  function loginLocked(ip) {
    const entry = loginFailures.get(ip);
    if (!entry) return false;
    if (Date.now() > entry.until) {
      loginFailures.delete(ip);
      return false;
    }
    return entry.count >= MAX_LOGIN_FAILURES;
  }

  function recordLoginFailure(ip) {
    const entry = loginFailures.get(ip) || { count: 0, until: 0 };
    entry.count += 1;
    entry.until = Date.now() + LOGIN_LOCK_MS;
    loginFailures.set(ip, entry);
    updateSettings({ login_failures: Object.fromEntries(loginFailures) });
  }

  // Rotate the persisted session generation when deployment credentials change.
  const authContext = createHmac("sha256", getSessionSecret())
    .update(process.env.AUTH_PASSWORD || "")
    .digest("hex");
  const previousContext = getSettings().auth_env_context;
  if (previousContext !== authContext)
    updateSettings({
      auth_env_context: authContext,
      ...(previousContext
        ? { session_version: randomBytes(16).toString("hex") }
        : {}),
    });

  // --- Middleware ---
  app.use(express.json({ limit: "1mb" }));
  options.publicMiddleware?.(app);
  app.use((req, res, next) => {
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.headers.origin
    ) {
      try {
        if (new URL(req.headers.origin).host !== req.headers.host)
          return res.status(403).json({ error: "请求来源不匹配" });
      } catch {
        return res.status(403).json({ error: "请求来源无效" });
      }
    }
    next();
  });
  app.use(authRequired);
  options.protectedRoutes?.(app);
  app.use("/public", express.static(join(__dirname, "public")));
  app.use("/screenshots", express.static(SCREENSHOTS_DIR));
  app.use("/covers", express.static(COVERS_DIR));

  // --- API: Auth ---
  app.get("/login", (req, res) => {
    if (isAuthenticated(req)) return res.redirect("/");
    if (options.serveFrontend) return options.serveFrontend(req, res);
    res.sendFile(join(__dirname, "public", "login.html"));
  });

  app.get("/api/auth/status", (req, res) => {
    const settings = getSettings();
    res.json({
      authenticated: isAuthenticated(req),
      has_password:
        Boolean(settings.auth_password_hash) ||
        Boolean(process.env.AUTH_PASSWORD),
      env_override: Boolean(process.env.AUTH_PASSWORD),
    });
  });

  app.post("/api/auth/setup", (req, res) => {
    if (process.env.AUTH_PASSWORD) {
      return res
        .status(403)
        .json({ error: "口令由 AUTH_PASSWORD 环境变量管理" });
    }
    if (getSettings().auth_password_hash) {
      return res.status(403).json({ error: "口令已设置，请直接登录" });
    }
    if (!setupToken || req.body?.setup_token !== setupToken)
      return res.status(403).json({
        error:
          "请填写部署初始化凭证（SETUP_TOKEN 或数据目录中的 setup-token 文件）",
      });
    const password = String(req.body?.password || "").slice(0, 1024);
    if (password.length < 12)
      return res.status(400).json({ error: "口令至少 12 位" });
    updateSettings({
      auth_password_hash: hashPassword(password),
      session_version: "0",
    });
    issueSession(res);
    res.json({ ok: true });
  });

  app.post("/api/auth/login", (req, res) => {
    const ip = req.ip || "unknown";
    if (loginLocked(ip)) {
      return res.status(429).json({ error: "尝试次数过多，请 10 分钟后再试" });
    }
    const password = String(req.body?.password || "").slice(0, 1024);
    if (!verifyPassword(password)) {
      recordLoginFailure(ip);
      return res.status(401).json({ error: "口令错误" });
    }
    loginFailures.delete(ip);
    updateSettings({ login_failures: Object.fromEntries(loginFailures) });
    issueSession(res);
    res.json({ ok: true });
  });

  app.post("/api/auth/logout", (req, res) => {
    const token = parseCookies(req)[SESSION_COOKIE];
    if (token && isAuthenticated(req)) {
      const revoked = Object.fromEntries(
        Object.entries(getSettings().revoked_sessions || {}).filter(
          ([, until]) => Number(until) > Date.now(),
        ),
      );
      revoked[createHash("sha256").update(token).digest("hex")] = Number(
        token.split(".")[0],
      );
      updateSettings({ revoked_sessions: revoked });
    }
    res.clearCookie(SESSION_COOKIE, { path: "/" });
    res.json({ ok: true });
  });

  app.post("/api/auth/password", (req, res) => {
    if (process.env.AUTH_PASSWORD) {
      return res
        .status(403)
        .json({ error: "口令由 AUTH_PASSWORD 环境变量管理" });
    }
    if (!isAuthenticated(req)) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const current = String(req.body?.current || "").slice(0, 1024);
    const next = String(req.body?.next || "").slice(0, 1024);
    if (!verifyPassword(current)) {
      return res.status(403).json({ error: "当前口令错误" });
    }
    if (next.length < 12) {
      return res.status(400).json({ error: "新口令至少 12 位" });
    }
    const version = randomBytes(16).toString("hex");
    updateSettings({
      auth_password_hash: hashPassword(next),
      session_version: version,
    });
    issueSession(res);
    res.json({ ok: true });
  });

  // Screenshot upload
  const upload = multer({
    storage: multer.diskStorage({
      destination: SCREENSHOTS_DIR,
      filename: (req, file, cb) => {
        const svcId = req.params.serviceId || "unknown";
        const ext = extname(file.originalname).toLowerCase();
        cb(null, `${svcId}-${Date.now()}${ext}`);
      },
    }),
    fileFilter: (req, file, cb) =>
      cb(null, /\.(png|jpe?g|webp|ico)$/i.test(file.originalname)),
    limits: { fileSize: 10 * 1024 * 1024 },
  });

  // Cover image upload
  const coverUpload = multer({
    storage: multer.diskStorage({
      destination: COVERS_DIR,
      filename: (req, file, cb) => {
        const svcId = req.params.serviceId || "unknown";
        const ext = extname(file.originalname).toLowerCase();
        cb(
          null,
          `${svcId}-cover-${Date.now()}-${randomBytes(4).toString("hex")}${ext}`,
        );
      },
    }),
    fileFilter: (req, file, cb) =>
      cb(null, /\.(png|jpe?g|webp|ico)$/i.test(file.originalname)),
    limits: { fileSize: 5 * 1024 * 1024 },
  });

  // --- API: Health ---
  app.get("/api/health", (req, res) => {
    const settings = getSettings();
    res.json({
      ok: true,
      cf_connected: !!process.env.CF_API_TOKEN,
      cf_token_set: settings.cf_api_token_set,
      services_count: getServices().length,
      domains_count: getDomains().length,
    });
  });

  // --- API: Favicon proxy (cached, known domains only) ---
  app.get("/api/favicon", async (req, res) => {
    const domain = String(req.query.domain || "")
      .trim()
      .toLowerCase();
    if (!/^[a-z0-9.-]+$/.test(domain) || !domain.includes(".")) {
      return res.status(400).end();
    }
    const known = getDomains().some(
      (d) => (d.domain || "").toLowerCase() === domain,
    );
    if (!known) return res.status(404).end();

    const file = join(
      ICONS_DIR,
      createHash("sha1").update(domain).digest("hex") + ".ico",
    );
    if (existsSync(file)) {
      res.set("Cache-Control", "public, max-age=86400");
      return res.sendFile(file);
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const upstream = await fetch(`https://${domain}/favicon.ico`, {
        redirect: "follow",
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!upstream.ok) return res.status(404).end();
      const buffer = Buffer.from(await upstream.arrayBuffer());
      if (buffer.length === 0 || buffer.length > 512 * 1024)
        return res.status(404).end();
      mkdirSync(ICONS_DIR, { recursive: true });
      writeFileSync(file, buffer);
      res.set("Cache-Control", "public, max-age=86400");
      res
        .type(upstream.headers.get("content-type") || "image/x-icon")
        .send(buffer);
    } catch (e) {
      res.status(404).end();
    }
  });

  // --- API: Services CRUD ---
  app.get("/api/services", (req, res) => {
    res.json(getServices());
  });

  app.get("/api/services/:id", (req, res) => {
    const s = getService(req.params.id);
    if (!s) return res.status(404).json({ error: "Service not found" });
    res.json(s);
  });

  app.post("/api/services", (req, res) => {
    const s = createService(req.body);
    res.status(201).json(s);
  });

  app.put("/api/services/:id", (req, res) => {
    const s = updateService(req.params.id, req.body);
    if (!s) return res.status(404).json({ error: "Service not found" });
    res.json(s);
  });

  app.delete("/api/services/:id", (req, res) => {
    const ok = deleteService(req.params.id);
    if (!ok) return res.status(404).json({ error: "Service not found" });
    res.json({ ok: true });
  });

  // --- API: Service discovery (infer services from domain→server mapping) ---
  function serviceDomainMatch(service, domain) {
    const list = String(service.domain || "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    if (list.includes(domain.domain)) return true;
    return (domain.service_ids || []).includes(service.id);
  }

  app.post("/api/services/discover", async (req, res) => {
    const domains = getDomains();
    const servers = getServers();
    const candidates = domains
      .filter(
        (d) =>
          d.ip_address && !getServices().some((s) => serviceDomainMatch(s, d)),
      )
      .map((domain) => ({
        domain,
        server: servers.find((s) =>
          String(s.ip || "")
            .split(",")
            .map((v) => v.trim())
            .some((ip) =>
              String(domain.ip_address)
                .split(",")
                .map((v) => v.trim())
                .includes(ip),
            ),
        ),
      }))
      .filter((c) => c.server);
    const results = await mapPool(candidates, 4, async ({ domain, server }) => {
      const probe = await probeDomain(domain.domain);
      updateDomain(domain.id, { probe });
      return {
        domain_id: domain.id,
        domain: domain.domain,
        server_id: server.id,
        server_name: server.name,
        name: domain.alias || domain.domain.split(".")[0],
        probe,
      };
    });
    res.json({ total: domains.length, candidates: results, created: 0 });
  });

  function requireUploadService(req, res, next) {
    if (!getService(req.params.serviceId))
      return res.status(404).json({ error: "服务不存在" });
    next();
  }
  function validateImage(req, res, next) {
    if (!req.file)
      return res
        .status(400)
        .json({ error: "请选择 PNG、JPEG、WebP 或 ICO 图片" });
    const data = readFileSync(req.file.path);
    const ext = extname(req.file.filename);
    const valid =
      ext === ".png"
        ? data
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : /^\.jpe?g$/.test(ext)
          ? data[0] === 255 && data[1] === 216 && data[2] === 255
          : ext === ".webp"
            ? data.toString("ascii", 0, 4) === "RIFF" &&
              data.toString("ascii", 8, 12) === "WEBP"
            : data[0] === 0 && data[1] === 0 && data[2] === 1 && data[3] === 0;
    if (!valid) {
      unlinkSync(req.file.path);
      return res.status(400).json({ error: "图片内容与格式不匹配" });
    }
    next();
  }
  // --- API: Screenshots ---
  app.post(
    "/api/services/:serviceId/screenshots",
    requireUploadService,
    upload.single("screenshot"),
    validateImage,
    (req, res) => {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      const filename = req.file.filename;
      const service = getService(req.params.serviceId);
      if (!service) return res.status(404).json({ error: "Service not found" });
      const screenshots = [...(service.screenshots || []), filename];
      updateService(req.params.serviceId, { screenshots });
      res.json({ filename, url: `/screenshots/${filename}` });
    },
  );

  // --- API: Cover Image ---
  app.post(
    "/api/services/:serviceId/cover",
    requireUploadService,
    coverUpload.single("cover"),
    validateImage,
    (req, res) => {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      const filename = req.file.filename;
      const service = getService(req.params.serviceId);
      if (!service) return res.status(404).json({ error: "Service not found" });
      updateService(req.params.serviceId, {
        cover_image: `/covers/${filename}`,
      });
      res.json({ filename, url: `/covers/${filename}` });
    },
  );

  // --- API: Dashboard Stats ---
  app.get("/api/dashboard/stats", (req, res) => {
    res.json(getDashboardStats());
  });

  // --- API: Domains CRUD ---
  app.get("/api/domains", (req, res) => {
    res.json(getDomains());
  });

  app.get("/api/domains/:id", (req, res) => {
    const d = getDomain(req.params.id);
    if (!d) return res.status(404).json({ error: "Domain not found" });
    res.json(d);
  });

  app.post("/api/domains", (req, res) => {
    const d = createDomain(req.body);
    res.status(201).json(d);
  });

  app.put("/api/domains/:id", (req, res) => {
    const d = updateDomain(req.params.id, req.body);
    if (!d) return res.status(404).json({ error: "Domain not found" });
    res.json(d);
  });

  app.delete("/api/domains/:id", (req, res) => {
    const ok = deleteDomain(req.params.id);
    if (!ok) return res.status(404).json({ error: "Domain not found" });
    res.json({ ok: true });
  });

  // --- API: Domain probing (real HTTP check) ---
  function applyProbe(domain, probe) {
    updateDomain(domain.id, { probe });
    const service = getServices().find((s) => serviceDomainMatch(s, domain));
    if (service) {
      updateService(service.id, {
        probe,
        kind: probe.ok
          ? probe.kind || service.kind || null
          : service.kind || null,
        title: probe.ok
          ? probe.title || service.title || null
          : service.title || null,
      });
    }
  }

  app.post("/api/domains/probe", async (req, res) => {
    const targets = getDomains().filter((d) =>
      String(d.ip_address || "").trim(),
    );
    const results = await mapPool(targets, 4, async (domain) => {
      const probe = await probeDomain(domain.domain);
      applyProbe(domain, probe);
      return {
        id: domain.id,
        domain: domain.domain,
        ok: probe.ok,
        status: probe.status,
        kind: probe.kind,
        title: probe.title,
        placeholder: probe.placeholder,
        elapsed_ms: probe.elapsed_ms,
        error: probe.error,
      };
    });
    const okCount = results.filter((r) => r.ok).length;
    res.json({
      total: targets.length,
      ok: okCount,
      failed: targets.length - okCount,
      results,
    });
  });

  app.post("/api/domains/:id/probe", async (req, res) => {
    const domain = getDomain(req.params.id);
    if (!domain) return res.status(404).json({ error: "Domain not found" });
    const probe = await probeDomain(domain.domain);
    applyProbe(domain, probe);
    res.json(probe);
  });

  // --- API: Servers CRUD ---
  app.get("/api/servers", (req, res) => {
    res.json(getServers());
  });

  app.get("/api/servers/:id", (req, res) => {
    const s = getServer(req.params.id);
    if (!s) return res.status(404).json({ error: "Server not found" });
    res.json(s);
  });

  app.post("/api/servers", (req, res) => {
    const s = createServer(req.body);
    res.status(201).json(s);
  });

  app.put("/api/servers/:id", (req, res) => {
    const s = updateServer(req.params.id, req.body);
    if (!s) return res.status(404).json({ error: "Server not found" });
    res.json(s);
  });

  app.delete("/api/servers/:id", (req, res) => {
    const ok = deleteServer(req.params.id);
    if (!ok) return res.status(404).json({ error: "Server not found" });
    res.json({ ok: true });
  });

  // --- API: Deployments ---
  app.get("/api/deployments", (req, res) => {
    res.json(getDeployments(req.query.service_id));
  });

  app.post("/api/deployments", (req, res) => {
    const { service_id, server_id } = req.body || {};
    if (!service_id || !getService(service_id)) {
      return res.status(400).json({ error: "Invalid service_id" });
    }
    if (!server_id || !getServer(server_id)) {
      return res.status(400).json({ error: "Invalid server_id" });
    }
    const dep = createDeployment(req.body);
    res.status(201).json(dep);
  });

  app.put("/api/deployments/:id", (req, res) => {
    const dep = updateDeployment(req.params.id, req.body);
    if (!dep) return res.status(404).json({ error: "Deployment not found" });
    res.json(dep);
  });

  app.delete("/api/deployments/:id", (req, res) => {
    const ok = deleteDeployment(req.params.id);
    if (!ok) return res.status(404).json({ error: "Deployment not found" });
    res.json({ ok: true });
  });

  // --- API: Komari (read-only monitor source) ---
  function komariConfig() {
    const settings = getSettings();
    return {
      baseUrl:
        normalizeBaseUrl(process.env.KOMARI_URL || settings.komari_url) ||
        "https://winters.eu.cc",
      apiKey: process.env.KOMARI_API_KEY || settings.komari_api_key || "",
    };
  }

  function nodeIps(node) {
    return [node.ipv4, node.ipv6]
      .map((v) =>
        String(v || "")
          .trim()
          .toLowerCase(),
      )
      .filter(Boolean);
  }

  function serverMatchesNode(server, node) {
    const ips = new Set(nodeIps(node));
    if (ips.size === 0) return false;
    return String(server.ip || "")
      .split(",")
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean)
      .some((ip) => ips.has(ip));
  }

  function nodeSnapshot(node) {
    return {
      uuid: node.uuid,
      name: node.name,
      ipv4: node.ipv4,
      ipv6: node.ipv6,
      region: node.region,
      os: node.os,
      cpu_name: node.cpu_name,
      cpu_cores: node.cpu_cores,
      mem_total: node.mem_total,
      disk_total: node.disk_total,
      price: node.price,
      currency: node.currency,
      billing_cycle: node.billing_cycle,
      expired_at: node.expired_at,
      auto_renewal: node.auto_renewal,
      tags: node.tags,
      group: node.group,
      synced_at: new Date().toISOString(),
    };
  }

  async function syncKomari({ createMissing }) {
    const { baseUrl, apiKey } = komariConfig();
    const overview = await getKomariOverview({
      baseUrl,
      apiKey,
      refresh: true,
    });
    const servers = getServers();
    let created = 0;
    let linked = 0;

    for (const node of overview.nodes) {
      if (node.hidden || !node.uuid) continue;
      const existing =
        servers.find((s) => s.komari_uuid === node.uuid) ||
        servers.find((s) => serverMatchesNode(s, node));

      if (!existing) {
        if (!createMissing) continue;
        createServer({
          name: node.name || node.ipv4 || node.uuid.slice(0, 8),
          ip: node.ipv4 || node.ipv6 || "",
          region: node.region || "",
          notes: node.tags || "",
          komari_uuid: node.uuid,
          komari: nodeSnapshot(node),
        });
        created++;
        continue;
      }

      const patch = { komari_uuid: node.uuid, komari: nodeSnapshot(node) };
      if (!existing.ip && (node.ipv4 || node.ipv6))
        patch.ip = node.ipv4 || node.ipv6;
      if (!existing.region && node.region) patch.region = node.region;
      updateServer(existing.id, patch);
      linked++;
    }

    return {
      total: overview.nodes.length,
      created,
      linked,
      source: overview.source,
      base_url: baseUrl,
      fallback_reason: overview.fallback_reason || null,
    };
  }

  app.get("/api/komari/overview", async (req, res) => {
    const { baseUrl, apiKey } = komariConfig();
    try {
      const overview = await getKomariOverview({
        baseUrl,
        apiKey,
        refresh: req.query.refresh === "1",
      });
      const servers = getServers();
      const nodes = overview.nodes.map((node) => {
        const server =
          servers.find((s) => s.komari_uuid === node.uuid) ||
          servers.find((s) => serverMatchesNode(s, node)) ||
          null;
        return {
          ...node,
          matched_server_id: server ? server.id : null,
          matched_server_name: server ? server.name || server.ip : null,
        };
      });
      res.json({
        configured: Boolean(apiKey),
        base_url: baseUrl,
        source: overview.source,
        fallback_reason: overview.fallback_reason || null,
        fetched_at: overview.fetched_at,
        nodes,
        status: overview.status,
      });
    } catch (error) {
      res.status(502).json({ error: "Komari 不可达", detail: error.message });
    }
  });

  app.post("/api/komari/sync", async (req, res) => {
    try {
      res.json(await syncKomari({ createMissing: false }));
    } catch (error) {
      res.status(502).json({ error: "Komari 同步失败", detail: error.message });
    }
  });

  app.post("/api/komari/import", async (req, res) => {
    try {
      res.json(await syncKomari({ createMissing: true }));
    } catch (error) {
      res.status(502).json({ error: "Komari 导入失败", detail: error.message });
    }
  });

  // --- API: Settings ---
  function publicSettings() {
    const settings = getSettings();
    return {
      credential_storage_ready: /^[a-f0-9]{64}$/i.test(
        process.env.CREDENTIAL_KEY || "",
      ),
      credential_unavailable: Boolean(settings.credential_unavailable),
      cf_api_token_set: Boolean(settings.cf_api_token),
      cf_env_token: Boolean(process.env.CF_API_TOKEN),
      komari_url: settings.komari_url || "",
      komari_api_key_set: Boolean(settings.komari_api_key),
      komari_env_key: Boolean(process.env.KOMARI_API_KEY),
      komari_base_url: komariConfig().baseUrl,
    };
  }

  app.get("/api/settings", (req, res) => {
    res.json(publicSettings());
  });

  app.put("/api/settings", (req, res) => {
    const patch = {};
    let komariChanged = false;
    if (typeof req.body?.cf_api_token === "string" && req.body.cf_api_token) {
      patch.cf_api_token = req.body.cf_api_token;
      patch.cf_api_token_set = true;
    }
    if (typeof req.body?.komari_url === "string") {
      const value = req.body.komari_url.trim();
      if (value) {
        try {
          const url = new URL(value);
          if (
            !["http:", "https:"].includes(url.protocol) ||
            url.username ||
            url.password
          )
            throw new Error();
        } catch {
          return res
            .status(400)
            .json({ error: "Komari 地址需为不含账号口令的 HTTP(S) URL" });
        }
      }
      patch.komari_url = value;
      komariChanged = true;
    }
    if (
      typeof req.body?.komari_api_key === "string" &&
      req.body.komari_api_key
    ) {
      patch.komari_api_key = req.body.komari_api_key.trim();
      komariChanged = true;
    }
    updateSettings(patch);
    if (komariChanged) resetKomariCache();
    res.json(publicSettings());
  });

  // --- API: Cloudflare Proxy ---
  const CF_BASE = "https://api.cloudflare.com/client/v4";

  function cfHeaders() {
    const token = process.env.CF_API_TOKEN || getSettings().cf_api_token || "";
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }

  app.get("/api/cf/zones", async (req, res) => {
    const token = process.env.CF_API_TOKEN || getSettings().cf_api_token;
    if (!token) {
      return res.status(409).json({
        error: "CF_API_TOKEN not set. Run: CF_API_TOKEN=xxx node server.js",
      });
    }
    try {
      const params = new URLSearchParams();
      if (req.query.page) params.set("page", req.query.page);
      params.set("per_page", req.query.per_page || "50");
      const resp = await fetch(`${CF_BASE}/zones?${params}`, {
        headers: cfHeaders(),
      });
      const data = await resp.json();
      res.json(data);
    } catch (e) {
      res
        .status(502)
        .json({ error: "Cloudflare API unreachable", detail: e.message });
    }
  });

  app.get("/api/cf/zones/:zoneId/dns", async (req, res) => {
    const token = process.env.CF_API_TOKEN || getSettings().cf_api_token;
    if (!token) {
      return res.status(409).json({ error: "CF_API_TOKEN not set" });
    }
    try {
      const resp = await fetch(
        `${CF_BASE}/zones/${req.params.zoneId}/dns_records?per_page=100`,
        { headers: cfHeaders() },
      );
      const data = await resp.json();
      res.json(data);
    } catch (e) {
      res
        .status(502)
        .json({ error: "Cloudflare API unreachable", detail: e.message });
    }
  });

  // --- API: Cloudflare Full Sync ---
  async function cfPages(path, perPage) {
    const result = [];
    for (let page = 1; page <= 1000; page++) {
      const response = await fetch(
        `${CF_BASE}${path}?per_page=${perPage}&page=${page}`,
        { headers: cfHeaders(), signal: AbortSignal.timeout(15000) },
      );
      const data = await response.json();
      if (!response.ok || !data.success || !Array.isArray(data.result))
        throw new Error("Cloudflare 查询失败，请检查授权范围与连接");
      result.push(...data.result);
      if (
        data.result_info?.total_pages
          ? page >= data.result_info.total_pages
          : data.result.length < perPage
      )
        return result;
    }
    throw new Error("Cloudflare 分页数量超出限制");
  }
  app.post("/api/cf/sync", async (req, res) => {
    if (!(process.env.CF_API_TOKEN || getSettings().cf_api_token))
      return res.status(409).json({ error: "请先配置 Cloudflare Token" });
    const zones = await cfPages("/zones", 50);
    let added = 0,
      updated = 0;
    const failures = [];
    for (const zone of zones) {
      try {
        const records = await cfPages(`/zones/${zone.id}/dns_records`, 100);
        const grouped = new Map();
        for (const record of records) {
          if (
            !["A", "AAAA", "CNAME"].includes(record.type) ||
            record.name.includes("*")
          )
            continue;
          const name = record.name.toLowerCase().replace(/\.$/, "");
          if (!grouped.has(name)) grouped.set(name, []);
          grouped.get(name).push(record);
        }
        if (!grouped.has(zone.name)) grouped.set(zone.name, []);
        for (const [name, hostRecords] of grouped) {
          const ips = [
            ...new Set(
              hostRecords
                .filter((r) => ["A", "AAAA"].includes(r.type))
                .map((r) => r.content),
            ),
          ];
          const patch = {
            domain: name,
            cf_zone_id: zone.id,
            cf_records: hostRecords,
            dns_provider: "cloudflare",
            ip_address: ips.join(", "),
            dns_status: hostRecords.length ? "active" : "inactive",
            address_source: "cloudflare",
          };
          const existing = getDomains().find((d) => d.domain === name);
          if (existing) {
            updateDomain(existing.id, patch);
            updated++;
          } else {
            createDomain(patch);
            added++;
          }
        }
        for (const existing of getDomains().filter(
          (d) => d.cf_zone_id === zone.id && !grouped.has(d.domain),
        )) {
          updateDomain(existing.id, {
            cf_records: [],
            ip_address: "",
            dns_status: "inactive",
            address_source: "cloudflare_removed",
          });
          updated++;
        }
      } catch (error) {
        failures.push({ zone: zone.name, error: error.message });
      }
    }
    res.json({
      success: failures.length === 0,
      added,
      updated,
      total_zones: zones.length,
      failures,
    });
  });

  // --- Serve SPA ---
  app.get("/", (req, res) => {
    if (options.serveFrontend) return options.serveFrontend(req, res);
    res.sendFile(join(__dirname, "public", "index.html"));
  });

  return app;
}
