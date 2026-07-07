import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, 'data', 'data.json');
const SCREENSHOTS_DIR = join(__dirname, 'data', 'screenshots');
const COVERS_DIR = join(__dirname, 'data', 'covers');

// --- Init ---
function ensureDataDir() {
  if (!existsSync(join(__dirname, 'data'))) mkdirSync(join(__dirname, 'data'), { recursive: true });
  if (!existsSync(SCREENSHOTS_DIR)) mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  if (!existsSync(COVERS_DIR)) mkdirSync(COVERS_DIR, { recursive: true });
}

function defaultData() {
  return { services: [], domains: [], settings: { cf_api_token_set: false } };
}

function readData() {
  ensureDataDir();
  if (!existsSync(DATA_FILE)) {
    writeFileSync(DATA_FILE, JSON.stringify(defaultData(), null, 2));
    return defaultData();
  }
  return JSON.parse(readFileSync(DATA_FILE, 'utf-8'));
}

function writeData(data) {
  ensureDataDir();
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function now() {
  return new Date().toISOString();
}

// --- Services ---
export function getServices() {
  return readData().services;
}

export function getService(id) {
  return readData().services.find(s => s.id === id) || null;
}

export function createService(service) {
  const data = readData();
  const s = {
    id: uid(),
    name: '',
    cover_image: '',
    domain: '',  // 逗号分隔的域名列表
    notes: '',
    status: 'running',
    created_at: now(),
    updated_at: now(),
    ...service,
  };
  data.services.push(s);
  writeData(data);

  // 自动关联域名
  if (s.domain) {
    autoAssociateDomains(s.id, s.domain);
  }

  return s;
}

export function updateService(id, patch) {
  const data = readData();
  const idx = data.services.findIndex(s => s.id === id);
  if (idx === -1) return null;

  const oldService = data.services[idx];
  data.services[idx] = { ...oldService, ...patch, updated_at: now() };
  writeData(data);

  // 如果域名发生变化，更新关联
  if (patch.domain !== undefined && patch.domain !== oldService.domain) {
    // 清除旧的关联
    if (oldService.domain) {
      autoAssociateDomains(id, '');
    }
    // 建立新的关联
    if (patch.domain) {
      autoAssociateDomains(id, patch.domain);
    }
  }

  return data.services[idx];
}

export function deleteService(id) {
  const data = readData();
  const idx = data.services.findIndex(s => s.id === id);
  if (idx === -1) return false;

  const service = data.services[idx];

  // 清除域名关联
  if (service.domain) {
    autoAssociateDomains(id, '');
  }

  data.services.splice(idx, 1);
  writeData(data);
  return true;
}

// --- 自动关联域名 ---
function autoAssociateDomains(serviceId, domainString) {
  const data = readData();
  const domainNames = domainString ? domainString.split(',').map(d => d.trim()).filter(d => d) : [];

  // 清除该服务的所有旧关联
  data.domains.forEach(d => {
    d.service_ids = (d.service_ids || []).filter(sid => sid !== serviceId);
  });

  // 建立新关联
  for (const domainName of domainNames) {
    let domain = data.domains.find(d => d.domain === domainName);

    if (!domain) {
      // 创建新的域名记录
      domain = {
        id: uid(),
        domain: domainName,
        ip_address: '',
        service_ids: [serviceId],
        dns_provider: 'manual',
        dns_status: 'inactive',
        expiry_date: null,
        ssl_status: 'unknown',
        registrar: '',
        notes: '',
        created_at: now(),
        updated_at: now(),
      };
      data.domains.push(domain);
    } else {
      // 添加服务关联（如果还没有）
      if (!domain.service_ids.includes(serviceId)) {
        domain.service_ids.push(serviceId);
        domain.updated_at = now();
      }
    }
  }

  writeData(data);
}

// --- Domains ---
export function getDomains() {
  return readData().domains;
}

export function getDomain(id) {
  return readData().domains.find(d => d.id === id) || null;
}

export function createDomain(domain) {
  const data = readData();
  const d = {
    id: uid(),
    domain: '',
    ip_address: '',
    service_ids: [],
    dns_provider: 'manual',
    dns_status: 'inactive',
    expiry_date: null,
    ssl_status: 'unknown',
    registrar: '',
    notes: '',
    created_at: now(),
    updated_at: now(),
    ...domain,
  };
  data.domains.push(d);
  writeData(data);
  return d;
}

export function updateDomain(id, patch) {
  const data = readData();
  const idx = data.domains.findIndex(d => d.id === id);
  if (idx === -1) return null;
  data.domains[idx] = { ...data.domains[idx], ...patch, updated_at: now() };
  writeData(data);
  return data.domains[idx];
}

export function deleteDomain(id) {
  const data = readData();
  const idx = data.domains.findIndex(d => d.id === id);
  if (idx === -1) return false;
  data.domains.splice(idx, 1);
  writeData(data);
  return true;
}

// --- Dashboard Stats ---
export function getDashboardStats() {
  const data = readData();
  const services = data.services || [];
  const domains = data.domains || [];

  const servicesRunning = services.filter(s => s.status === 'running').length;
  const domainsActive = domains.filter(d => d.dns_status === 'active').length;

  // 即将到期的域名（30天内）
  const now = new Date();
  const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const expiringDomains = domains.filter(d => {
    if (!d.expiry_date) return false;
    const expiry = new Date(d.expiry_date);
    return expiry > now && expiry <= thirtyDaysLater;
  });

  // 异常状态
  const alerts = [];

  // 服务异常
  services.filter(s => s.status === 'stopped').forEach(s => {
    alerts.push({
      type: 'service_down',
      severity: 'error',
      message: `服务 "${s.name}" 已停止`,
      service_id: s.id,
    });
  });

  // SSL 到期
  domains.filter(d => d.ssl_status === 'expiring' || d.ssl_status === 'expired').forEach(d => {
    alerts.push({
      type: 'ssl_expiring',
      severity: d.ssl_status === 'expired' ? 'error' : 'warning',
      message: `域名 "${d.domain}" SSL 证书${d.ssl_status === 'expired' ? '已过期' : '即将到期'}`,
      domain_id: d.id,
    });
  });

  // 域名到期
  expiringDomains.forEach(d => {
    const daysLeft = Math.ceil((new Date(d.expiry_date) - now) / (1000 * 60 * 60 * 24));
    alerts.push({
      type: 'domain_expiring',
      severity: daysLeft <= 7 ? 'error' : 'warning',
      message: `域名 "${d.domain}" 还有 ${daysLeft} 天到期`,
      domain_id: d.id,
    });
  });

  return {
    services: {
      total: services.length,
      running: servicesRunning,
    },
    domains: {
      total: domains.length,
      active: domainsActive,
    },
    expiring_soon: expiringDomains.map(d => ({
      domain: d.domain,
      expiry_date: d.expiry_date,
      days_left: Math.ceil((new Date(d.expiry_date) - now) / (1000 * 60 * 60 * 24)),
    })),
    alerts,
  };
}

// --- Settings ---
export function getSettings() {
  return readData().settings;
}

export function updateSettings(patch) {
  const data = readData();
  data.settings = { ...data.settings, ...patch };
  writeData(data);
  return data.settings;
}

// --- Paths ---
export { SCREENSHOTS_DIR, COVERS_DIR };
