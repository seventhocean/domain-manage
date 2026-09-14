// domain-manage console — classic script, global functions for inline handlers

// ---------- State ----------
const state = {
  services: [],
  domains: [],
  servers: [],
  deployments: [],
  settings: {},
  view: 'dashboard',
  domainsView: 'grid',
  servicesView: 'grid',
  paletteItems: [],
  paletteIndex: 0,
  komari: null,
  komariAutoImportDone: false,
};

const STRIPE_COLORS = ['#6C5CE7', '#57C1FF', '#56D364', '#E3B341', '#FF8A80', '#C084FC', '#2DD4BF', '#F472B6'];

let confirmAction = null;

// ---------- API ----------
async function api(path, opts = {}) {
  const resp = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (resp.status === 401) {
    window.location.href = '/login';
    throw new Error('登录已过期');
  }
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: resp.statusText }));
    throw new Error(err.error || '请求失败');
  }
  return resp.json();
}

// ---------- Init ----------
async function init() {
  bindGlobalEvents();
  try {
    await Promise.all([
      loadServices(),
      loadDomains(),
      loadServers(),
      loadDeployments(),
      loadSettings(),
    ]);
  } catch (e) {
    showToast('error', '加载失败', e.message);
  }
  renderAll();
  navigate('dashboard');
  bootstrapAutomation();
}

async function bootstrapAutomation() {
  const configured = state.settings.komari_api_key_set || state.settings.komari_env_key;
  if (configured && state.servers.length === 0 && !state.komariAutoImportDone) {
    state.komariAutoImportDone = true;
    await syncKomari(true, { silent: true });
  }
  if (state.services.length === 0 && state.domains.some(d => serverForDomain(d))) {
    await discoverServices({ silent: true });
  }
}

async function loadServices() {
  state.services = await api('/api/services');
}

async function loadDomains() {
  state.domains = await api('/api/domains');
}

async function loadServers() {
  state.servers = await api('/api/servers');
}

async function loadDeployments() {
  state.deployments = await api('/api/deployments');
}

async function loadSettings() {
  state.settings = await api('/api/settings');
  updateCFStatus(!!(state.settings.cf_api_token_set || state.settings.cf_env_token));
}

// ---------- Navigation ----------
function navigate(view) {
  state.view = view;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(`view-${view}`)?.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(l => {
    l.classList.toggle('active', l.dataset.view === view);
  });
  document.querySelectorAll('.tab-item').forEach(l => {
    l.classList.toggle('active', l.dataset.view === view);
  });

  if (view === 'dashboard') renderDashboard();
  if (view === 'domains') renderDomains();
  if (view === 'services') renderServices();
  if (view === 'servers') {
    renderServers();
    ensureKomari().then(renderServers).catch(() => {});
  }
  document.querySelector('.content')?.scrollTo(0, 0);
}

function renderAll() {
  renderDashboard();
  renderDomains();
  renderServices();
  renderServers();
  document.getElementById('nav-count-domains').textContent = state.domains.length;
  document.getElementById('nav-count-services').textContent = state.services.length;
  document.getElementById('nav-count-servers').textContent = state.servers.length;
}

function goToDomain(domainName) {
  navigate('domains');
  const input = document.getElementById('domains-search');
  input.value = domainName;
  renderDomains();
}

function goToService(serviceId) {
  const service = state.services.find(s => s.id === serviceId);
  navigate('services');
  const input = document.getElementById('services-search');
  input.value = service ? service.name : '';
  renderServices();
}

function setDomainsView(mode) {
  state.domainsView = mode;
  document.querySelectorAll('#view-domains .segmented-item').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === mode);
  });
  renderDomains();
}

function setServicesView(mode) {
  state.servicesView = mode;
  document.querySelectorAll('#view-services .segmented-item').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === mode);
  });
  renderServices();
}

// ---------- Helpers ----------
function esc(str) {
  if (str === null || str === undefined) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

function hashColor(seed) {
  const value = String(seed || '');
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return STRIPE_COLORS[hash % STRIPE_COLORS.length];
}

function monogram(label) {
  const cleaned = String(label || '').replace(/^www\./i, '').replace(/[^a-z0-9\u4e00-\u9fa5]/gi, '');
  return (cleaned.slice(0, 2) || '??').toUpperCase();
}

function faviconUrl(domain) {
  return domain ? `/api/favicon?domain=${encodeURIComponent(domain)}` : '';
}

function firstDomain(domainString) {
  return String(domainString || '').split(',').map(d => d.trim()).filter(Boolean)[0] || '';
}

function iconHtml(domain, fallbackLabel) {
  const src = faviconUrl(domain);
  return `<div class="asset-icon"><span>${esc(monogram(fallbackLabel || domain))}</span>${src ? `<img src="${esc(src)}" alt="" loading="lazy" onerror="this.remove()">` : ''}</div>`;
}

function serviceProbeChipHtml(service) {
  const probe = service.probe;
  if (!probe) return '';
  if (!probe.ok) return '<span class="chip"><span class="dot dot-danger"></span>无响应</span>';
  if (probe.placeholder) return '<span class="chip"><span class="dot dot-warning"></span>默认页</span>';
  if (probe.status && probe.status >= 500) return `<span class="chip"><span class="dot dot-warning"></span>异常 ${probe.status}</span>`;
  return '';
}

function serviceIconHtml(service) {
  const src = service.cover_image || faviconUrl(firstDomain(service.domain));
  return `<div class="asset-icon"><span>${esc(monogram(service.name))}</span>${src ? `<img src="${esc(src)}" alt="" loading="lazy" onerror="this.remove()">` : ''}</div>`;
}

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return '';
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return new Date(iso).toLocaleDateString('zh-CN');
}

function dnsMeta(status) {
  if (status === 'active') return { dot: 'dot-success', label: '已解析' };
  return { dot: 'dot-idle', label: '未解析' };
}

function serviceStatusMeta(status) {
  if (status === 'stopped') return { dot: 'dot-idle', label: '已停止' };
  if (status === 'maintenance') return { dot: 'dot-warning', label: '维护中' };
  return { dot: 'dot-success', label: '运行中' };
}

function domainStem(domain) {
  const value = String(domain || '');
  const index = value.lastIndexOf('.');
  return index > 0 ? value.slice(0, index) : value;
}

function domainTld(domain) {
  const value = String(domain || '');
  const index = value.lastIndexOf('.');
  return index > 0 ? value.slice(index) : '';
}

function domainHtml(domain, range) {
  const stem = domainStem(domain);
  const tld = domainTld(domain);
  const full = stem + tld;
  if (!range) return `${esc(stem)}<span class="tld">${esc(tld)}</span>`;

  const start = Math.max(0, Math.min(range.start, full.length));
  const end = Math.max(start, Math.min(range.end, full.length));

  const stemStart = Math.min(start, stem.length);
  const stemEnd = Math.min(end, stem.length);
  let stemHtml = esc(stem.slice(0, stemStart));
  if (stemEnd > stemStart) stemHtml += `<span class="diff">${esc(stem.slice(stemStart, stemEnd))}</span>`;
  stemHtml += esc(stem.slice(stemEnd));

  const tldContent = tld.startsWith('.') ? tld.slice(1) : tld;
  const tldStart = Math.max(0, start - stem.length - 1);
  const tldEnd = Math.max(tldStart, end - stem.length - 1);
  let tldHtml = tldContent;
  if (tldEnd > tldStart) {
    tldHtml = esc(tldContent.slice(0, tldStart))
      + `<span class="diff">${esc(tldContent.slice(tldStart, tldEnd))}</span>`
      + esc(tldContent.slice(tldEnd));
  } else {
    tldHtml = esc(tldContent);
  }
  return `${stemHtml}<span class="tld">${tld.startsWith('.') ? '.' : ''}${tldHtml}</span>`;
}

function similarity(a, b) {
  const x = String(a || '').toLowerCase();
  const y = String(b || '').toLowerCase();
  if (!x || !y || x === y) return null;
  let prefix = 0;
  while (prefix < x.length && prefix < y.length && x[prefix] === y[prefix]) prefix++;
  let suffix = 0;
  while (suffix < x.length - prefix && suffix < y.length - prefix
    && x[x.length - 1 - suffix] === y[y.length - 1 - suffix]) suffix++;
  const midA = x.length - prefix - suffix;
  const midB = y.length - prefix - suffix;
  if (prefix < 3 || midA > 12 || midB > 12) return null;
  if (midA === 0 && midB === 0) return null;
  return { prefix, midA, midB };
}

