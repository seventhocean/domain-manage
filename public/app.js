/* ============================================================
   app.js — Domain-Manage 面板交互逻辑（升级版）
   纯原生 JS · 内联 SVG 图标 · 手写 SVG 图表 · Toast 提示
   ============================================================ */

// --- State ---
const state = {
  services: [],
  domains: [],
  health: { ok: false, cf_connected: false, cf_token_set: false },
  currentView: 'overview',
  currentFilter: 'all',
  searchQuery: '',
  searchQueryDomains: '',
  sortServices: 'updated',
  sortDomains: 'expiry',
};

// ============================================================
// ICONS (Feather-style, 24x24 stroke)
// ============================================================
const ICONS = {
  edit: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  trash: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>',
  external: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6M10 14 21 3"/></svg>',
  calendar: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
  lock: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  alert: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></svg>',
  check: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/></svg>',
  image: '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>',
  refresh: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>',
  server: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="6" rx="1"/><rect x="3" y="14" width="18" height="6" rx="1"/><path d="M7 7h.01M7 17h.01"/></svg>',
  globe: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
};

const CATEGORY_LABELS = {
  other: '其他', blog: '博客', website: '网站', tool: '工具',
  product: '产品', monitoring: '监控', infra: '基础设施',
};
const STATUS_LABELS = { running: '运行中', maintenance: '维护中', stopped: '已停用' };
const STATUS_COLORS = { running: '#3f8500', maintenance: '#df6500', stopped: '#e52020' };
const STATUS_ORDER = { running: 0, maintenance: 1, stopped: 2 };

// ============================================================
// INIT
// ============================================================
async function init() {
  renderSkeletons('service-cards-full', 8);
  renderSkeletons('domain-cards-full', 8);
  await Promise.all([loadServices(), loadDomains(), loadHealth()]);
  renderAll();
}

async function loadServices() {
  try { state.services = await (await fetch('/api/services')).json(); }
  catch (e) { console.error('Failed to load services', e); state.services = []; }
}
async function loadDomains() {
  try { state.domains = await (await fetch('/api/domains')).json(); }
  catch (e) { console.error('Failed to load domains', e); state.domains = []; }
}
async function loadHealth() {
  try { state.health = await (await fetch('/api/health')).json(); }
  catch (e) { state.health = { ok: false, cf_connected: false }; }
}

// ============================================================
// NAVIGATION
// ============================================================
function navTo(view) {
  state.currentView = view;
  state.currentFilter = 'all';
  state.searchQuery = '';
  state.searchQueryDomains = '';

  document.querySelectorAll('.primary-nav .nav-links a, .drawer .drawer-links a').forEach(a => {
    a.classList.toggle('active', a.dataset.nav === view);
  });
  ['overview', 'services', 'domains', 'dns'].forEach(v => {
    const el = document.getElementById(`view-${v}`);
    if (el) el.classList.toggle('hidden', v !== view);
  });

  if (view === 'overview') renderAll();
  if (view === 'services') { renderServiceGrid('service-cards-full'); resetServiceFilters(); }
  if (view === 'domains') renderDomainGrid('domain-cards-full');
  if (view === 'dns') populateDnsZoneSelect();
  window.scrollTo({ top: 0 });
}

