import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, 'data', 'data.json');
const SCREENSHOTS_DIR = join(__dirname, 'data', 'screenshots');

// --- Init ---
function ensureDataDir() {
  if (!existsSync(join(__dirname, 'data'))) mkdirSync(join(__dirname, 'data'), { recursive: true });
  if (!existsSync(SCREENSHOTS_DIR)) mkdirSync(SCREENSHOTS_DIR, { recursive: true });
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
    url: '',
    description: '',
    status: 'running',
    category: 'other',
    screenshots: [],
    hosting: { provider: '', ip: '', port: null, stack: '' },
    tags: [],
    notes: '',
    created_at: now(),
    updated_at: now(),
    ...service,
  };
  data.services.push(s);
  writeData(data);
  return s;
}

export function updateService(id, patch) {
  const data = readData();
  const idx = data.services.findIndex(s => s.id === id);
  if (idx === -1) return null;
  data.services[idx] = { ...data.services[idx], ...patch, updated_at: now() };
  writeData(data);
  return data.services[idx];
}

export function deleteService(id) {
  const data = readData();
  const idx = data.services.findIndex(s => s.id === id);
  if (idx === -1) return false;
  data.services.splice(idx, 1);
  // Remove refs from domains
  data.domains.forEach(d => {
    d.service_ids = (d.service_ids || []).filter(sid => sid !== id);
  });
  writeData(data);
  return true;
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
    registrar: '',
    dns_provider: 'manual',
    cf_zone_id: null,
    expiry_date: null,
    ssl_expiry: null,
    status: 'active',
    service_ids: [],
    dns_records: [],
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

// --- Screenshots path ---
export { SCREENSHOTS_DIR };