function computeDiffRanges() {
  const ranges = new Map();
  const domains = state.domains;
  for (let i = 0; i < domains.length; i++) {
    let best = null;
    for (let j = 0; j < domains.length; j++) {
      if (i === j) continue;
      const rel = similarity(domains[i].domain, domains[j].domain);
      if (!rel) continue;
      if (rel.midA === 0) { best = null; break; }
      if (!best || rel.midA < best.len) best = { start: rel.prefix, len: rel.midA };
    }
    if (best) ranges.set(domains[i].id, { start: best.start, end: best.start + best.len });
  }
  return ranges;
}

function findSimilarDomain(name, excludeId) {
  const value = String(name || '').trim().toLowerCase();
  if (!value) return null;
  for (const d of state.domains) {
    if (d.id === excludeId) continue;
    if (similarity(value, d.domain)) return d.domain;
  }
  return null;
}

// ---------- Dashboard ----------
function renderDashboard() {
  const total = state.domains.length;
  const resolved = state.domains.filter(d => d.dns_status === 'active').length;
  const services = state.services.length;

  document.getElementById('stat-domains').textContent = total;
  document.getElementById('stat-domains-sub').textContent = total ? `${resolved} 个已解析` : '还没有域名';
  document.getElementById('stat-resolved').textContent = resolved;
  document.getElementById('stat-resolved-sub').textContent = total ? `解析率 ${Math.round((resolved / total) * 100)}%` : '待同步 Cloudflare';
  document.getElementById('stat-services').textContent = services;
  document.getElementById('stat-services-sub').textContent = services ? '记录在案' : '还没有服务';
  const servers = state.servers.length;
  document.getElementById('stat-servers').textContent = servers;
  document.getElementById('stat-servers-sub').textContent = servers ? '记录在案' : '还没有服务器';
  document.getElementById('dashboard-sub').textContent = `共 ${total} 个域名 · ${services} 个服务 · ${servers} 台服务器`;

  renderRenewals();
  renderCosts();

  const recent = [
    ...state.domains.map(d => ({ type: '域名', name: d.alias || d.domain, sub: d.domain, at: d.updated_at || d.created_at })),
    ...state.services.map(s => ({ type: '服务', name: s.name, sub: s.domain || '—', at: s.updated_at || s.created_at })),
    ...state.servers.map(s => ({ type: '服务器', name: s.name || s.ip, sub: s.ip || '—', at: s.updated_at || s.created_at })),
  ].sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0)).slice(0, 6);

  const list = document.getElementById('recent-list');
  if (recent.length === 0) {
    list.innerHTML = '<p class="empty-desc" style="padding:12px 0">还没有记录，先添加一个域名或服务。</p>';
    return;
  }
  list.innerHTML = recent.map(item => `
    <div class="recent-item">
      <span class="chip">${item.type}</span>
      <span class="recent-name">${esc(item.name)}</span>
      <span class="recent-meta">${esc(timeAgo(item.at))}</span>
    </div>
  `).join('');
}

// ---------- Domains ----------
function renderRenewals() {
  const list = document.getElementById('renewal-list');
  if (!list) return;
  const items = state.servers
    .filter(server => server.komari && server.komari.expired_at)
    .map(server => ({ server, days: daysUntil(server.komari.expired_at) }))
    .filter(item => item.days !== null && item.days <= 30)
    .sort((a, b) => a.days - b.days);

  if (items.length === 0) {
    list.innerHTML = '<p class="empty-desc" style="padding:12px 0">30 天内没有到期的服务器。</p>';
    return;
  }

  list.innerHTML = items.map(({ server, days }) => {
    const dot = days <= 7 ? 'dot-danger' : 'dot-warning';
    const price = server.komari.price ? `${server.komari.currency}${server.komari.price}` : '';
    const when = days < 0 ? `已过期 ${Math.abs(days)} 天` : days === 0 ? '今天到期' : `${days} 天后`;
    const auto = server.komari.auto_renewal ? ' · 自动续费' : '';
    return `
      <div class="recent-item">
        <span class="dot ${dot}"></span>
        <span class="recent-name">${esc(server.name || server.ip)}</span>
        <span class="recent-meta">${when} · ${esc(price)}${auto}</span>
      </div>
    `;
  }).join('');
}