function resetServiceFilters() {
  const s = document.querySelector('#view-services .search-input');
  if (s) s.value = '';
  document.querySelectorAll('#view-services .pill-tab[data-filter]').forEach(b => {
    const on = b.dataset.filter === 'all';
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  const sort = document.getElementById('services-sort');
  if (sort) sort.value = 'updated';
  state.sortServices = 'updated';
}

// ============================================================
// RENDER ALL (overview)
// ============================================================
function renderAll() {
  renderHealthBar();
  renderHero();
  renderStatusChart();
  renderCategoryChart();
  renderExpiry();
  renderOverviewAlerts();
}

function renderHealthBar() {
  const dot = document.getElementById('cf-status-dot');
  const text = document.getElementById('cf-status-text');
  const fdot = document.getElementById('footer-cf-dot');
  const ftext = document.getElementById('footer-cf-text');
  const connected = state.health.cf_connected;
  [dot, fdot].forEach(d => { if (d) d.className = 'dot ' + (connected ? 'green' : 'red'); });
  if (text) text.textContent = connected ? 'CF 已连接' : 'CF 未连接';
  if (ftext) ftext.textContent = connected ? 'CF 已连接' : 'CF 未连接';
  const now = new Date();
  const t = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  const st = document.getElementById('sync-time'); if (st) st.textContent = `更新于 ${t}`;
  const fs = document.getElementById('footer-sync'); if (fs) fs.textContent = `最后更新 ${t}`;
}

function renderHero() {
  const running = state.services.filter(s => s.status === 'running').length;
  const total = state.services.length;
  const cf = state.domains.filter(d => d.dns_provider === 'cloudflare').length;
  const alerts = countAlerts();
  setText('hm-svc', total); setText('hm-dom', state.domains.length);
  setText('hm-cf', cf); setText('hm-alert', alerts);
  setText('stat-running', running); setText('stat-total-svc', total);
  setText('stat-domains', state.domains.length); setText('stat-cf-inline', cf);
  setText('stat-maintenance', state.services.filter(s => s.status === 'maintenance').length);
  setText('stat-expiring', countExpiring());
}

// ============================================================
// CHARTS
// ============================================================
function renderStatusChart() {
  const counts = { running: 0, maintenance: 0, stopped: 0 };
  state.services.forEach(s => { if (counts[s.status] != null) counts[s.status]++; });
  const total = state.services.length;
  const segments = [
    { label: '运行中', value: counts.running, color: STATUS_COLORS.running },
    { label: '维护中', value: counts.maintenance, color: STATUS_COLORS.maintenance },
    { label: '已停用', value: counts.stopped, color: STATUS_COLORS.stopped },
  ];
  const el = document.getElementById('chart-status');
  if (el) el.innerHTML = donutSVG(segments, total);
  const legend = document.getElementById('legend-status');
  if (legend) {
    legend.innerHTML = segments.map(s => `
      <div class="legend-row">
        <span class="swatch" style="background:${s.color}"></span>
        <span>${s.label}</span>
        <span class="lv">${s.value}</span>
      </div>`).join('');
  }
  setText('status-sub', total ? `${total} 个服务` : '暂无数据');
}

function donutSVG(segments, total) {
  const cx = 70, cy = 70, r = 54, sw = 16, size = 140;
  const C = 2 * Math.PI * r;
  let offset = 0;
  let circles = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--surface-soft)" stroke-width="${sw}"></circle>`;
  segments.forEach(s => {
    const len = total > 0 ? (s.value / total) * C : 0;
    if (len > 0) {
      circles += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${sw}"
        stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}"
        transform="rotate(-90 ${cx} ${cy})"></circle>`;
    }
    offset += len;
  });
  return `<svg width="140" height="140" viewBox="0 0 ${size} ${size}" role="img" aria-label="服务状态分布：${total} 个服务">
    ${circles}
    <text x="${cx}" y="${cy - 2}" text-anchor="middle" class="donut-center-num">${total}</text>
    <text x="${cx}" y="${cy + 14}" text-anchor="middle" class="donut-center-label">服务</text>
  </svg>`;
}

function renderCategoryChart() {
  const counts = {};
  state.services.forEach(s => { const c = s.category || 'other'; counts[c] = (counts[c] || 0) + 1; });
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const max = entries.length ? entries[0][1] : 1;
  const el = document.getElementById('chart-category');
  if (el) {
    if (!entries.length) {
      el.innerHTML = `<p class="body-sm text-mute">暂无服务数据。</p>`;
    } else {
      el.innerHTML = entries.map(([cat, n]) => `
        <div class="bar-row">
          <span class="bar-label">${CATEGORY_LABELS[cat] || cat}</span>
          <span class="bar-track"><span class="bar-fill" style="width:${(n / max * 100).toFixed(1)}%"></span></span>
          <span class="bar-val">${n}</span>
        </div>`).join('');
    }
  }
  setText('category-sub', `${state.services.length} 个服务`);
}

function renderExpiry() {
  const events = [];
  state.domains.forEach(d => {
    if (d.expiry_date) { const days = daysUntil(d.expiry_date); if (days >= 0 && days <= 90) events.push({ type: 'expiry', name: d.domain, days }); }
  });
  const list = document.getElementById('upcoming-list');
  if (!list) return;
  if (!events.length) {
    list.innerHTML = `<div class="up-empty">${ICONS.check}<span>未来 90 天内没有到期的域名。</span></div>`;
    return;
  }
  events.sort((a, b) => a.days - b.days);
  list.innerHTML = events.slice(0, 6).map(e => {
    const dangerCls = e.days < 7 ? 'danger' : e.days < 30 ? 'warning' : 'safe';
    const ico = ICONS.calendar;
    return `<div class="up-row">
      <span class="up-icon">${ico}</span>
      <span class="up-main">
        <span class="up-name">${esc(e.name)}</span>
        <span class="up-meta">域名注册到期</span>
      </span>
      <span class="expiry-badge ${dangerCls}">${e.days} 天</span>
    </div>`;
  }).join('');
}

// ============================================================
// ALERTS
// ============================================================
function countAlerts() {
  let n = 0;
  state.services.forEach(s => { if (s.status === 'stopped' || s.status === 'maintenance') n++; });
  const now = Date.now();
  const t30 = now + 30 * 864e5;
  state.domains.forEach(d => {
    if (d.expiry_date && new Date(d.expiry_date).getTime() <= t30) n++;
  });
  return n;
}
function countExpiring() {
  let n = 0;
  const now = Date.now();
  const t30 = now + 30 * 864e5;
  state.domains.forEach(d => {
    if (d.expiry_date && new Date(d.expiry_date).getTime() <= t30) n++;
  });
  return n;
}

function renderOverviewAlerts() {
  const container = document.getElementById('overview-alerts');
  if (!container) return;

  const alerts = [];
  state.services.filter(s => s.status === 'stopped').forEach(s => alerts.push({ type: 'danger', icon: ICONS.alert, text: `${s.name} — 已停用`, id: s.id, action: 'service' }));
  state.services.filter(s => s.status === 'maintenance').forEach(s => alerts.push({ type: 'warning', icon: ICONS.alert, text: `${s.name} — 维护中`, id: s.id, action: 'service' }));

  const now = Date.now();
  const t30 = now + 30 * 864e5;
  state.domains.forEach(d => {
    if (d.expiry_date && new Date(d.expiry_date).getTime() <= t30) {
      const days = daysUntil(d.expiry_date);
      alerts.push({ type: days < 7 ? 'danger' : 'warning', icon: ICONS.calendar, text: `${d.domain} — ${days} 天后到期`, id: d.id, action: 'domain' });
    }
  });

  setText('alerts-sub', alerts.length ? `${alerts.length} 条` : '全部正常');

  if (!alerts.length) {
    container.innerHTML = `<div class="alert-ok">
      <span class="t">${ICONS.check} 一切正常</span>
      <span class="d">所有服务运行中，域名均在有效期内。</span>
    </div>`;
    return;
  }
  const go = a => a.action === 'service' ? `openServiceDetail('${a.id}')` : `openDomainDetail('${a.id}')`;
  container.innerHTML = `<div class="alert-list">` + alerts.map(a => `
    <div class="alert-item ${a.type === 'danger' ? 'danger' : ''}" role="button" tabindex="0"
      onclick="${go(a)}" onkeydown="if(event.key==='Enter'){${go(a)}}">
      <span class="alert-ico">${a.icon}</span>
      <span class="alert-text">${esc(a.text)}</span>
      <span class="alert-go">查看 →</span>
    </div>`).join('') + `</div>`;
}

// ============================================================
// SERVICE GRID
// ============================================================
function getFilteredServices() {
  let list = state.services.slice();
  if (state.currentFilter !== 'all') list = list.filter(s => s.status === state.currentFilter);
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    list = list.filter(s =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.url || '').toLowerCase().includes(q) ||
      (s.description || '').toLowerCase().includes(q));
  }
  switch (state.sortServices) {
    case 'name': list.sort((a, b) => (a.name || '').localeCompare(b.name || '')); break;
    case 'status': list.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]); break;
    case 'category': list.sort((a, b) => (a.category || '').localeCompare(b.category || '')); break;
    default: list.sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));
  }
  return list;
}

function renderServiceGrid(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const empty = document.getElementById('service-empty');
  const list = getFilteredServices();

  if (!list.length) {
    container.innerHTML = '';
    if (empty) empty.classList.remove('hidden');
    return;
  }
  if (empty) empty.classList.add('hidden');

  container.innerHTML = list.map(s => {
    const domainCount = state.domains.filter(d => (d.service_ids || []).includes(s.id)).length;
    const hasShot = s.screenshots && s.screenshots.length > 0;
    const thumb = hasShot
      ? `<img src="/screenshots/${esc(s.screenshots[0])}" alt="${esc(s.name)} 截图" loading="lazy">`
      : `<div class="placeholder">暂无截图</div>`;
    const cornerColor = s.status === 'running' ? 'var(--primary)' : s.status === 'maintenance' ? 'var(--warning)' : 'var(--ash)';
    return `
      <div class="product-card" role="button" tabindex="0" onclick="openServiceDetail('${s.id}')"
        onkeydown="if(event.key==='Enter')openServiceDetail('${s.id}')">
        <span class="corner-square" style="background:${cornerColor}" aria-hidden="true"></span>
        <div class="card-actions">
          <button class="icon-btn" type="button" aria-label="打开 ${esc(s.name)}" onclick="event.stopPropagation();window.open('${esc(s.url)}','_blank')">${ICONS.external}</button>
          <button class="icon-btn" type="button" aria-label="编辑 ${esc(s.name)}" onclick="event.stopPropagation();openServiceForm('${s.id}')">${ICONS.edit}</button>
          <button class="icon-btn danger" type="button" aria-label="删除 ${esc(s.name)}" onclick="event.stopPropagation();deleteServiceConfirm('${s.id}')">${ICONS.trash}</button>
        </div>
        <div class="card-thumb">${thumb}</div>
        <div class="card-body">
          <div class="title">${esc(s.name)}</div>
          <div class="url">${esc(s.url)}</div>
          <div class="desc">${esc(s.description || '')}</div>
        </div>
        <div class="card-footer">
          <span class="status-badge ${s.status}">${STATUS_LABELS[s.status] || s.status}</span>
          ${domainCount > 0 ? `<span class="domain-count">🌐 ${domainCount} 个域名</span>` : `<span class="domain-count" style="color:var(--ash)">IP 直连</span>`}
        </div>
      </div>`;
  }).join('');
}

// ============================================================
// DOMAIN GRID
// ============================================================
function getFilteredDomains() {
  let list = state.domains.slice();
  if (state.searchQueryDomains) {
    const q = state.searchQueryDomains.toLowerCase();
    list = list.filter(d =>
      (d.domain || '').toLowerCase().includes(q));
  }
  switch (state.sortDomains) {
    case 'name': list.sort((a, b) => (a.domain || '').localeCompare(b.domain || '')); break;
    default: list.sort((a, b) => Math.min(daysUntil(a.expiry_date), 9999) - Math.min(daysUntil(b.expiry_date), 9999));
  }
  return list;
}

function renderDomainGrid(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const empty = document.getElementById('domain-empty');
  const list = getFilteredDomains();

  if (!list.length) {
    container.innerHTML = '';
    if (empty) empty.classList.remove('hidden');
    return;
  }
  if (empty) empty.classList.add('hidden');

  container.innerHTML = list.map(d => {
    const linked = (d.service_ids || []).map(id => state.services.find(s => s.id === id)).filter(Boolean);
    let expHTML = '';
    if (d.expiry_date) {
      const days = daysUntil(d.expiry_date);
      const cls = days < 7 ? 'danger' : days < 30 ? 'warning' : 'safe';
      expHTML = `<span class="expiry-badge ${cls}">📅 ${days} 天</span>`;
    }
    return `
      <div class="resource-card" role="button" tabindex="0" onclick="openDomainDetail('${d.id}')"
        onkeydown="if(event.key==='Enter')openDomainDetail('${d.id}')">
        <span class="corner-square" aria-hidden="true"></span>
        <div class="card-actions">
          <button class="icon-btn" type="button" aria-label="编辑 ${esc(d.domain)}" onclick="event.stopPropagation();openDomainForm('${d.id}')">${ICONS.edit}</button>
          <button class="icon-btn danger" type="button" aria-label="删除 ${esc(d.domain)}" onclick="event.stopPropagation();deleteDomainConfirm('${d.id}')">${ICONS.trash}</button>
        </div>
        <div>
          <div class="domain-name">${esc(d.domain)}</div>
          <div class="domain-meta" style="margin-top:var(--sp-xs)">
            <span class="badge-tag">${d.dns_provider === 'cloudflare' ? '☁️ CF' : '📋 手动'}</span>
            ${d.cf_zone_id ? `<span style="font-size:var(--fs-caption-xs);color:var(--mute)">Zone</span>` : ''}
          </div>
        </div>
        <div class="domain-meta">${expHTML}</div>
        ${linked.length ? `<div class="domain-meta" style="margin-top:auto">${linked.map(sv => `<span class="badge-tag" style="font-size:var(--fs-caption-xs)">${esc(sv.name)}</span>`).join('')}</div>` : ''}
      </div>`;
  }).join('');
}

// ============================================================
// DNS TABLE
// ============================================================
async function loadDnsRecords() {
  const select = document.getElementById('dns-zone-select');
  const zoneId = select.value;
  const container = document.getElementById('dns-table-container');
  if (!zoneId) { container.innerHTML = '<p class="body-sm text-mute">请选择一个 Cloudflare 域名。</p>'; return; }
  container.innerHTML = '<p class="body-sm text-mute">加载中…</p>';
  try {
    const data = await (await fetch(`/api/cf/zones/${zoneId}/dns`)).json();
    if (!data.success) { container.innerHTML = `<p class="body-sm" style="color:var(--error)">❌ ${esc(JSON.stringify(data.errors))}</p>`; return; }
    if (!data.result.length) { container.innerHTML = '<p class="body-sm text-mute">该域名暂无 DNS 记录。</p>'; return; }
    container.innerHTML = `
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>类型</th><th>名称</th><th>值</th><th>TTL</th><th>代理</th><th>ID</th></tr></thead>
          <tbody>${data.result.map(r => `
            <tr>
              <td><span class="badge-tag" style="font-size:var(--fs-caption-xs)">${esc(r.type)}</span></td>
              <td>${esc(r.name)}</td>
              <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(r.content)}">${esc(r.content)}</td>
              <td>${r.ttl === 1 ? 'Auto' : r.ttl}</td>
              <td><span class="proxy-badge ${r.proxied ? 'on' : 'off'}">${r.proxied ? '已代理' : '仅 DNS'}</span></td>
              <td style="font-size:var(--fs-caption-xs);color:var(--mute)">${esc(r.id)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <p class="body-sm text-mute" style="margin-top:var(--sp-md)">共 ${data.result.length} 条 DNS 记录</p>`;
    const domain = state.domains.find(d => d.cf_zone_id === zoneId);
    if (domain) domain.dns_records = data.result;
  } catch (e) {
    container.innerHTML = `<p class="body-sm" style="color:var(--error)">❌ 请求失败: ${esc(e.message)}</p>`;
  }
}

function populateDnsZoneSelect() {
  const select = document.getElementById('dns-zone-select');
  const cfDomains = state.domains.filter(d => d.dns_provider === 'cloudflare' && d.cf_zone_id);
  select.innerHTML = '<option value="">-- 选择 Cloudflare 域名 --</option>' +
    cfDomains.map(d => `<option value="${esc(d.cf_zone_id)}">${esc(d.domain)}</option>`).join('');
  const c = document.getElementById('dns-table-container');
  if (c) c.innerHTML = '<p class="body-sm text-mute" id="dns-empty">选择一个 Cloudflare 域名以加载 DNS 记录。</p>';
}

// ============================================================
// FILTER & SEARCH
// ============================================================
function filterServicesView(status, btn) {
  state.currentFilter = status;
  document.querySelectorAll('#view-services .pill-tab[data-filter]').forEach(b => {
    const on = b.dataset.filter === status;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  renderServiceGrid('service-cards-full');
}
function searchServicesView() {
  state.searchQuery = document.getElementById('services-search')?.value || '';
  renderServiceGrid('service-cards-full');
}
function sortServicesView(v) { state.sortServices = v; renderServiceGrid('service-cards-full'); }
function searchDomainsView() {
  state.searchQueryDomains = document.getElementById('domains-search')?.value || '';
  renderDomainGrid('domain-cards-full');
}
function sortDomainsView(v) { state.sortDomains = v; renderDomainGrid('domain-cards-full'); }

// ============================================================
// MODALS (with focus trap)
// ============================================================
let lastFocused = null;
function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  lastFocused = document.activeElement;
  el.classList.remove('hidden');
  el.setAttribute('aria-hidden', 'false');
  requestAnimationFrame(() => el.classList.add('open'));
  const f = getFocusable(el);
  if (f.length) setTimeout(() => f[0].focus(), 60);
  document.addEventListener('keydown', trapTab, true);
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('open');
  el.setAttribute('aria-hidden', 'true');
  document.removeEventListener('keydown', trapTab, true);
  setTimeout(() => { if (!el.classList.contains('open')) el.classList.add('hidden'); }, 300);
  if (lastFocused && lastFocused.focus) lastFocused.focus();
}
function getFocusable(el) {
  return Array.from(el.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
    .filter(n => !n.disabled && n.offsetParent !== null);
}
function trapTab(e) {
  if (e.key !== 'Tab') return;
  const open = document.querySelector('.modal-overlay.open');
  if (!open) return;
  const f = getFocusable(open);
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

// --- Service Detail ---
function openServiceDetail(id) {
  const s = state.services.find(sv => sv.id === id);
  if (!s) return;
  const linked = state.domains.filter(d => (d.service_ids || []).includes(s.id));
  const hasShot = s.screenshots && s.screenshots.length > 0;
  document.getElementById('modal-service-content').innerHTML = `
    ${hasShot ? `<div class="screenshot-large"><img src="/screenshots/${esc(s.screenshots[0])}" alt="${esc(s.name)} 截图"></div>`
      : `<label class="upload-zone" style="cursor:pointer">
          ${ICONS.image}
          <div class="body-sm" style="font-weight:700">点击上传截图</div>
          <div class="hint">PNG / WebP，单张不超过 10MB</div>
          <input type="file" accept="image/*" style="display:none" onchange="uploadScreenshot('${s.id}', this)">
        </label>`}
    <h3 class="modal-title" id="modal-service-title">${esc(s.name)}</h3>
    <div class="info-grid">
      <div class="info-item"><span class="info-label">URL</span><a href="${esc(s.url)}" target="_blank" rel="noopener" style="word-break:break-all">${esc(s.url)}</a></div>
      <div class="info-item"><span class="info-label">状态</span><span class="status-badge ${s.status}">${STATUS_LABELS[s.status] || s.status}</span></div>
      <div class="info-item"><span class="info-label">分类</span><span class="badge-tag">${CATEGORY_LABELS[s.category] || s.category}</span></div>
      <div class="info-item"><span class="info-label">创建时间</span><span style="font-size:var(--fs-caption-sm)">${fmtDate(s.created_at)}</span></div>
    </div>
    ${s.hosting && (s.hosting.provider || s.hosting.ip) ? `
      <div>
        <p class="caption-md" style="color:var(--mute);margin-bottom:var(--sp-sm)">托管信息</p>
        <div class="info-grid">
          ${s.hosting.provider ? `<div class="info-item"><span class="info-label">提供商</span><span>${esc(s.hosting.provider)}</span></div>` : ''}
          ${s.hosting.ip ? `<div class="info-item"><span class="info-label">IP</span><span class="mono">${esc(s.hosting.ip)}</span></div>` : ''}
          ${s.hosting.port ? `<div class="info-item"><span class="info-label">端口</span><span>${esc(s.hosting.port)}</span></div>` : ''}
          ${s.hosting.stack ? `<div class="info-item"><span class="info-label">技术栈</span><span>${esc(s.hosting.stack)}</span></div>` : ''}
        </div>
      </div>` : ''}
    ${s.description ? `<p class="body-md" style="color:var(--body)">${esc(s.description)}</p>` : ''}
    ${s.tags && s.tags.length ? `<div class="tag-list">${s.tags.map(t => `<span class="badge-tag">${esc(t)}</span>`).join('')}</div>` : ''}
    ${linked.length ? `<div><p class="caption-md" style="color:var(--mute);margin-bottom:var(--sp-sm)">关联域名</p><div class="tag-list">${linked.map(d => `<span class="badge-tag" style="cursor:pointer" role="button" tabindex="0" onclick="closeModal('modal-service');openDomainDetail('${d.id}')" onkeydown="if(event.key==='Enter'){closeModal('modal-service');openDomainDetail('${d.id}')}">🌐 ${esc(d.domain)}</span>`).join(' ')}</div></div>` : ''}
    ${s.notes ? `<div class="notes-content">${esc(s.notes)}</div>` : ''}
    ${hasShot ? `<div style="margin-top:var(--sp-sm)"><label class="btn btn-outline btn-sm" style="cursor:pointer">更换截图<input type="file" accept="image/*" style="display:none" onchange="uploadScreenshot('${s.id}', this)"></label></div>` : ''}
    <div class="modal-actions">
      <button class="btn btn-primary btn-sm" type="button" onclick="closeModal('modal-service');openServiceForm('${s.id}')">${ICONS.edit} 编辑</button>
      <button class="btn btn-danger btn-sm" type="button" onclick="deleteServiceConfirm('${s.id}')">${ICONS.trash} 删除</button>
      <a href="${esc(s.url)}" target="_blank" rel="noopener" class="btn btn-outline btn-sm">${ICONS.external} 打开</a>
    </div>`;
  openModal('modal-service');
}

// --- Domain Detail ---
function openDomainDetail(id) {
  const d = state.domains.find(dm => dm.id === id);
  if (!d) return;
  const linked = (d.service_ids || []).map(id => state.services.find(s => s.id === id)).filter(Boolean);
  document.getElementById('modal-domain-content').innerHTML = `
    <h3 class="modal-title" id="modal-domain-title">${esc(d.domain)}</h3>
    <div class="info-grid">
      <div class="info-item"><span class="info-label">DNS 提供商</span><span class="badge-tag">${d.dns_provider === 'cloudflare' ? '☁️ Cloudflare' : '📋 手动'}</span></div>
      <div class="info-item"><span class="info-label">到期日</span><span>${d.expiry_date ? fmtDate(d.expiry_date) + expiryTag(d.expiry_date) : '--'}</span></div>
      ${d.cf_zone_id ? `<div class="info-item"><span class="info-label">CF Zone ID</span><span class="mono" style="font-size:var(--fs-caption-sm)">${esc(d.cf_zone_id)}</span></div>` : ''}
      <div class="info-item"><span class="info-label">状态</span><span>${esc(d.status || 'active')}</span></div>
    </div>
    ${linked.length ? `<div><p class="caption-md" style="color:var(--mute);margin-bottom:var(--sp-sm)">关联服务</p><div class="tag-list">${linked.map(sv => `<span class="badge-tag" style="cursor:pointer" role="button" tabindex="0" onclick="closeModal('modal-domain');openServiceDetail('${sv.id}')" onkeydown="if(event.key==='Enter'){closeModal('modal-domain');openServiceDetail('${sv.id}')}">${esc(sv.name)}</span>`).join(' ')}</div></div>`
      : `<p class="body-sm text-mute">未关联任何服务</p>`}
    ${d.dns_records && d.dns_records.length ? `
      <div><p class="caption-md" style="color:var(--mute);margin-bottom:var(--sp-sm)">DNS 记录（缓存）</p>
        <div class="table-wrap"><table class="data-table" style="font-size:var(--fs-caption-sm);min-width:0">
          <thead><tr><th>类型</th><th>名称</th><th>值</th><th>代理</th></tr></thead>
          <tbody>${d.dns_records.map(r => `<tr><td>${esc(r.type)}</td><td>${esc(r.name)}</td><td style="max-width:180px;overflow:hidden;text-overflow:ellipsis">${esc(r.content)}</td><td>${r.proxied ? '🟠' : '⬜'}</td></tr>`).join('')}</tbody>
        </table></div>
      </div>` : ''}
    ${d.notes ? `<div class="notes-content">${esc(d.notes)}</div>` : ''}
    <div class="modal-actions">
      <button class="btn btn-primary btn-sm" type="button" onclick="closeModal('modal-domain');openDomainForm('${d.id}')">${ICONS.edit} 编辑</button>
      <button class="btn btn-danger btn-sm" type="button" onclick="deleteDomainConfirm('${d.id}')">${ICONS.trash} 删除</button>
    </div>`;
  openModal('modal-domain');
}

function expiryTag(dateStr) {
  const days = daysUntil(dateStr);
  if (days < 0) return ` <span class="expiry-badge danger">已过期</span>`;
  if (days < 30) return ` <span class="expiry-badge ${days < 7 ? 'danger' : 'warning'}">${days} 天</span>`;
  return '';
}

// --- Service Form ---
function openServiceForm(id) {
  const form = document.getElementById('service-form');
  form.reset();
  document.getElementById('svc-form-id').value = '';
  if (id) {
    const s = state.services.find(sv => sv.id === id);
    if (!s) return;
    document.getElementById('service-form-title').textContent = '编辑服务';
    document.getElementById('svc-form-id').value = s.id;
    document.getElementById('svc-name').value = s.name || '';
    document.getElementById('svc-url').value = s.url || '';
    document.getElementById('svc-desc').value = s.description || '';
    document.getElementById('svc-category').value = s.category || 'other';
    document.getElementById('svc-status').value = s.status || 'running';
    document.getElementById('svc-hosting-provider').value = s.hosting?.provider || '';
    document.getElementById('svc-hosting-ip').value = s.hosting?.ip || '';
    document.getElementById('svc-hosting-port').value = s.hosting?.port || '';
    document.getElementById('svc-hosting-stack').value = s.hosting?.stack || '';
    document.getElementById('svc-tags').value = (s.tags || []).join(', ');
    document.getElementById('svc-notes').value = s.notes || '';
  } else {
    document.getElementById('service-form-title').textContent = '添加服务';
  }
  openModal('modal-service-form');
}

async function saveServiceForm(e) {
  e.preventDefault();
  const id = document.getElementById('svc-form-id').value;
  const payload = {
    name: document.getElementById('svc-name').value.trim(),
    url: document.getElementById('svc-url').value.trim(),
    description: document.getElementById('svc-desc').value.trim(),
    category: document.getElementById('svc-category').value,
    status: document.getElementById('svc-status').value,
    hosting: {
      provider: document.getElementById('svc-hosting-provider').value.trim(),
      ip: document.getElementById('svc-hosting-ip').value.trim(),
      port: parseInt(document.getElementById('svc-hosting-port').value) || null,
      stack: document.getElementById('svc-hosting-stack').value.trim(),
    },
    tags: document.getElementById('svc-tags').value.split(',').map(t => t.trim()).filter(Boolean),
    notes: document.getElementById('svc-notes').value.trim(),
  };
  const url = id ? `/api/services/${id}` : '/api/services';
  const method = id ? 'PUT' : 'POST';
  try {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) throw new Error('保存失败');
    closeModal('modal-service-form');
    await loadServices();
    renderAll();
    showToast('success', id ? '已更新' : '已添加', `${payload.name} 已保存。`);
  } catch (err) {
    showToast('error', '保存失败', err.message);
  }
}

async function deleteServiceConfirm(id) {
  const s = state.services.find(sv => sv.id === id);
  if (!confirm(`确定删除服务「${s ? s.name : ''}」？此操作不可撤销。`)) return;
  try {
    await fetch(`/api/services/${id}`, { method: 'DELETE' });
    closeModal('modal-service');
    await loadServices();
    renderAll();
    showToast('success', '已删除', '服务已移除。');
  } catch (err) {
    showToast('error', '删除失败', err.message);
  }
}

// --- Domain Form ---
function openDomainForm(id) {
  const form = document.getElementById('domain-form');
  form.reset();
  document.getElementById('dom-form-id').value = '';
  if (id) {
    const d = state.domains.find(dm => dm.id === id);
    if (!d) return;
    document.getElementById('domain-form-title').textContent = '编辑域名';
    document.getElementById('dom-form-id').value = d.id;
    document.getElementById('dom-domain').value = d.domain || '';
    document.getElementById('dom-dns-provider').value = d.dns_provider || 'manual';
    document.getElementById('dom-cf-zone-id').value = d.cf_zone_id || '';
    document.getElementById('dom-expiry').value = d.expiry_date || '';
    document.getElementById('dom-service-ids').value = (d.service_ids || []).join(', ');
    document.getElementById('dom-notes').value = d.notes || '';
  } else {
    document.getElementById('domain-form-title').textContent = '添加域名';
  }
  openModal('modal-domain-form');
}

async function saveDomainForm(e) {
  e.preventDefault();
  const id = document.getElementById('dom-form-id').value;
  const payload = {
    domain: document.getElementById('dom-domain').value.trim(),
    dns_provider: document.getElementById('dom-dns-provider').value,
    cf_zone_id: document.getElementById('dom-cf-zone-id').value.trim() || null,
    expiry_date: document.getElementById('dom-expiry').value || null,
    service_ids: document.getElementById('dom-service-ids').value.split(',').map(s => s.trim()).filter(Boolean),
    notes: document.getElementById('dom-notes').value.trim(),
  };
  const url = id ? `/api/domains/${id}` : '/api/domains';
  const method = id ? 'PUT' : 'POST';
  try {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) throw new Error('保存失败');
    closeModal('modal-domain-form');
    await loadDomains();
    renderAll();
    showToast('success', id ? '已更新' : '已添加', `${payload.domain} 已保存。`);
  } catch (err) {
    showToast('error', '保存失败', err.message);
  }
}

async function deleteDomainConfirm(id) {
  const d = state.domains.find(dm => dm.id === id);
  if (!confirm(`确定删除域名「${d ? d.domain : ''}」？此操作不可撤销。`)) return;
  try {
    await fetch(`/api/domains/${id}`, { method: 'DELETE' });
    closeModal('modal-domain');
    await loadDomains();
    renderAll();
    showToast('success', '已删除', '域名已移除。');
  } catch (err) {
    showToast('error', '删除失败', err.message);
  }
}

// --- Screenshot Upload ---
async function uploadScreenshot(serviceId, input) {
  const file = input.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('screenshot', file);
  try {
    const res = await fetch(`/api/services/${serviceId}/screenshots`, { method: 'POST', body: formData });
    if (!res.ok) throw new Error('上传失败');
    await loadServices();
    closeModal('modal-service');
    setTimeout(() => openServiceDetail(serviceId), 220);
    showToast('success', '上传成功', '截图已更新。');
  } catch (err) {
    showToast('error', '上传失败', err.message);
  }
}

// --- Settings ---
function openSettings() { openModal('modal-settings'); }

async function testCFConnection() {
  const note = document.getElementById('settings-cf-note');
  note.innerHTML = '验证中…';
  try {
    const data = await (await fetch('/api/cf/zones')).json();
    if (data.success) {
      note.innerHTML = `✅ 连接成功！发现 <strong>${data.result.length}</strong> 个域名。<button class="btn btn-primary btn-sm" style="margin-left:8px" type="button" onclick="syncFromCloudflare()">一键导入</button>`;
    } else if (data.error) {
      note.innerHTML = `❌ 错误: ${esc(data.error)}。请确保已设置 CF_API_TOKEN 环境变量。`;
    } else {
      note.innerHTML = `⚠️ API 返回异常: ${esc(JSON.stringify(data))}`;
    }
  } catch (err) {
    note.innerHTML = `❌ 请求失败: ${esc(err.message)}`;
  }
}

async function syncFromCloudflare() {
  const btn = document.querySelector('.primary-nav .btn-outline-on-dark');
  const orig = btn ? btn.textContent : '同步 CF';
  if (btn) { btn.disabled = true; btn.textContent = '同步中…'; }
  try {
    const zonesData = await (await fetch('/api/cf/zones?per_page=50')).json();
    if (!zonesData.success) { showToast('error', '同步失败', JSON.stringify(zonesData.errors)); if (btn) { btn.textContent = orig; btn.disabled = false; } return; }
    let added = 0;
    for (const zone of zonesData.result) {
      const existing = state.domains.find(d => d.cf_zone_id === zone.id);
      if (!existing) {
        await fetch('/api/domains', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ domain: zone.name, dns_provider: 'cloudflare', cf_zone_id: zone.id, status: zone.status, service_ids: [] }) });
        added++;
      } else {
        await fetch(`/api/domains/${existing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: zone.status, cf_zone_id: zone.id }) });
      }
    }
    await loadDomains();
    await loadHealth();
    renderAll();
    showToast('success', '同步完成', `导入 ${added} 个新域名，共 ${zonesData.result.length} 个 Cloudflare 域名。`);
  } catch (err) {
    showToast('error', '同步失败', err.message);
  }
  if (btn) { btn.textContent = orig; btn.disabled = false; }
}

// ============================================================
// MOBILE DRAWER
// ============================================================
function toggleDrawer() {
  const drawer = document.getElementById('drawer');
  const overlay = document.getElementById('drawer-overlay');
  const toggle = document.getElementById('nav-toggle');
  const open = drawer.classList.toggle('open');
  overlay.classList.toggle('open', open);
  drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
  if (toggle) toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
}
function closeDrawer() {
  const drawer = document.getElementById('drawer');
  const overlay = document.getElementById('drawer-overlay');
  const toggle = document.getElementById('nav-toggle');
  drawer.classList.remove('open');
  overlay.classList.remove('open');
  drawer.setAttribute('aria-hidden', 'true');
  if (toggle) toggle.setAttribute('aria-expanded', 'false');
}

// ============================================================
// TOASTS
// ============================================================
function showToast(type, title, msg) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const icons = { success: ICONS.check, error: ICONS.alert, info: ICONS.info };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  el.innerHTML = `
    <span class="toast-ico">${icons[type] || ICONS.info}</span>
    <span class="toast-body"><span class="toast-title">${esc(title)}</span><span class="toast-msg">${esc(msg)}</span></span>
    <button class="toast-close" type="button" aria-label="关闭通知" onclick="this.parentNode.remove()">✕</button>`;
  container.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  const ttl = type === 'error' ? 6000 : 3800;
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 320); }, ttl);
}

// ============================================================
// SKELETONS
// ============================================================
function renderSkeletons(containerId, n) {
  const c = document.getElementById(containerId);
  if (!c) return;
  c.innerHTML = Array.from({ length: n }).map(() => `
    <div class="sk-card">
      <div class="skeleton sk-thumb"></div>
      <div class="skeleton sk-line w-80"></div>
      <div class="skeleton sk-line w-60"></div>
      <div class="skeleton sk-line w-40"></div>
    </div>`).join('');
}

// ============================================================
// HELPERS
// ============================================================
function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function esc(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
function fmtDate(dateStr) {
  if (!dateStr) return '--';
  try { return new Date(dateStr).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }); }
  catch { return dateStr; }
}
function daysUntil(dateStr) {
  if (!dateStr) return Infinity;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 864e5);
}

// ============================================================
// GLOBAL EVENTS
// ============================================================
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    const openModalEl = document.querySelector('.modal-overlay.open');
    if (openModalEl) { openModalEl.querySelectorAll('.modal-close').forEach(b => b.click()); return; }
    if (document.getElementById('drawer')?.classList.contains('open')) closeDrawer();
  }
  if (e.metaKey || e.ctrlKey) {
    if (e.key === '1') { e.preventDefault(); navTo('overview'); }
    if (e.key === '2') { e.preventDefault(); navTo('services'); }
    if (e.key === '3') { e.preventDefault(); navTo('domains'); }
    if (e.key === '4') { e.preventDefault(); navTo('dns'); }
  }
});

document.addEventListener('click', e => {
  if (e.target.classList && e.target.classList.contains('modal-overlay')) {
    e.target.querySelectorAll('.modal-close').forEach(b => b.click());
  }
});

document.addEventListener('DOMContentLoaded', init);
