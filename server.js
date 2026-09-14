import express from 'express';
import multer from 'multer';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import {
  getServices, getService, createService, updateService, deleteService,
  getDomains, getDomain, createDomain, updateDomain, deleteDomain,
  getServers, getServer, createServer, updateServer, deleteServer,
  getDeployments, createDeployment, updateDeployment, deleteDeployment,
  getSettings, updateSettings, getDashboardStats,
  SCREENSHOTS_DIR, COVERS_DIR,
} from './store.js';
import { getKomariOverview, resetKomariCache, normalizeBaseUrl } from './komari.js';
import { probeDomain, mapPool } from './probe.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const ICONS_DIR = join(__dirname, 'data', 'icons');

app.set('trust proxy', 1);

// --- Auth helpers ---
const SESSION_COOKIE = 'dm_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_LOGIN_FAILURES = 5;
const LOGIN_LOCK_MS = 10 * 60 * 1000;

const loginFailures = new Map();

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const cookies = {};
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    cookies[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return cookies;
}

function getSessionSecret() {
  const settings = getSettings();
  if (settings.session_secret) return settings.session_secret;
  const secret = randomBytes(32).toString('hex');
  updateSettings({ session_secret: secret });
  return secret;
}

function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}

function verifyPassword(password) {
  const envPassword = process.env.AUTH_PASSWORD;
  if (envPassword) {
    const actual = createHash('sha256').update(password).digest();
    const expected = createHash('sha256').update(envPassword).digest();
    return timingSafeEqual(actual, expected);
  }
  const stored = getSettings().auth_password_hash;
  if (!stored) return false;
  const [salt, expected] = stored.split(':');
  if (!salt || !expected) return false;
  const actual = scryptSync(password, salt, 64);
  const expectedBuffer = Buffer.from(expected, 'hex');
  return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
}