function renderCosts() {
  const list = document.getElementById('cost-list');
  if (!list) return;
  const totals = new Map();
  for (const server of state.servers) {
    const snapshot = server.komari;
    if (!snapshot || !snapshot.price || !snapshot.billing_cycle) continue;
    const monthly = snapshot.price * (30 / snapshot.billing_cycle);
    totals.set(snapshot.currency || '', (totals.get(snapshot.currency || '') || 0) + monthly);
  }
  if (totals.size === 0) {
    list.innerHTML = '<p class="empty-desc" style="padding:12px 0">同步 Komari 后显示成本统计。</p>';
    return;
  }
  list.innerHTML = [...totals.entries()].map(([currency, monthly]) => `
    <div class="cost-row">
      <span class="cost-label">${esc(currency) || '—'}</span>
      <span class="cost-value mono">${monthly.toFixed(0)} <span class="muted">/ 月</span></span>
      <span class="cost-sub mono">${(monthly * 12).toFixed(0)} <span class="muted">/ 年</span></span>
    </div>
  `).join('');
}
function renderDomains() {
  const search = (document.getElementById('domains-search')?.value || '').toLowerCase().trim();
  const statusFilter = document.getElementById('domains-filter-status')?.value || '';

  const filtered = state.domains.filter(d => {
    const haystack = [d.domain, d.alias, d.ip_address, d.registrar, d.notes].filter(Boolean).join(' ').toLowerCase();
    const matchSearch = !search || haystack.includes(search);
    const matchStatus = !statusFilter || d.dns_status === statusFilter;
    return matchSearch && matchStatus;
  });

  document.getElementById('domains-sub').textContent = `共 ${state.domains.length} 个${search || statusFilter ? ` · 筛选出 ${filtered.length} 个` : ''}`;

  const probeNote = document.getElementById('domains-probe-note');
  if (probeNote) {
    const probed = state.domains.filter(d => d.probe);
    const valid = probed.filter(d => d.probe.ok && !d.probe.placeholder && !(d.probe.status >= 500)).length;
    probeNote.textContent = probed.length ? `${valid}/${probed.length} 有效服务` : '';
  }

  const grid = document.getElementById('domains-grid');
  const table = document.getElementById('domains-table');

  if (state.domainsView === 'grid') {
    grid.classList.remove('hidden');
    table.classList.add('hidden');
    if (filtered.length === 0) {
      grid.innerHTML = emptyStateHtml(search || statusFilter ? '没有匹配的域名' : '还没有域名', search || statusFilter ? '换个关键词或清除筛选。' : '点击右上角「添加域名」，或同步 Cloudflare 自动导入。');
      return;
    }
    const ranges = computeDiffRanges();
    grid.innerHTML = filtered.map(d => domainCardHtml(d, ranges)).join('');
  } else {
    grid.classList.add('hidden');
    table.classList.remove('hidden');
    if (filtered.length === 0) {
      table.innerHTML = emptyStateHtml(search || statusFilter ? '没有匹配的域名' : '还没有域名', '点击右上角「添加域名」。');
      return;
    }
    const ranges = computeDiffRanges();
    table.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>域名</th>
            <th>解析</th>
            <th>服务</th>
            <th>状态</th>
            <th>到期</th>
            <th style="text-align:right">操作</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(d => {
            const services = (d.service_ids || []).map(id => state.services.find(s => s.id === id)).filter(Boolean);
            const meta = dnsMeta(d.dns_status);
            return `
              <tr>
                <td>
                  <div class="cell-asset">
                    ${iconHtml(d.domain, d.alias || d.domain)}
                    <div>
                      <div class="cell-name">${esc(d.alias || d.domain)}</div>
                      <div class="cell-sub">${domainHtml(d.domain, ranges.get(d.id))}</div>
                    </div>
                  </div>
                </td>
                <td class="mono">${esc(d.ip_address) || '<span class="muted">—</span>'}</td>
                <td>${services.length ? services.map(s => `<span class="chip link" onclick="goToService('${s.id}')">${esc(s.name)}</span>`).join(' ') : '<span class="muted">—</span>'}</td>
                <td><span class="status-badge"><span class="dot ${meta.dot}"></span>${meta.label}</span></td>
                <td class="mono">${esc(d.expiry_date) || '<span class="muted">—</span>'}</td>
                <td>
                  <div class="row-actions">
                    <button type="button" class="btn btn-ghost" onclick="editDomain('${d.id}')">编辑</button>
                    <button type="button" class="btn btn-ghost" onclick="deleteDomainConfirm('${d.id}')">删除</button>
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }
}

function domainCardHtml(d, ranges) {
  const services = (d.service_ids || []).map(id => state.services.find(s => s.id === id)).filter(Boolean);
  const meta = dnsMeta(d.dns_status);
  const color = d.brand_color || hashColor(d.domain);
  const name = d.alias || d.domain;

  const metaRows = [];
  if (d.ip_address) metaRows.push(`<div class="meta-row"><span class="meta-label">IP</span><span class="meta-value">${esc(d.ip_address)}</span></div>`);
  if (d.registrar) metaRows.push(`<div class="meta-row"><span class="meta-label">注册商</span><span class="meta-value text">${esc(d.registrar)}</span></div>`);
  if (d.expiry_date) metaRows.push(`<div class="meta-row"><span class="meta-label">到期</span><span class="meta-value">${esc(d.expiry_date)}</span></div>`);
  if (d.probe) {
    if (d.probe.ok) {
      const weak = d.probe.placeholder || (d.probe.status && d.probe.status >= 500);
      const dot = weak ? 'dot-warning' : 'dot-success';
      const label = [d.probe.kind || 'HTTP 服务', d.probe.status].filter(Boolean).join(' · ');
      const title = d.probe.title ? `：${d.probe.title}` : '';
      const note = d.probe.tls_invalid ? '（证书异常）' : '';
      metaRows.push(`<div class="meta-row"><span class="dot ${dot}"></span><span class="meta-value text" title="${esc(d.probe.title || '')}">${esc(label + title + note)}</span></div>`);
    } else {
      metaRows.push(`<div class="meta-row"><span class="dot dot-danger"></span><span class="meta-value text muted" title="${esc(d.probe.error || '')}">探测无响应</span></div>`);
    }
  }
  const server = serverForDomain(d);
  if (server) {
    const status = statusForServer(server);
    const dot = status ? (status.online ? 'dot-success' : 'dot-danger') : 'dot-idle';
    metaRows.push(`<div class="meta-row"><span class="meta-label">服务器</span><span class="chip link" onclick="goToServer('${server.id}')"><span class="dot ${dot}"></span>${esc(server.name || server.ip)}</span></div>`);
  }
  if (d.notes) metaRows.push(`<div class="meta-row"><span class="meta-value text muted">${esc(d.notes)}</span></div>`);

  return `
    <article class="asset-card">
      <span class="asset-stripe" style="background:${esc(color)}"></span>
      <div class="asset-head">
        ${iconHtml(d.domain, name)}
        <div class="asset-id">
          <h3 class="asset-name" title="${esc(name)}">${esc(name)}</h3>
          <div class="asset-domain" title="${esc(d.domain)}">${domainHtml(d.domain, ranges.get(d.id))}</div>
        </div>
        <span class="asset-badge status-badge"><span class="dot ${meta.dot}"></span>${meta.label}</span>
      </div>
      <div class="asset-meta">
        ${metaRows.join('')}
        ${services.length ? `<div class="asset-chips">${services.map(s => `<span class="chip link" onclick="goToService('${s.id}')">${esc(s.name)}</span>`).join('')}</div>` : ''}
      </div>
      <div class="asset-actions">
        <button type="button" class="btn btn-ghost" onclick="editDomain('${d.id}')">编辑</button>
        <button type="button" class="btn btn-ghost" onclick="deleteDomainConfirm('${d.id}')">删除</button>
      </div>
    </article>
  `;
}

function emptyStateHtml(title, desc) {
  return `
    <div class="empty-state" style="grid-column:1/-1">
      <div class="empty-icon">
        <svg viewBox="0 0 16 16" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M2 8h12"/><path d="M8 2c1.8 1.8 2.7 3.8 2.7 6S9.8 12.2 8 14C6.2 12.2 5.3 10.2 5.3 8S6.2 3.8 8 2z"/></svg>
      </div>
      <p class="empty-title">${esc(title)}</p>
      <p class="empty-desc">${esc(desc)}</p>
    </div>
  `;
}

// ---------- Domain modal ----------
function openDomainModal(id) {
  const d = id ? state.domains.find(x => x.id === id) : null;
  document.getElementById('domain-modal-title').textContent = d ? '编辑域名' : '添加域名';
  document.getElementById('domain-id').value = d ? d.id : '';
  document.getElementById('domain-name').value = d ? d.domain : '';
  document.getElementById('domain-alias').value = d ? (d.alias || '') : '';
  document.getElementById('domain-ip').value = d ? (d.ip_address || '') : '';
  document.getElementById('domain-dns-status').value = d ? (d.dns_status || 'inactive') : 'inactive';
  document.getElementById('domain-registrar').value = d ? (d.registrar || '') : '';
  document.getElementById('domain-expiry').value = d ? (d.expiry_date || '') : '';
  document.getElementById('domain-ssl-status').value = d ? (d.ssl_status || 'unknown') : 'unknown';
  document.getElementById('domain-notes').value = d ? (d.notes || '') : '';

  const selected = d ? (d.service_ids || []) : [];
  document.getElementById('domain-service').innerHTML = state.services.map(s =>
    `<option value="${s.id}" ${selected.includes(s.id) ? 'selected' : ''}>${esc(s.name)}</option>`
  ).join('');

  updateDomainPreview();
  openModal('modal-domain');
  setTimeout(() => document.getElementById('domain-name').focus(), 0);
}

function editDomain(id) {
  openDomainModal(id);
}

function updateDomainPreview() {
  const name = document.getElementById('domain-name').value.trim();
  const id = document.getElementById('domain-id').value;
  const hint = document.getElementById('domain-similarity');
  if (!name) {
    hint.textContent = '—';
    hint.classList.remove('warn');
    return;
  }
  const similar = findSimilarDomain(name, id);
  if (similar) {
    hint.textContent = `与 ${similar} 相似，请确认`;
    hint.classList.add('warn');
  } else {
    hint.textContent = '未发现相似域名';
    hint.classList.remove('warn');
  }
}

async function saveDomain(event) {
  event.preventDefault();
  const id = document.getElementById('domain-id').value;
  const serviceIds = Array.from(document.getElementById('domain-service').selectedOptions).map(o => o.value).filter(Boolean);
  const payload = {
    domain: document.getElementById('domain-name').value.trim(),
    alias: document.getElementById('domain-alias').value.trim(),
    ip_address: document.getElementById('domain-ip').value.trim(),
    dns_status: document.getElementById('domain-dns-status').value,
    registrar: document.getElementById('domain-registrar').value.trim(),
    expiry_date: document.getElementById('domain-expiry').value || null,
    ssl_status: document.getElementById('domain-ssl-status').value,
    notes: document.getElementById('domain-notes').value.trim(),
    service_ids: serviceIds,
  };

  try {
    if (id) {
      await api(`/api/domains/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      showToast('success', '域名已更新', payload.domain);
    } else {
      await api('/api/domains', { method: 'POST', body: JSON.stringify(payload) });
      showToast('success', '域名已添加', payload.domain);
    }
    closeModal('modal-domain');
    await loadDomains();
    renderAll();
  } catch (e) {
    showToast('error', '保存失败', e.message);
  }
}

function deleteDomainConfirm(id) {
  const d = state.domains.find(x => x.id === id);
  if (!d) return;
  confirmDialog('删除域名', `确定删除「${d.alias || d.domain}」吗？关联的服务不会被删除。`, async () => {
    try {
      await api(`/api/domains/${id}`, { method: 'DELETE' });
      showToast('success', '域名已删除', d.domain);
      await loadDomains();
      renderAll();
    } catch (e) {
      showToast('error', '删除失败', e.message);
    }
  });
}

// ---------- Services ----------
function renderServices() {
  const search = (document.getElementById('services-search')?.value || '').toLowerCase().trim();
  const statusFilter = document.getElementById('services-filter-status')?.value || '';

  const filtered = state.services.filter(s => {
    const haystack = [s.name, s.domain, s.notes].filter(Boolean).join(' ').toLowerCase();
    const matchSearch = !search || haystack.includes(search);
    const matchStatus = !statusFilter || s.status === statusFilter;
    return matchSearch && matchStatus;
  });

  document.getElementById('services-sub').textContent = `共 ${state.services.length} 个${search || statusFilter ? ` · 筛选出 ${filtered.length} 个` : ''}`;

  const inferNote = document.getElementById('services-infer-note');
  if (inferNote) {
    const inferable = state.domains.filter(d => serverForDomain(d) && !serviceForDomainFrontend(d)).length;
    inferNote.textContent = inferable ? `${inferable} 个域名可推断为服务` : '';
  }

  const grid = document.getElementById('services-grid');
  const table = document.getElementById('services-table');

  if (state.servicesView === 'grid') {
    grid.classList.remove('hidden');
    table.classList.add('hidden');
    if (filtered.length === 0) {
      grid.innerHTML = emptyStateHtml(search || statusFilter ? '没有匹配的服务' : '还没有服务', search || statusFilter ? '换个关键词或清除筛选。' : '点击右上角「添加服务」记录第一个部署。');
      return;
    }
    grid.innerHTML = filtered.map(serviceCardHtml).join('');
  } else {
    grid.classList.add('hidden');
    table.classList.remove('hidden');
    if (filtered.length === 0) {
      table.innerHTML = emptyStateHtml('没有匹配的服务', '点击右上角「添加服务」。');
      return;
    }
    table.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>服务</th>
            <th>域名</th>
            <th>状态</th>
            <th>备注</th>
            <th style="text-align:right">操作</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(s => {
            const meta = serviceStatusMeta(s.status);
            return `
              <tr>
                <td>
                  <div class="cell-asset">
                    ${serviceIconHtml(s)}
                    <div>
                      <div class="cell-name">${esc(s.name)}</div>
                      <div class="cell-sub">${esc(timeAgo(s.updated_at))}</div>
                    </div>
                  </div>
                </td>
                <td>${serviceDomainsHtml(s)}</td>
                <td><span class="status-badge"><span class="dot ${meta.dot}"></span>${meta.label}</span></td>
                <td class="muted">${esc(s.notes || '—')}</td>
                <td>
                  <div class="row-actions">
                    <button type="button" class="btn btn-ghost" onclick="openDeployments('${s.id}')">部署</button>
                    <button type="button" class="btn btn-ghost" onclick="editService('${s.id}')">编辑</button>
                    <button type="button" class="btn btn-ghost" onclick="deleteServiceConfirm('${s.id}')">删除</button>
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }
}

function serviceDomainsHtml(service) {
  const domains = String(service.domain || '').split(',').map(d => d.trim()).filter(Boolean);
  if (domains.length === 0) return '<span class="muted">—</span>';
  return domains.map(d => `<span class="chip link" onclick="goToDomain('${esc(d)}')">${esc(d)}</span>`).join(' ');
}

function serviceCardHtml(s) {
  const meta = serviceStatusMeta(s.status);
  const domain = firstDomain(s.domain);
  const color = hashColor(domain || s.name);
  const domains = String(s.domain || '').split(',').map(d => d.trim()).filter(Boolean);
  const deps = deploymentsOf(s.id);

  return `
    <article class="asset-card">
      <span class="asset-stripe" style="background:${esc(color)}"></span>
      <div class="asset-head">
        ${serviceIconHtml(s)}
        <div class="asset-id">
          <h3 class="asset-name" title="${esc(s.name)}">${esc(s.name)}</h3>
          <div class="asset-domain">${domain ? domainHtml(domain) : '<span class="tld">未关联域名</span>'}</div>
        </div>
        <span class="asset-badge status-badge"><span class="dot ${meta.dot}"></span>${meta.label}</span>
      </div>
      <div class="asset-meta">
        ${domains.length > 1 ? `<div class="asset-chips">${domains.slice(1).map(d => `<span class="chip link" onclick="goToDomain('${esc(d)}')">${esc(d)}</span>`).join('')}</div>` : ''}
        ${deps.length ? `<div class="asset-chips">${deps.map(dep => `<span class="chip">${esc(deploymentLabel(dep))}</span>`).join('')}</div>` : ''}
        ${(s.auto_created || s.kind || (s.probe && (!s.probe.ok || s.probe.placeholder || s.probe.status >= 500))) ? `<div class="asset-chips">${s.auto_created ? '<span class="chip">自动推断</span>' : ''}${s.kind ? `<span class="chip">${esc(s.kind)}</span>` : ''}${serviceProbeChipHtml(s)}</div>` : ''}
        ${s.notes ? `<div class="meta-row"><span class="meta-value text muted">${esc(s.notes)}</span></div>` : ''}
      </div>
      <div class="asset-actions">
        <button type="button" class="btn btn-ghost" onclick="openDeployments('${s.id}')">部署</button>
        <button type="button" class="btn btn-ghost" onclick="editService('${s.id}')">编辑</button>
        <button type="button" class="btn btn-ghost" onclick="deleteServiceConfirm('${s.id}')">删除</button>
      </div>
    </article>
  `;
}

function deploymentLabel(dep) {
  const server = state.servers.find(s => s.id === dep.server_id);
  const serverName = server ? (server.name || server.ip) : '未知服务器';
  return dep.port ? `${serverName} :${dep.port}` : serverName;
}

function deploymentsOf(serviceId) {
  return state.deployments.filter(dep => dep.service_id === serviceId);
}

function deploymentsOfServer(serverId) {
  return state.deployments.filter(dep => dep.server_id === serverId);
}

function domainsOnServer(server) {
  const ip = String(server.ip || '').trim();
  if (!ip) return [];
  return state.domains.filter(d => String(d.ip_address || '').split(',').map(x => x.trim()).includes(ip));
}

// ---------- Komari ----------
function komariConfigured() {
  return Boolean(state.settings.komari_api_key_set || state.settings.komari_env_key);
}

function komariFresh() {
  if (!state.komari) return false;
  const fetched = new Date(state.komari.fetched_at || 0).getTime();
  return Date.now() - fetched < 55000;
}

async function ensureKomari(force = false) {
  if (!force && komariFresh()) return state.komari;
  state.komari = await api(`/api/komari/overview${force ? '?refresh=1' : ''}`);
  return state.komari;
}

async function syncKomari(createMissing = true, { silent = false } = {}) {
  const btn = document.querySelector('#view-servers .toolbar .btn-secondary');
  if (btn && !silent) btn.disabled = true;
  try {
    const result = await api(createMissing ? '/api/komari/import' : '/api/komari/sync', { method: 'POST' });
    await Promise.all([loadServers(), loadDeployments()]);
    await ensureKomari(true).catch(() => {});
    renderAll();
    if (!silent) {
      const suffix = result.fallback_reason ? `（已降级公开接口：${result.fallback_reason}）` : '';
      showToast('success', 'Komari 同步完成', `共 ${result.total} 个节点，新建 ${result.created}，关联 ${result.linked}${suffix}`);
    }
    return result;
  } catch (e) {
    if (!silent) showToast('error', 'Komari 同步失败', e.message);
    return null;
  } finally {
    if (btn && !silent) btn.disabled = false;
  }
}

function nodeForServer(server) {
  if (!server.komari_uuid || !state.komari) return null;
  return state.komari.nodes.find(node => node.uuid === server.komari_uuid) || null;
}

function statusForServer(server) {
  if (!server.komari_uuid || !state.komari || !state.komari.status) return null;
  return state.komari.status[server.komari_uuid] || null;
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  if (Number.isNaN(diff)) return null;
  return Math.ceil(diff / 86400000);
}

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)));
  return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatUptime(seconds) {
  const value = Number(seconds) || 0;
  const days = Math.floor(value / 86400);
  const hours = Math.floor((value % 86400) / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  if (days > 0) return `${days}天${hours}小时`;
  if (hours > 0) return `${hours}小时${minutes}分`;
  return `${minutes}分`;
}

function meterRow(label, used, total) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const level = pct >= 90 ? 'danger' : pct >= 75 ? 'warn' : '';
  return `<div class="meter-row"><span class="meter-label">${label}</span><span class="meter ${level}"><i style="width:${pct}%"></i></span><span class="meter-value">${pct}%</span></div>`;
}

function serverStatusHtml(server) {
  if (!server.komari_uuid) return '';
  const status = statusForServer(server);
  if (!status) {
    return '<div class="status-line"><span class="dot dot-idle"></span><span>状态待同步</span></div>';
  }
  if (!status.online) {
    return '<div class="status-line"><span class="dot dot-danger"></span><span>离线</span></div>';
  }
  return `
    <div class="status-line"><span class="dot dot-success"></span><span>在线 · 负载 ${status.load.toFixed(2)} · 运行 ${esc(formatUptime(status.uptime))}</span></div>
    ${meterRow('CPU', status.cpu, 100)}
    ${meterRow('内存', status.ram, status.ram_total)}
    ${meterRow('磁盘', status.disk, status.disk_total)}
  `;
}

function renewalChipHtml(server) {
  const snapshot = server.komari;
  if (!snapshot || !snapshot.expired_at) return '';
  const days = daysUntil(snapshot.expired_at);
  if (days === null || days > 30) return '';
  const dot = days <= 7 ? 'dot-danger' : 'dot-warning';
  const text = days < 0 ? `已过期 ${Math.abs(days)} 天` : days === 0 ? '今天到期' : `${days} 天后到期`;
  return `<span class="chip"><span class="dot ${dot}"></span>${text}</span>`;
}

function snapshotFromNode(node) {
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

function serverForDomain(domain) {
  const ips = String(domain.ip_address || '').split(',').map(v => v.trim()).filter(Boolean);
  if (ips.length === 0) return null;
  return state.servers.find(server => {
    const serverIps = String(server.ip || '').split(',').map(v => v.trim()).filter(Boolean);
    return serverIps.some(ip => ips.includes(ip));
  }) || null;
}

function goToServer(id) {
  const server = state.servers.find(s => s.id === id);
  navigate('servers');
  const input = document.getElementById('servers-search');
  if (input) input.value = server ? (server.name || server.ip || '') : '';
  renderServers();
}

// ---------- Service discovery ----------
function serviceForDomainFrontend(domain) {
  return state.services.find(service => {
    const list = String(service.domain || '').split(',').map(v => v.trim()).filter(Boolean);
    return list.includes(domain.domain) || (domain.service_ids || []).includes(service.id);
  }) || null;
}

async function discoverServices({ silent = false } = {}) {
  const btn = document.querySelector('#view-services .toolbar .btn-secondary');
  const note = document.getElementById('services-infer-note');
  if (btn && !silent) btn.disabled = true;
  if (note && !silent) note.textContent = '探测中…';
  try {
    const result = await api('/api/services/discover', { method: 'POST' });
    await Promise.all([loadServices(), loadDomains(), loadDeployments()]);
    renderAll();
    if (!silent) {
      const parts = [`新建 ${result.created} 个服务`];
      if (result.skipped) parts.push(`跳过 ${result.skipped} 个已关联`);
      if (result.noResponse) parts.push(`${result.noResponse} 个无响应未创建`);
      if (result.noService) parts.push(`${result.noService} 个非有效服务未创建`);
      if (result.noServer) parts.push(`${result.noServer} 个未匹配服务器`);
      showToast('success', '服务推断完成', parts.join('，'));
    }
    return result;
  } catch (e) {
    if (note && !silent) note.textContent = '';
    if (!silent) showToast('error', '推断失败', e.message);
    return null;
  } finally {
    if (btn && !silent) btn.disabled = false;
  }
}

async function probeDomains() {
  const btn = document.querySelector('#view-domains .toolbar .btn-secondary');
  const note = document.getElementById('domains-probe-note');
  if (btn) btn.disabled = true;
  if (note) note.textContent = '探测中…';
  try {
    const result = await api('/api/domains/probe', { method: 'POST' });
    await loadDomains();
    renderDomains();
    const valid = result.results.filter(r => r.ok && !r.placeholder && !(r.status >= 500)).length;
    showToast('success', '探测完成', `有效服务 ${valid}/${result.total} 个`);
  } catch (e) {
    if (note) note.textContent = '';
    showToast('error', '探测失败', e.message);
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ---------- Service modal ----------
function openServiceModal(id) {
  const s = id ? state.services.find(x => x.id === id) : null;
  document.getElementById('service-modal-title').textContent = s ? '编辑服务' : '添加服务';
  document.getElementById('service-id').value = s ? s.id : '';
  document.getElementById('service-name').value = s ? s.name : '';
  document.getElementById('service-status').value = s ? (s.status || 'running') : 'running';
  document.getElementById('service-domain').value = s ? (s.domain || '') : '';
  document.getElementById('service-notes').value = s ? (s.notes || '') : '';

  const preview = document.getElementById('service-cover-preview');
  if (s && s.cover_image) {
    preview.src = s.cover_image;
    preview.classList.remove('hidden');
  } else {
    preview.classList.add('hidden');
    preview.removeAttribute('src');
  }
  openModal('modal-service');
  setTimeout(() => document.getElementById('service-name').focus(), 0);
}

function editService(id) {
  openServiceModal(id);
}

async function saveService(event) {
  event.preventDefault();
  const id = document.getElementById('service-id').value;
  const payload = {
    name: document.getElementById('service-name').value.trim(),
    status: document.getElementById('service-status').value,
    domain: document.getElementById('service-domain').value.trim(),
    notes: document.getElementById('service-notes').value.trim(),
  };

  try {
    if (id) {
      await api(`/api/services/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      showToast('success', '服务已更新', payload.name);
    } else {
      await api('/api/services', { method: 'POST', body: JSON.stringify(payload) });
      showToast('success', '服务已添加', payload.name);
    }
    closeModal('modal-service');
    await Promise.all([loadServices(), loadDomains()]);
    renderAll();
  } catch (e) {
    showToast('error', '保存失败', e.message);
  }
}

function deleteServiceConfirm(id) {
  const s = state.services.find(x => x.id === id);
  if (!s) return;
  confirmDialog('删除服务', `确定删除「${s.name}」吗？域名记录会保留，但关联会被解除。`, async () => {
    try {
      await api(`/api/services/${id}`, { method: 'DELETE' });
      showToast('success', '服务已删除', s.name);
      await Promise.all([loadServices(), loadDomains()]);
      renderAll();
    } catch (e) {
      showToast('error', '删除失败', e.message);
    }
  });
}

async function uploadCover(event) {
  const file = event.target.files[0];
  if (!file) return;
  const serviceId = document.getElementById('service-id').value;
  if (!serviceId) {
    showToast('error', '请先保存服务', '保存后才能上传封面');
    event.target.value = '';
    return;
  }
  const formData = new FormData();
  formData.append('cover', file);
  try {
    const resp = await fetch(`/api/services/${serviceId}/cover`, { method: 'POST', body: formData });
    if (resp.status === 401) {
      window.location.href = '/login';
      return;
    }
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || '上传失败');
    const preview = document.getElementById('service-cover-preview');
    preview.src = data.url;
    preview.classList.remove('hidden');
    showToast('success', '封面已上传');
    await loadServices();
    renderServices();
  } catch (e) {
    showToast('error', '上传失败', e.message);
  } finally {
    event.target.value = '';
  }
}

// ---------- Servers ----------
function renderServers() {
  const search = (document.getElementById('servers-search')?.value || '').toLowerCase().trim();
  const filtered = state.servers.filter(s => {
    const haystack = [s.name, s.provider, s.ip, s.region, s.notes].filter(Boolean).join(' ').toLowerCase();
    return !search || haystack.includes(search);
  });

  document.getElementById('servers-sub').textContent = `共 ${state.servers.length} 台${search ? ` · 筛选出 ${filtered.length} 台` : ''}`;

  const note = document.getElementById('servers-komari-note');
  if (note) {
    if (state.komari) {
      const source = state.komari.source === 'admin' ? 'API Key' : '公开接口';
      note.textContent = `Komari ${source} · ${state.komari.nodes.length} 节点 · ${timeAgo(state.komari.fetched_at)}同步`;
    } else if (!komariConfigured()) {
      note.textContent = '未配置 Komari（设置里可填 API Key）';
    } else {
      note.textContent = '';
    }
  }

  const grid = document.getElementById('servers-grid');
  if (filtered.length === 0) {
    grid.innerHTML = emptyStateHtml(
      search ? '没有匹配的服务器' : '还没有服务器',
      search ? '换个关键词。' : '点击右上角「同步 Komari」自动导入，或手动添加服务器。'
    );
    return;
  }
  grid.innerHTML = filtered.map(serverCardHtml).join('');
}

function serverCardHtml(s) {
  const deps = deploymentsOfServer(s.id);
  const domains = domainsOnServer(s);
  const color = hashColor(s.ip || s.name);
  const name = s.name || s.ip || '未命名服务器';
  const node = nodeForServer(s);
  const snapshot = s.komari || null;
  const statusHtml = serverStatusHtml(s);
  const renewal = renewalChipHtml(s);

  const metaRows = [];
  if (s.ip) metaRows.push(`<div class="meta-row"><span class="meta-label">IP</span><span class="meta-value">${esc(s.ip)}</span></div>`);
  const location = [s.provider || (snapshot && snapshot.region) || (node && node.region), s.region].filter(Boolean).join(' · ');
  if (location) metaRows.push(`<div class="meta-row"><span class="meta-label">位置</span><span class="meta-value text">${esc(location)}</span></div>`);
  if (snapshot && (snapshot.cpu_cores || snapshot.mem_total || snapshot.disk_total)) {
    const specs = [
      snapshot.cpu_cores ? `${snapshot.cpu_cores}C` : '',
      snapshot.mem_total ? formatBytes(snapshot.mem_total) : '',
      snapshot.disk_total ? formatBytes(snapshot.disk_total) : '',
    ].filter(Boolean).join(' · ');
    metaRows.push(`<div class="meta-row"><span class="meta-label">配置</span><span class="meta-value">${esc(specs)}</span></div>`);
  }
  if (snapshot && snapshot.price) {
    const cycle = snapshot.billing_cycle ? ` / ${snapshot.billing_cycle}天` : '';
    const auto = snapshot.auto_renewal ? ' · 自动续费' : '';
    metaRows.push(`<div class="meta-row"><span class="meta-label">费用</span><span class="meta-value">${esc(snapshot.currency)}${esc(snapshot.price)}${cycle}${auto}</span></div>`);
  }
  if (s.ssh_port && Number(s.ssh_port) !== 22) {
    metaRows.push(`<div class="meta-row"><span class="meta-label">SSH</span><span class="meta-value">:${esc(s.ssh_port)}</span></div>`);
  }
  if (s.notes) metaRows.push(`<div class="meta-row"><span class="meta-value text muted">${esc(s.notes)}</span></div>`);

  const komariLink = state.komari && state.komari.base_url && s.komari_uuid
    ? `<a class="btn btn-ghost" href="${esc(state.komari.base_url)}" target="_blank" rel="noopener">Komari</a>`
    : '';

  return `
    <article class="asset-card">
      <span class="asset-stripe" style="background:${esc(color)}"></span>
      <div class="asset-head">
        ${iconHtml('', name)}
        <div class="asset-id">
          <h3 class="asset-name" title="${esc(name)}">${esc(name)}</h3>
          <div class="asset-domain"><span class="tld">${deps.length} 个部署 · ${domains.length} 个解析域名</span></div>
        </div>
        ${renewal ? `<span class="asset-badge">${renewal}</span>` : ''}
      </div>
      <div class="asset-meta">
        ${metaRows.join('')}
        ${statusHtml ? `<div class="server-status">${statusHtml}</div>` : ''}
        ${deps.length ? `<div class="asset-chips">${deps.map(dep => {
          const svc = state.services.find(x => x.id === dep.service_id);
          return `<span class="chip link" onclick="openDeployments('${dep.service_id}')">${esc(svc ? svc.name : '未知服务')}</span>`;
        }).join('')}</div>` : ''}
        ${domains.length ? `<div class="asset-chips">${domains.map(d => `<span class="chip link" onclick="goToDomain('${esc(d.domain)}')">${esc(d.domain)}</span>`).join('')}</div>` : ''}
      </div>
      <div class="asset-actions">
        ${komariLink}
        <button type="button" class="btn btn-ghost" onclick="editServer('${s.id}')">编辑</button>
        <button type="button" class="btn btn-ghost" onclick="deleteServerConfirm('${s.id}')">删除</button>
      </div>
    </article>
  `;
}

function openServerModal(id) {
  const s = id ? state.servers.find(x => x.id === id) : null;
  document.getElementById('server-modal-title').textContent = s ? '编辑服务器' : '添加服务器';
  document.getElementById('server-id').value = s ? s.id : '';
  document.getElementById('server-name').value = s ? (s.name || '') : '';
  document.getElementById('server-provider').value = s ? (s.provider || '') : '';
  document.getElementById('server-ip').value = s ? (s.ip || '') : '';
  document.getElementById('server-ssh-port').value = s && s.ssh_port ? s.ssh_port : '';
  document.getElementById('server-region').value = s ? (s.region || '') : '';
  document.getElementById('server-notes').value = s ? (s.notes || '') : '';

  const select = document.getElementById('server-komari');
  const nodes = state.komari ? state.komari.nodes : [];
  const options = [];
  if (nodes.length === 0) {
    options.push('<option value="">（未加载 Komari 节点）</option>');
    if (s && s.komari_uuid) {
      options.push(`<option value="${s.komari_uuid}" selected>${esc(s.komari?.name || s.komari_uuid)}（当前）</option>`);
    }
  } else {
    options.push('<option value="">不关联</option>');
    for (const node of nodes) {
      const label = `${node.name}${node.ipv4 ? ` · ${node.ipv4}` : ''}`;
      options.push(`<option value="${node.uuid}" ${s && s.komari_uuid === node.uuid ? 'selected' : ''}>${esc(label)}</option>`);
    }
    if (s && s.komari_uuid && !nodes.some(n => n.uuid === s.komari_uuid)) {
      options.push(`<option value="${s.komari_uuid}" selected>${esc(s.komari?.name || s.komari_uuid)}（当前）</option>`);
    }
  }
  select.innerHTML = options.join('');

  openModal('modal-server');
  setTimeout(() => document.getElementById('server-name').focus(), 0);
}

function editServer(id) {
  openServerModal(id);
}

async function saveServer(event) {
  event.preventDefault();
  const id = document.getElementById('server-id').value;
  const portValue = document.getElementById('server-ssh-port').value.trim();
  const payload = {
    name: document.getElementById('server-name').value.trim(),
    provider: document.getElementById('server-provider').value.trim(),
    ip: document.getElementById('server-ip').value.trim(),
    ssh_port: portValue ? Number(portValue) : null,
    region: document.getElementById('server-region').value.trim(),
    notes: document.getElementById('server-notes').value.trim(),
  };

  const komariUuid = document.getElementById('server-komari').value;
  if (komariUuid) {
    payload.komari_uuid = komariUuid;
    const node = state.komari ? state.komari.nodes.find(n => n.uuid === komariUuid) : null;
    if (node) payload.komari = snapshotFromNode(node);
  } else {
    payload.komari_uuid = '';
    payload.komari = null;
  }

  try {
    if (id) {
      await api(`/api/servers/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      showToast('success', '服务器已更新', payload.name);
    } else {
      await api('/api/servers', { method: 'POST', body: JSON.stringify(payload) });
      showToast('success', '服务器已添加', payload.name);
    }
    closeModal('modal-server');
    await loadServers();
    renderAll();
  } catch (e) {
    showToast('error', '保存失败', e.message);
  }
}

function deleteServerConfirm(id) {
  const s = state.servers.find(x => x.id === id);
  if (!s) return;
  const depCount = deploymentsOfServer(id).length;
  const extra = depCount ? `同时会移除 ${depCount} 条部署记录。` : '';
  confirmDialog('删除服务器', `确定删除「${s.name || s.ip}」吗？${extra}`, async () => {
    try {
      await api(`/api/servers/${id}`, { method: 'DELETE' });
      showToast('success', '服务器已删除', s.name || s.ip);
      await Promise.all([loadServers(), loadDeployments()]);
      renderAll();
    } catch (e) {
      showToast('error', '删除失败', e.message);
    }
  });
}

// ---------- Deployments ----------
function openDeployments(serviceId) {
  const service = state.services.find(s => s.id === serviceId);
  if (!service) return;
  document.getElementById('deployment-service-id').value = serviceId;
  document.getElementById('deployment-modal-title').textContent = `部署 · ${service.name}`;

  const select = document.getElementById('deployment-server');
  select.innerHTML = state.servers.length
    ? state.servers.map(s => `<option value="${s.id}">${esc(s.name || s.ip)}${s.ip ? ` · ${esc(s.ip)}` : ''}</option>`).join('')
    : '<option value="">请先添加服务器</option>';

  document.getElementById('deployment-port').value = '';
  document.getElementById('deployment-path').value = '';
  document.getElementById('deployment-container').value = '';

  renderDeploymentList();
  openModal('modal-deployment');
}

function renderDeploymentList() {
  const serviceId = document.getElementById('deployment-service-id').value;
  const deps = deploymentsOf(serviceId);
  const list = document.getElementById('deployment-list');
  if (deps.length === 0) {
    list.innerHTML = '<p class="field-hint">还没有部署记录，添加后这里会显示服务器与端口。</p>';
    return;
  }
  list.innerHTML = deps.map(dep => {
    const server = state.servers.find(s => s.id === dep.server_id);
    const address = [dep.protocol, dep.port].filter(Boolean).join(' ');
    const detail = [address, dep.path, dep.container].filter(Boolean).join(' · ');
    return `
      <div class="deployment-row">
        <div class="deployment-main">
          <div class="deployment-server">${esc(server ? (server.name || server.ip) : '未知服务器')}</div>
          <div class="deployment-detail mono">${esc(detail || '—')}</div>
        </div>
        <button type="button" class="btn btn-ghost" onclick="deleteDeploymentConfirm('${dep.id}')">移除</button>
      </div>
    `;
  }).join('');
}

async function saveDeployment(event) {
  event.preventDefault();
  const serviceId = document.getElementById('deployment-service-id').value;
  const serverId = document.getElementById('deployment-server').value;
  if (!serverId) {
    showToast('error', '请先添加服务器');
    return;
  }
  const payload = {
    service_id: serviceId,
    server_id: serverId,
    port: document.getElementById('deployment-port').value.trim(),
    protocol: document.getElementById('deployment-protocol').value,
    path: document.getElementById('deployment-path').value.trim(),
    container: document.getElementById('deployment-container').value.trim(),
  };
  try {
    await api('/api/deployments', { method: 'POST', body: JSON.stringify(payload) });
    showToast('success', '部署已添加', deploymentLabel(payload));
    document.getElementById('deployment-port').value = '';
    document.getElementById('deployment-path').value = '';
    document.getElementById('deployment-container').value = '';
    await loadDeployments();
    renderDeploymentList();
    renderServices();
    renderServers();
  } catch (e) {
    showToast('error', '添加失败', e.message);
  }
}

function deleteDeploymentConfirm(id) {
  const dep = state.deployments.find(d => d.id === id);
  if (!dep) return;
  confirmDialog('移除部署', `确定移除「${deploymentLabel(dep)}」这条部署记录吗？`, async () => {
    try {
      await api(`/api/deployments/${id}`, { method: 'DELETE' });
      showToast('success', '部署已移除');
      await loadDeployments();
      renderDeploymentList();
      renderServices();
      renderServers();
    } catch (e) {
      showToast('error', '移除失败', e.message);
    }
  });
}

// ---------- Command palette ----------
function openPalette() {
  document.getElementById('palette').classList.remove('hidden');
  const input = document.getElementById('palette-input');
  input.value = '';
  renderPalette('');
  setTimeout(() => input.focus(), 0);
}

function closePalette() {
  document.getElementById('palette').classList.add('hidden');
}

function paletteSourceItems(query) {
  const q = query.toLowerCase().trim();
  const domains = state.domains.map(d => ({
    type: 'domain',
    name: d.alias || d.domain,
    domain: d.domain,
    sub: d.ip_address || d.domain,
    haystack: [d.domain, d.alias, d.ip_address, d.registrar, d.notes].filter(Boolean).join(' ').toLowerCase(),
  }));
  const services = state.services.map(s => ({
    type: 'service',
    name: s.name,
    domain: firstDomain(s.domain),
    sub: s.domain || '—',
    id: s.id,
    haystack: [s.name, s.domain, s.notes].filter(Boolean).join(' ').toLowerCase(),
  }));
  const all = [...domains, ...services, ...state.servers.map(s => ({
    type: 'server',
    name: s.name || s.ip,
    domain: '',
    sub: [s.ip, s.provider].filter(Boolean).join(' · ') || '—',
    id: s.id,
    haystack: [s.name, s.provider, s.ip, s.region, s.notes].filter(Boolean).join(' ').toLowerCase(),
  }))];
  return q ? all.filter(item => item.haystack.includes(q)) : all;
}

function renderPalette(query) {
  state.paletteItems = paletteSourceItems(query).slice(0, 12);
  state.paletteIndex = 0;
  const list = document.getElementById('palette-list');
  if (state.paletteItems.length === 0) {
    list.innerHTML = '<p class="palette-empty">没有匹配结果</p>';
    return;
  }
  list.innerHTML = state.paletteItems.map((item, i) => `
    <div class="palette-row ${i === 0 ? 'active' : ''}" onclick="paletteChoose(${i})" onmousemove="paletteHover(${i})">
      ${iconHtml(item.domain, item.name)}
      <span class="palette-name">${esc(item.name)}</span>
      <span class="palette-sub">${esc(item.sub)}</span>
      <span class="palette-type">${item.type === 'domain' ? '域名' : item.type === 'service' ? '服务' : '服务器'}</span>
    </div>
  `).join('');
}

function paletteHover(index) {
  if (state.paletteIndex === index) return;
  state.paletteIndex = index;
  document.querySelectorAll('.palette-row').forEach((row, i) => row.classList.toggle('active', i === index));
}

function movePalette(delta) {
  const count = state.paletteItems.length;
  if (count === 0) return;
  state.paletteIndex = (state.paletteIndex + delta + count) % count;
  document.querySelectorAll('.palette-row').forEach((row, i) => {
    row.classList.toggle('active', i === state.paletteIndex);
    if (i === state.paletteIndex) row.scrollIntoView({ block: 'nearest' });
  });
}

function paletteChoose(index) {
  const item = state.paletteItems[index];
  if (!item) return;
  closePalette();
  if (item.type === 'domain') {
    goToDomain(item.domain);
  } else if (item.type === 'service') {
    goToService(item.id);
  } else {
    navigate('servers');
    document.getElementById('servers-search').value = item.name;
    renderServers();
  }
}

// ---------- Cloudflare ----------
async function syncFromCloudflare() {
  const btn = document.getElementById('btn-sync');
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.textContent = '同步中…';
  try {
    const result = await api('/api/cf/sync', { method: 'POST' });
    showToast('success', '同步完成', `发现 ${result.total_zones} 个域名，新增 ${result.added} 个，更新 ${result.updated} 个`);
    await Promise.all([loadDomains(), loadServices()]);
    renderAll();
  } catch (e) {
    if (String(e.message).includes('not set')) {
      showToast('error', '同步失败', '请先在设置中配置 Cloudflare API Token');
    } else {
      showToast('error', '同步失败', e.message);
    }
  } finally {
    btn.disabled = false;
    btn.innerHTML = original;
  }
}

// ---------- Settings ----------
function openSettings() {
  document.getElementById('settings-cf-note').textContent = state.settings.cf_api_token_set ? 'Token 已配置。' : '尚未配置 Token。';
  document.getElementById('settings-komari-url').value = state.settings.komari_url || '';
  document.getElementById('settings-komari-key').value = '';
  const note = document.getElementById('settings-komari-note');
  if (state.settings.komari_env_key) {
    note.textContent = 'API Key 由 KOMARI_API_KEY 环境变量提供，面板内设置不生效。';
  } else if (state.settings.komari_api_key_set) {
    note.textContent = `API Key 已配置；当前地址 ${state.settings.komari_base_url}。`;
  } else {
    note.textContent = '用于自动导入服务器、显示实时状态与续费；告警仍由 Komari 自己发送。';
  }
  openModal('modal-settings');
}

async function saveKomariSettings() {
  const note = document.getElementById('settings-komari-note');
  const url = document.getElementById('settings-komari-url').value.trim();
  const key = document.getElementById('settings-komari-key').value.trim();
  if (!url && !key) {
    note.textContent = '请填写 Komari 地址或 API Key。';
    return false;
  }
  try {
    const payload = {};
    if (url) payload.komari_url = url;
    if (key) payload.komari_api_key = key;
    state.settings = await api('/api/settings', { method: 'PUT', body: JSON.stringify(payload) });
    document.getElementById('settings-komari-key').value = '';
    note.textContent = `已保存；当前地址 ${state.settings.komari_base_url}。`;
    await ensureKomari(true).catch(() => {});
    renderServers();
    return true;
  } catch (e) {
    note.textContent = `保存失败：${e.message}`;
    return false;
  }
}

async function testKomariConnection() {
  const note = document.getElementById('settings-komari-note');
  const url = document.getElementById('settings-komari-url').value.trim();
  const key = document.getElementById('settings-komari-key').value.trim();
  note.textContent = '连接中…';
  try {
    if (url || key) {
      const payload = {};
      if (url) payload.komari_url = url;
      if (key) payload.komari_api_key = key;
      state.settings = await api('/api/settings', { method: 'PUT', body: JSON.stringify(payload) });
      document.getElementById('settings-komari-key').value = '';
    }
    const data = await api('/api/komari/overview?refresh=1');
    state.komari = data;
    const source = data.source === 'admin' ? 'API Key 模式' : '公开接口';
    note.textContent = `连接成功：${data.nodes.length} 个节点（${source}${data.fallback_reason ? `，已降级：${data.fallback_reason}` : ''}）。`;
    renderServers();
  } catch (e) {
    note.textContent = `连接失败：${e.message}`;
  }
}

function updateCFStatus(connected) {
  const dot = document.getElementById('cf-status-dot');
  const text = document.getElementById('cf-status-text');
  if (!dot || !text) return;
  dot.className = `dot ${connected ? 'dot-success' : 'dot-idle'}`;
  text.textContent = connected ? 'CF 已连接' : 'CF 未连接';
}

async function saveCFToken() {
  const input = document.getElementById('settings-cf-token');
  const note = document.getElementById('settings-cf-note');
  const token = input.value.trim();
  if (!token) {
    note.textContent = '请输入 Cloudflare API Token';
    return;
  }
  note.textContent = '保存中…';
  try {
    const data = await api('/api/settings', { method: 'PUT', body: JSON.stringify({ cf_api_token: token }) });
    if (data.cf_api_token_set) {
      note.textContent = 'Token 已保存，可以点击「验证连接」。';
      input.value = '';
      state.settings = data;
      updateCFStatus(true);
    } else {
      note.textContent = '保存失败，请重试。';
    }
  } catch (e) {
    note.textContent = `保存失败：${e.message}`;
  }
}

async function testCFConnection() {
  const note = document.getElementById('settings-cf-note');
  const input = document.getElementById('settings-cf-token');
  const token = input.value.trim();
  try {
    if (token) {
      await api('/api/settings', { method: 'PUT', body: JSON.stringify({ cf_api_token: token }) });
      input.value = '';
    }
    note.textContent = '验证中…';
    const data = await api('/api/cf/zones');
    if (data.success) {
      note.textContent = `连接成功，发现 ${data.result.length} 个域名。`;
      updateCFStatus(true);
    } else if (data.error) {
      note.textContent = `错误：${data.error}`;
      updateCFStatus(false);
    } else {
      note.textContent = 'API 返回异常。';
      updateCFStatus(false);
    }
  } catch (e) {
    note.textContent = `请求失败：${e.message}`;
    updateCFStatus(false);
  }
}

function exportData() {
  const payload = {
    exported_at: new Date().toISOString(),
    services: state.services,
    domains: state.domains,
    servers: state.servers,
    deployments: state.deployments,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `domain-manage-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast('success', '已导出数据');
}

async function logout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch {
    // ignore network errors, still leave the UI
  }
  window.location.href = '/login';
}

async function changePassword() {
  const currentInput = document.getElementById('settings-current-password');
  const nextInput = document.getElementById('settings-new-password');
  const note = document.getElementById('settings-password-note');
  const current = currentInput.value;
  const next = nextInput.value;
  note.style.color = '';

  if (!current || !next) {
    note.textContent = '请填写当前口令与新口令。';
    note.style.color = 'var(--danger)';
    return;
  }
  if (next.length < 6) {
    note.textContent = '新口令至少 6 位。';
    note.style.color = 'var(--danger)';
    return;
  }
  try {
    await api('/api/auth/password', { method: 'POST', body: JSON.stringify({ current, next }) });
    currentInput.value = '';
    nextInput.value = '';
    note.textContent = '口令已更新，本机会话已续期。';
  } catch (e) {
    note.textContent = e.message;
    note.style.color = 'var(--danger)';
  }
}

// ---------- Modal / dialog ----------
function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
  document.body.style.overflow = '';
}

function confirmDialog(title, message, onConfirm) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-message').textContent = message;
  confirmAction = onConfirm;
  openModal('modal-confirm');
}

// ---------- Toast ----------
function showToast(type, title, message = '') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-title">${esc(title)}</div>
    ${message ? `<div class="toast-msg">${esc(message)}</div>` : ''}
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 200ms ease-out';
    setTimeout(() => toast.remove(), 220);
  }, 4000);
}

