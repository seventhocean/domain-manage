// Komari 监控数据源连接器（只读）
// 优先使用 API Key 走 JSON-RPC（可拿到节点真实 IP）；无 Key 或失败时降级公开 API。

const CACHE_TTL_MS = 30 * 1000;
const REQUEST_TIMEOUT_MS = 5000;
const DEFAULT_BASE_URL = 'https://winters.eu.cc';

let cache = { key: '', at: 0, data: null };

export function normalizeBaseUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

export function resetKomariCache() {
  cache = { key: '', at: 0, data: null };
}

async function request(url, { method = 'GET', apiKey = '', body } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const headers = {};
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const resp = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return resp.json();
  } finally {
    clearTimeout(timer);
  }
}

function rpc(baseUrl, apiKey, method, params = {}) {
  return request(`${baseUrl}/api/rpc2`, {
    method: 'POST',
    apiKey,
    body: { jsonrpc: '2.0', id: 1, method, params },
  }).then(payload => {
    if (payload.error) throw new Error(payload.error.message || 'Komari RPC error');
    return payload.result;
  });
}

function asArray(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return Object.values(data);
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeNode(raw) {
  return {
    uuid: raw.uuid || '',
    name: raw.name || '',
    ipv4: raw.ipv4 || '',
    ipv6: raw.ipv6 || '',
    region: raw.region || '',
    os: raw.os || '',
    cpu_name: raw.cpu_name || '',
    cpu_cores: num(raw.cpu_cores),
    mem_total: num(raw.mem_total),
    swap_total: num(raw.swap_total),
    disk_total: num(raw.disk_total),
    price: num(raw.price),
    currency: raw.currency || '',
    billing_cycle: num(raw.billing_cycle),
    expired_at: raw.expired_at || null,
    auto_renewal: Boolean(raw.auto_renewal),
    tags: raw.tags || '',
    group: raw.group || '',
    hidden: Boolean(raw.hidden),
  };
}

function normalizeStatus(raw) {
  return {
    online: raw.online === true || raw.online === 1 || raw.online === 'true',
    time: raw.time || raw.updated_at || null,
    cpu: num(raw.cpu),
    ram: num(raw.ram),
    ram_total: num(raw.ram_total),
    swap: num(raw.swap),
    swap_total: num(raw.swap_total),
    load: num(raw.load),
    load5: num(raw.load5),
    load15: num(raw.load15),
    temp: num(raw.temp),
    disk: num(raw.disk),
    disk_total: num(raw.disk_total),
    net_in: num(raw.net_in),
    net_out: num(raw.net_out),
    net_total_up: num(raw.net_total_up),
    net_total_down: num(raw.net_total_down),
    process: num(raw.process),
    connections: num(raw.connections),
    uptime: num(raw.uptime),
  };
}

async function loadViaRpc(baseUrl, apiKey) {
  const nodesRaw = await rpc(baseUrl, apiKey, 'common:getNodes', {});
  let statusRaw = {};
  try {
    statusRaw = (await rpc(baseUrl, apiKey, 'common:getNodesLatestStatus', {})) || {};
  } catch {
    statusRaw = {};
  }
  const status = {};
  for (const [uuid, value] of Object.entries(statusRaw)) {
    if (value && typeof value === 'object') status[uuid] = normalizeStatus(value);
  }
  return { source: 'admin', nodes: asArray(nodesRaw).map(normalizeNode), status };
}

async function loadViaPublicApi(baseUrl) {
  const payload = await request(`${baseUrl}/api/nodes`);
  const nodes = asArray(payload.data).map(normalizeNode);
  const status = {};
  const results = await Promise.allSettled(
    nodes.map(node => request(`${baseUrl}/api/recent/${encodeURIComponent(node.uuid)}`))
  );
  results.forEach((result, index) => {
    if (result.status !== 'fulfilled') return;
    const recent = asArray(result.value.data);
    if (recent.length > 0) status[nodes[index].uuid] = normalizeStatus(recent[recent.length - 1]);
  });
  return { source: 'public', nodes, status };
}

export async function getKomariOverview({ baseUrl, apiKey, refresh = false } = {}) {
  const base = normalizeBaseUrl(baseUrl) || DEFAULT_BASE_URL;
  const key = `${base}|${apiKey ? 'key' : 'anon'}`;

  if (!refresh && cache.data && cache.key === key && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.data;
  }

  let data;
  if (apiKey) {
    try {
      data = await loadViaRpc(base, apiKey);
    } catch (error) {
      data = await loadViaPublicApi(base);
      data.fallback_reason = error.message;
    }
  } else {
    data = await loadViaPublicApi(base);
  }

  data.base_url = base;
  data.fetched_at = new Date().toISOString();
  cache = { key, at: Date.now(), data };
  return data;
}
