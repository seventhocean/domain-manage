import express from 'express';
import multer from 'multer';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import {
  getServices, getService, createService, updateService, deleteService,
  getDomains, getDomain, createDomain, updateDomain, deleteDomain,
  getSettings, updateSettings, getDashboardStats,
  SCREENSHOTS_DIR, COVERS_DIR,
} from './store.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(express.json());
app.use('/public', express.static(join(__dirname, 'public')));
app.use('/screenshots', express.static(SCREENSHOTS_DIR));
app.use('/covers', express.static(COVERS_DIR));

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

// --- API: Settings ---
app.get('/api/settings', (req, res) => {
  const settings = getSettings();
  // Don't expose the actual token in API responses
  const { cf_api_token, ...safeSettings } = settings;
  res.json({
    ...safeSettings,
    cf_api_token_set: !!cf_api_token,
  });
});

app.put('/api/settings', (req, res) => {
  const s = updateSettings(req.body);
  // Update the cf_api_token_set flag based on whether token exists
  if (req.body.cf_api_token !== undefined) {
    s.cf_api_token_set = !!req.body.cf_api_token;
    updateSettings({ cf_api_token_set: s.cf_api_token_set });
  }
  // Don't expose the actual token in API responses
  const { cf_api_token, ...safeSettings } = s;
  res.json({
    ...safeSettings,
    cf_api_token_set: !!cf_api_token,
  });
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