// ---------- Global events ----------
function bindGlobalEvents() {
  document.addEventListener('keydown', event => {
    const palette = document.getElementById('palette');
    const paletteOpen = !palette.classList.contains('hidden');

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      paletteOpen ? closePalette() : openPalette();
      return;
    }

    if (!paletteOpen) {
      if (event.key === 'Escape') {
        const open = [...document.querySelectorAll('.modal-scrim:not(.hidden)')].pop();
        if (open) {
          event.preventDefault();
          closeModal(open.id);
        }
      }
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      closePalette();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      movePalette(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      movePalette(-1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      paletteChoose(state.paletteIndex);
    }
  });

  document.getElementById('palette-input').addEventListener('input', event => {
    renderPalette(event.target.value);
  });

  document.getElementById('confirm-ok').addEventListener('click', async () => {
    const action = confirmAction;
    confirmAction = null;
    closeModal('modal-confirm');
    if (action) await action();
  });

  document.querySelectorAll('.modal-scrim').forEach(scrim => {
    scrim.addEventListener('mousedown', event => {
      if (event.target === scrim) closeModal(scrim.id);
    });
  });

  document.getElementById('palette').addEventListener('mousedown', event => {
    if (event.target.id === 'palette') closePalette();
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth <= 767) {
      let changed = false;
      if (state.domainsView !== 'grid') { state.domainsView = 'grid'; changed = true; }
      if (state.servicesView !== 'grid') { state.servicesView = 'grid'; changed = true; }
      if (changed) {
        document.querySelectorAll('.segmented-item').forEach(b => b.classList.toggle('active', b.dataset.mode === 'grid'));
        renderDomains();
        renderServices();
      }
    }
  });

  setInterval(() => {
    if (state.view !== 'servers') return;
    if (document.visibilityState !== 'visible') return;
    if (!komariConfigured()) return;
    api('/api/komari/overview?refresh=1')
      .then(data => {
        state.komari = data;
        renderServers();
      })
      .catch(() => {});
  }, 60000);
}

document.addEventListener('DOMContentLoaded', init);