function issueSession(res) {
  const version = getSettings().session_version || '0';
  const exp = Date.now() + SESSION_TTL_MS;
  const signature = createHmac('sha256', getSessionSecret())
    .update(`v1|${exp}|${version}`)
    .digest('hex');
  res.cookie(SESSION_COOKIE, `${exp}.${version}.${signature}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: Boolean(res.req.secure),
    maxAge: SESSION_TTL_MS,
    path: '/',
  });
}

function isAuthenticated(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return false;
  const [expString, version, signature] = token.split('.');
  const exp = Number(expString);
  if (!exp || exp < Date.now() || !signature) return false;
  if ((getSettings().session_version || '0') !== version) return false;
  const expected = createHmac('sha256', getSessionSecret())
    .update(`v1|${expString}|${version}`)
    .digest('hex');
  const actualBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

function authRequired(req, res, next) {
  if (isAuthenticated(req)) return next();
  if (req.method === 'GET' && req.path === '/login') return next();
  if (req.path.startsWith('/api/auth/')) return next();
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return res.redirect('/login');
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
}

// --- Middleware ---
app.use(express.json());
app.use(authRequired);
app.use('/public', express.static(join(__dirname, 'public')));
app.use('/screenshots', express.static(SCREENSHOTS_DIR));
app.use('/covers', express.static(COVERS_DIR));

// --- API: Auth ---
app.get('/login', (req, res) => {
  if (isAuthenticated(req)) return res.redirect('/');
  res.sendFile(join(__dirname, 'public', 'login.html'));
});

app.get('/api/auth/status', (req, res) => {
  const settings = getSettings();
  res.json({
    authenticated: isAuthenticated(req),
    has_password: Boolean(settings.auth_password_hash) || Boolean(process.env.AUTH_PASSWORD),
    env_override: Boolean(process.env.AUTH_PASSWORD),
  });
});

app.post('/api/auth/setup', (req, res) => {
  if (process.env.AUTH_PASSWORD) {
    return res.status(403).json({ error: '口令由 AUTH_PASSWORD 环境变量管理' });
  }
  if (getSettings().auth_password_hash) {
    return res.status(403).json({ error: '口令已设置，请直接登录' });
  }
  const password = String(req.body?.password || '');
  if (password.length < 6) {
    return res.status(400).json({ error: '口令至少 6 位' });
  }
  updateSettings({ auth_password_hash: hashPassword(password), session_version: '0' });
  issueSession(res);
  res.json({ ok: true });
});

app.post('/api/auth/login', (req, res) => {
  const ip = req.ip || 'unknown';
  if (loginLocked(ip)) {
    return res.status(429).json({ error: '尝试次数过多，请 10 分钟后再试' });
  }
  const password = String(req.body?.password || '');
  if (!verifyPassword(password)) {
    recordLoginFailure(ip);
    return res.status(401).json({ error: '口令错误' });
  }
  loginFailures.delete(ip);
  issueSession(res);
  res.json({ ok: true });
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.json({ ok: true });
});

app.post('/api/auth/password', (req, res) => {
  if (process.env.AUTH_PASSWORD) {
    return res.status(403).json({ error: '口令由 AUTH_PASSWORD 环境变量管理' });
  }
  if (!isAuthenticated(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const current = String(req.body?.current || '');
  const next = String(req.body?.next || '');
  if (!verifyPassword(current)) {
    return res.status(403).json({ error: '当前口令错误' });
  }
  if (next.length < 6) {
    return res.status(400).json({ error: '新口令至少 6 位' });
  }
  const version = String(Number(getSettings().session_version || '0') + 1);
  updateSettings({ auth_password_hash: hashPassword(next), session_version: version });
  issueSession(res);
  res.json({ ok: true });
});

// Screenshot upload
const upload = multer({
  storage: multer.diskStorage({
    destination: SCREENSHOTS_DIR,
    filename: (req, file, cb) => {
      const svcId = req.params.serviceId || 'unknown';
      const ext = extname(file.originalname) || '.webp';
      cb(null, `${svcId}-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Cover image upload
const coverUpload = multer({
  storage: multer.diskStorage({
    destination: COVERS_DIR,
    filename: (req, file, cb) => {
      const svcId = req.params.serviceId || 'unknown';
      const ext = extname(file.originalname) || '.webp';
      cb(null, `${svcId}-cover${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// --- API: Health ---
app.get('/api/health', (req, res) => {
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
app.get('/api/favicon', async (req, res) => {
  const domain = String(req.query.domain || '').trim().toLowerCase();
  if (!/^[a-z0-9.-]+$/.test(domain) || !domain.includes('.')) {
    return res.status(400).end();
  }
  const known = getDomains().some(d => (d.domain || '').toLowerCase() === domain);
  if (!known) return res.status(404).end();

  const file = join(ICONS_DIR, createHash('sha1').update(domain).digest('hex') + '.ico');
  if (existsSync(file)) {
    res.set('Cache-Control', 'public, max-age=86400');
    return res.sendFile(file);
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const upstream = await fetch(`https://${domain}/favicon.ico`, {
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!upstream.ok) return res.status(404).end();
    const buffer = Buffer.from(await upstream.arrayBuffer());
    if (buffer.length === 0 || buffer.length > 512 * 1024) return res.status(404).end();
    mkdirSync(ICONS_DIR, { recursive: true });
    writeFileSync(file, buffer);
    res.set('Cache-Control', 'public, max-age=86400');
    res.type(upstream.headers.get('content-type') || 'image/x-icon').send(buffer);
  } catch (e) {
    res.status(404).end();
  }
});

// --- API: Services CRUD ---
app.get('/api/services', (req, res) => {
  res.json(getServices());
});

app.get('/api/services/:id', (req, res) => {
  const s = getService(req.params.id);
  if (!s) return res.status(404).json({ error: 'Service not found' });
  res.json(s);
});

app.post('/api/services', (req, res) => {
  const s = createService(req.body);
  res.status(201).json(s);
});

app.put('/api/services/:id', (req, res) => {
  const s = updateService(req.params.id, req.body);
  if (!s) return res.status(404).json({ error: 'Service not found' });
  res.json(s);
});

app.delete('/api/services/:id', (req, res) => {
  const ok = deleteService(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Service not found' });
  res.json({ ok: true });
});

// --- API: Service discovery (infer services from domain→server mapping) ---
function serviceDomainMatch(service, domain) {
  const list = String(service.domain || '').split(',').map(v => v.trim()).filter(Boolean);
  if (list.includes(domain.domain)) return true;
  return (domain.service_ids || []).includes(service.id);
}

app.post('/api/services/discover', async (req, res) => {
  const domains = getDomains();
  const servers = getServers();
  const takenNames = new Set(getServices().map(s => String(s.name || '').toLowerCase()));
  let created = 0;
  let skipped = 0;
  let noServer = 0;
  let noResponse = 0;
  let noService = 0;

  const uniqueName = (base, domain) => {
    let name = base;
    if (takenNames.has(name.toLowerCase())) name = domain;
    let candidate = name;
    let index = 2;
    while (takenNames.has(candidate.toLowerCase())) candidate = `${name}-${index++}`;
    takenNames.add(candidate.toLowerCase());
    return candidate;
  };

  const candidates = [];
  for (const domain of domains) {
    if (!domain.domain) continue;

    const ips = String(domain.ip_address || '')
      .split(',')
      .map(v => v.trim())
      .filter(Boolean);
    const server = servers.find(s => {
      const serverIps = String(s.ip || '').split(',').map(v => v.trim()).filter(Boolean);
      return serverIps.some(ip => ips.includes(ip));
    });

    if (!server) {
      noServer++;
      continue;
    }
    const linked = getServices().some(service => serviceDomainMatch(service, domain));
    candidates.push({ domain, server, linked });
  }

  const probed = await mapPool(candidates, 4, async ({ domain, server, linked }) => {
    const probe = await probeDomain(domain.domain);
    updateDomain(domain.id, { probe });
    return { domain, server, linked, probe };
  });

  for (const { domain, server, linked, probe } of probed) {
    if (linked) {
      const service = getServices().find(s => serviceDomainMatch(s, domain));
      if (service) {
        updateService(service.id, {
          probe,
          kind: probe.ok ? (probe.kind || service.kind || null) : (service.kind || null),
          title: probe.ok ? (probe.title || service.title || null) : (service.title || null),
        });
      }
      skipped++;
      continue;
    }
    if (!probe.ok) {
      noResponse++;
      continue;
    }
    if (probe.placeholder || (probe.status && probe.status >= 500)) {
      noService++;
      continue;
    }
    const service = createService({
      name: uniqueName(domain.alias || domain.domain.split('.')[0], domain.domain),
      domain: domain.domain,
      status: 'running',
      notes: `由域名解析自动推断（${probe.kind || 'HTTP 服务'}）`,
      auto_created: true,
      kind: probe.kind || null,
      title: probe.title || null,
      probe,
    });
    createDeployment({
      service_id: service.id,
      server_id: server.id,
      port: '443',
      protocol: 'https',
    });
    created++;
  }

  res.json({ total: domains.length, created, skipped, noServer, noResponse, noService });
});

// --- API: Screenshots ---
app.post('/api/services/:serviceId/screenshots', upload.single('screenshot'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const filename = req.file.filename;
  const service = getService(req.params.serviceId);
  if (!service) return res.status(404).json({ error: 'Service not found' });
  const screenshots = [...(service.screenshots || []), filename];
  updateService(req.params.serviceId, { screenshots });
  res.json({ filename, url: `/screenshots/${filename}` });
});

// --- API: Cover Image ---
app.post('/api/services/:serviceId/cover', coverUpload.single('cover'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const filename = req.file.filename;
  const service = getService(req.params.serviceId);
  if (!service) return res.status(404).json({ error: 'Service not found' });
  updateService(req.params.serviceId, { cover_image: `/covers/${filename}` });
  res.json({ filename, url: `/covers/${filename}` });
});

// --- API: Dashboard Stats ---
app.get('/api/dashboard/stats', (req, res) => {
  res.json(getDashboardStats());
});

// --- API: Domains CRUD ---
app.get('/api/domains', (req, res) => {
  res.json(getDomains());
});

app.get('/api/domains/:id', (req, res) => {
  const d = getDomain(req.params.id);
  if (!d) return res.status(404).json({ error: 'Domain not found' });
  res.json(d);
});

app.post('/api/domains', (req, res) => {
  const d = createDomain(req.body);
  res.status(201).json(d);
});

app.put('/api/domains/:id', (req, res) => {
  const d = updateDomain(req.params.id, req.body);
  if (!d) return res.status(404).json({ error: 'Domain not found' });
  res.json(d);
});

app.delete('/api/domains/:id', (req, res) => {
  const ok = deleteDomain(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Domain not found' });
  res.json({ ok: true });
});

// --- API: Domain probing (real HTTP check) ---
function applyProbe(domain, probe) {
  updateDomain(domain.id, { probe });
  const service = getServices().find(s => serviceDomainMatch(s, domain));
  if (service) {
    updateService(service.id, {
      probe,
      kind: probe.ok ? (probe.kind || service.kind || null) : (service.kind || null),
      title: probe.ok ? (probe.title || service.title || null) : (service.title || null),
    });
  }
}

app.post('/api/domains/probe', async (req, res) => {
  const targets = getDomains().filter(d => String(d.ip_address || '').trim());
  const results = await mapPool(targets, 4, async domain => {
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
  const okCount = results.filter(r => r.ok).length;
  res.json({ total: targets.length, ok: okCount, failed: targets.length - okCount, results });
});

app.post('/api/domains/:id/probe', async (req, res) => {
  const domain = getDomain(req.params.id);
  if (!domain) return res.status(404).json({ error: 'Domain not found' });
  const probe = await probeDomain(domain.domain);
  applyProbe(domain, probe);
  res.json(probe);
});

// --- API: Servers CRUD ---
app.get('/api/servers', (req, res) => {
  res.json(getServers());
});

app.get('/api/servers/:id', (req, res) => {
  const s = getServer(req.params.id);
  if (!s) return res.status(404).json({ error: 'Server not found' });
  res.json(s);
});

app.post('/api/servers', (req, res) => {
  const s = createServer(req.body);
  res.status(201).json(s);
});

app.put('/api/servers/:id', (req, res) => {
  const s = updateServer(req.params.id, req.body);
  if (!s) return res.status(404).json({ error: 'Server not found' });
  res.json(s);
});

app.delete('/api/servers/:id', (req, res) => {
  const ok = deleteServer(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Server not found' });
  res.json({ ok: true });
});

// --- API: Deployments ---
app.get('/api/deployments', (req, res) => {
  res.json(getDeployments(req.query.service_id));
});

app.post('/api/deployments', (req, res) => {
  const { service_id, server_id } = req.body || {};
  if (!service_id || !getService(service_id)) {
    return res.status(400).json({ error: 'Invalid service_id' });
  }
  if (!server_id || !getServer(server_id)) {
    return res.status(400).json({ error: 'Invalid server_id' });
  }
  const dep = createDeployment(req.body);
  res.status(201).json(dep);
});

app.put('/api/deployments/:id', (req, res) => {
  const dep = updateDeployment(req.params.id, req.body);
  if (!dep) return res.status(404).json({ error: 'Deployment not found' });
  res.json(dep);
});

app.delete('/api/deployments/:id', (req, res) => {
  const ok = deleteDeployment(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Deployment not found' });
  res.json({ ok: true });
});

// --- API: Komari (read-only monitor source) ---
function komariConfig() {
  const settings = getSettings();
  return {
    baseUrl: normalizeBaseUrl(process.env.KOMARI_URL || settings.komari_url) || 'https://winters.eu.cc',
    apiKey: process.env.KOMARI_API_KEY || settings.komari_api_key || '',
  };
}

function nodeIps(node) {
  return [node.ipv4, node.ipv6].map(v => String(v || '').trim().toLowerCase()).filter(Boolean);
}

function serverMatchesNode(server, node) {
  const ips = new Set(nodeIps(node));
  if (ips.size === 0) return false;
  return String(server.ip || '')
    .split(',')
    .map(v => v.trim().toLowerCase())
    .filter(Boolean)
    .some(ip => ips.has(ip));
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
  const overview = await getKomariOverview({ baseUrl, apiKey, refresh: true });
  const servers = getServers();
  let created = 0;
  let linked = 0;

  for (const node of overview.nodes) {
    if (node.hidden || !node.uuid) continue;
    const existing = servers.find(s => s.komari_uuid === node.uuid)
      || servers.find(s => serverMatchesNode(s, node));

    if (!existing) {
      if (!createMissing) continue;
      createServer({
        name: node.name || node.ipv4 || node.uuid.slice(0, 8),
        ip: node.ipv4 || node.ipv6 || '',
        region: node.region || '',
        notes: node.tags || '',
        komari_uuid: node.uuid,
        komari: nodeSnapshot(node),
      });
      created++;
      continue;
    }

    const patch = { komari_uuid: node.uuid, komari: nodeSnapshot(node) };
    if (!existing.ip && (node.ipv4 || node.ipv6)) patch.ip = node.ipv4 || node.ipv6;
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

app.get('/api/komari/overview', async (req, res) => {
  const { baseUrl, apiKey } = komariConfig();
  try {
    const overview = await getKomariOverview({ baseUrl, apiKey, refresh: req.query.refresh === '1' });
    const servers = getServers();
    const nodes = overview.nodes.map(node => {
      const server = servers.find(s => s.komari_uuid === node.uuid)
        || servers.find(s => serverMatchesNode(s, node))
        || null;
      return {
        ...node,
        matched_server_id: server ? server.id : null,
        matched_server_name: server ? (server.name || server.ip) : null,
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
    res.status(502).json({ error: 'Komari 不可达', detail: error.message });
  }
});

app.post('/api/komari/sync', async (req, res) => {
  try {
    res.json(await syncKomari({ createMissing: false }));
  } catch (error) {
    res.status(502).json({ error: 'Komari 同步失败', detail: error.message });
  }
});

app.post('/api/komari/import', async (req, res) => {
  try {
    res.json(await syncKomari({ createMissing: true }));
  } catch (error) {
    res.status(502).json({ error: 'Komari 导入失败', detail: error.message });
  }
});

// --- API: Settings ---
function publicSettings() {
  const settings = getSettings();
  return {
    cf_api_token_set: Boolean(settings.cf_api_token),
    cf_env_token: Boolean(process.env.CF_API_TOKEN),
    komari_url: settings.komari_url || '',
    komari_api_key_set: Boolean(settings.komari_api_key),
    komari_env_key: Boolean(process.env.KOMARI_API_KEY),
    komari_base_url: komariConfig().baseUrl,
  };
}

app.get('/api/settings', (req, res) => {
  res.json(publicSettings());
});

app.put('/api/settings', (req, res) => {
  const patch = {};
  let komariChanged = false;
  if (typeof req.body?.cf_api_token === 'string' && req.body.cf_api_token) {
    patch.cf_api_token = req.body.cf_api_token;
    patch.cf_api_token_set = true;
  }
  if (typeof req.body?.komari_url === 'string') {
    patch.komari_url = req.body.komari_url.trim();
    komariChanged = true;
  }
  if (typeof req.body?.komari_api_key === 'string' && req.body.komari_api_key) {
    patch.komari_api_key = req.body.komari_api_key.trim();
    komariChanged = true;
  }
  updateSettings(patch);
  if (komariChanged) resetKomariCache();
  res.json(publicSettings());
});

// --- API: Cloudflare Proxy ---
const CF_BASE = 'https://api.cloudflare.com/client/v4';

function cfHeaders() {
  const token = process.env.CF_API_TOKEN || getSettings().cf_api_token || '';
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

app.get('/api/cf/zones', async (req, res) => {
  const token = process.env.CF_API_TOKEN || getSettings().cf_api_token;
  if (!token) {
    return res.status(401).json({ error: 'CF_API_TOKEN not set. Run: CF_API_TOKEN=xxx node server.js' });
  }
  try {
    const params = new URLSearchParams();
    if (req.query.page) params.set('page', req.query.page);
    params.set('per_page', req.query.per_page || '50');
    const resp = await fetch(`${CF_BASE}/zones?${params}`, { headers: cfHeaders() });
    const data = await resp.json();
    res.json(data);
  } catch (e) {
    res.status(502).json({ error: 'Cloudflare API unreachable', detail: e.message });
  }
});

app.get('/api/cf/zones/:zoneId/dns', async (req, res) => {
  const token = process.env.CF_API_TOKEN || getSettings().cf_api_token;
  if (!token) {
    return res.status(401).json({ error: 'CF_API_TOKEN not set' });
  }
  try {
    const resp = await fetch(
      `${CF_BASE}/zones/${req.params.zoneId}/dns_records?per_page=100`,
      { headers: cfHeaders() }
    );
    const data = await resp.json();
    res.json(data);
  } catch (e) {
    res.status(502).json({ error: 'Cloudflare API unreachable', detail: e.message });
  }
});

// --- API: Cloudflare Full Sync ---
app.post('/api/cf/sync', async (req, res) => {
  const token = process.env.CF_API_TOKEN || getSettings().cf_api_token;
  if (!token) {
    return res.status(401).json({ error: 'CF_API_TOKEN not set' });
  }
  try {
    // Step 1: Fetch all zones
    const zonesResp = await fetch(`${CF_BASE}/zones?per_page=50`, { headers: cfHeaders() });
    const zonesData = await zonesResp.json();
    if (!zonesData.success) {
      return res.status(502).json({ error: 'Failed to fetch zones', detail: zonesData.errors });
    }

    let added = 0;
    let updated = 0;
    const existingDomains = getDomains();

    for (const zone of zonesData.result) {
      const existing = existingDomains.find(d => d.domain === zone.name);
      let domain;

      if (!existing) {
        domain = createDomain({
          domain: zone.name,
          dns_provider: 'cloudflare',
          dns_status: zone.status === 'active' ? 'active' : 'inactive',
          registrar: 'Cloudflare',
          cf_zone_id: zone.id,
        });
        added++;
      } else {
        domain = existing;
        // Ensure cf_zone_id is stored for future syncs
        updateDomain(domain.id, {
          dns_provider: 'cloudflare',
          registrar: domain.registrar || 'Cloudflare',
          cf_zone_id: zone.id,
        });
      }

      // Step 2: Fetch DNS records for this zone
      try {
        const dnsResp = await fetch(
          `${CF_BASE}/zones/${zone.id}/dns_records?per_page=100`,
          { headers: cfHeaders() }
        );
        const dnsData = await dnsResp.json();
        if (dnsData.success && dnsData.result.length > 0) {
          const aRecords = dnsData.result.filter(
            r => (r.type === 'A' || r.type === 'AAAA')
              && !r.content.startsWith('100::')       // IPv6 discard prefix
              && r.content !== '::1'                   // localhost IPv6
          );
          const ips = [...new Set(aRecords.map(r => r.content))]; // deduplicate
          if (ips.length > 0) {
            updateDomain(domain.id, {
              ip_address: ips.join(', '),
              dns_status: 'active',
            });
            if (existing) updated++; // count as updated only for existing domains
          }
        }
      } catch (e) {
        // DNS record fetch failed for this zone — not fatal
        console.warn(`Failed to fetch DNS records for ${zone.name}:`, e.message);
      }
    }

    res.json({
      success: true,
      added,
      updated,
      total_zones: zonesData.result.length,
    });
  } catch (e) {
    res.status(502).json({ error: 'Sync failed', detail: e.message });
  }
});

// --- Serve SPA ---
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

// --- Start ---
app.listen(PORT, () => {
  console.log(`\n  🟩 Panel running at http://localhost:${PORT}`);
  console.log(`  CF Token: ${process.env.CF_API_TOKEN ? '✅ set' : '❌ not set (Cloudflare sync disabled)'}\n`);
});
