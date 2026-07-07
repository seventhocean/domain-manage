/* ============================================================
   app.js — Domain-Manage 面板交互逻辑
   ============================================================ */

// --- State ---
let state = {
  services: [],
  domains: [],
  health: { ok: false, cf_connected: false, cf_token_set: false },
  currentView: 'overview',
  currentFilter: 'all',
  searchQuery: '',
};

// ============================================================
// INIT
// ============================================================

async function init() {
  await Promise.all([loadServices(), loadDomains(), loadHealth()]);
  renderAll();
}

async function loadServices() {
  try {
    const res = await fetch('/api/services');
    state.services = await res.json();
  } catch (e) {
    console.error('Failed to load services', e);
    state.services = [];
  }
}

async function loadDomains() {
  try {
    const res = await fetch('/api/domains');
    state.domains = await res.json();
  } catch (e) {
    console.error('Failed to load domains', e);
    state.domains = [];
  }
}

async function loadHealth() {
  try {
    const res = await fetch('/api/health');
    state.health = await res.json();
  } catch (e) {
    state.health = { ok: false, cf_connected: false };
  }
}

// ============================================================
// NAVIGATION
// ============================================================

function navTo(view) {
  state.currentView = view;
  state.currentFilter = 'all';
  state.searchQuery = '';

  // Update nav active
  document.querySelectorAll('.primary-nav .nav-links a').forEach(a => {
    a.classList.toggle('active', a.dataset.nav === view);
  });
  // Show/hide views
  ['overview', 'services', 'domains', 'dns'].forEach(v => {
    const el = document.getElementById(`view-${v}`);
    if (el) el.classList.toggle('hidden', v !== view);
  });

  if (view === 'overview') renderAll();
  if (view === 'services') {
    renderServiceGrid('service-cards-full');
    resetServiceFilters();
  }
  if (view === 'domains') renderDomainGrid('domain-cards-full');
  if (view === 'dns') populateDnsZoneSelect();
}

function resetServiceFilters() {
  // Reset search input in services view
  const searchInput = document.querySelector('#view-services .search-input');
  if (searchInput) searchInput.value = '';
  // Reset pill tabs in services view
  document.querySelectorAll('#view-services .pill-tab[data-filter]').forEach(b => {
    b.classList.toggle('active', b.dataset.filter === 'all');
  });
}

// ============================================================
// RENDER ALL
// ============================================================

function renderAll() {
  renderHealthBar();
  renderHero();
  renderOverviewAlerts();
  renderStatusBreakdown();
}

// --- Health bar ---
function renderHealthBar() {
  const dot = document.getElementById('cf-status-dot');
  const text = document.getElementById('cf-status-text');
  if (state.health.cf_connected) {
    dot.className = 'dot green';
    text.textContent = 'CF 已连接';
  } else {
    dot.className = 'dot red';
    text.textContent = 'CF 未连接';
  }
  const now = new Date();
  document.getElementById('sync-time').textContent =
    `上次刷新 ${now.toLocaleTimeString('zh-CN')}`;
}

// --- Hero stats ---
function renderHero() {
  const running = state.services.filter(s => s.status === 'running').length;
  const total = state.services.length;
  const elRunning = document.getElementById('stat-running');
  const elTotal = document.getElementById('stat-total-svc');
  if (elRunning) elRunning.textContent = running;
  if (elTotal) elTotal.textContent = total;

  const elDomains = document.getElementById('stat-domains');
  if (elDomains) elDomains.textContent = state.domains.length;

  const cfCount = state.domains.filter(d => d.dns_provider === 'cloudflare').length;
  const elCf = document.getElementById('stat-cf-inline');
  if (elCf) elCf.textContent = cfCount;

  const now = new Date();
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  let expiring = 0;
  state.domains.forEach(d => {
    if (d.expiry_date && new Date(d.expiry_date) <= thirtyDays) expiring++;
    if (d.ssl_expiry && new Date(d.ssl_expiry) <= sevenDays) expiring++;
  });
  const elExp = document.getElementById('stat-expiring');
  if (elExp) elExp.textContent = expiring;
}

// --- Overview alerts ---
function renderOverviewAlerts() {
  const container = document.getElementById('overview-alerts');
  if (!container) return;

  const stoppedServices = state.services.filter(s => s.status === 'stopped');
  const maintenanceServices = state.services.filter(s => s.status === 'maintenance');
  const now = new Date();
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const expiringDomains = state.domains.filter(d => d.expiry_date && new Date(d.expiry_date) <= thirtyDays);
  const expiringSSL = state.domains.filter(d => d.ssl_expiry && new Date(d.ssl_expiry) <= sevenDays);

  const alerts = [];

  stoppedServices.forEach(s => {
    alerts.push({ type: 'danger', icon: '🔴', text: `${s.name} — 已停用`, id: s.id, action: 'service' });
  });
  maintenanceServices.forEach(s => {
    alerts.push({ type: 'warning', icon: '🟡', text: `${s.name} — 维护中`, id: s.id, action: 'service' });
  });
  expiringDomains.forEach(d => {
    const days = daysUntil(d.expiry_date);
    alerts.push({ type: days < 7 ? 'danger' : 'warning', icon: '📅', text: `${d.domain} — ${days} 天后到期`, id: d.id, action: 'domain' });
  });
  expiringSSL.forEach(d => {
    const days = daysUntil(d.ssl_expiry);
    alerts.push({ type: days < 3 ? 'danger' : 'warning', icon: '🔒', text: `${d.domain} SSL ${days} 天后过期`, id: d.id, action: 'domain' });
  });

  if (alerts.length === 0) {
    container.innerHTML = `<div style="padding:var(--sp-xl);background:var(--surface-soft);border-radius:var(--rounded-sm);border-left:3px solid var(--success-deep)">
      <p class="body-strong" style="color:var(--success-deep)">✅ 一切正常</p>
      <p class="body-sm" style="color:var(--mute);margin-top:var(--sp-xs)">所有服务运行中，域名与 SSL 证书均在有效期内。</p>
    </div>`;
    return;
  }

  container.innerHTML = alerts.map(a => `
    <div style="padding:var(--sp-md) var(--sp-lg);margin-bottom:var(--sp-sm);background:var(--surface-soft);border-radius:var(--rounded-sm);border-left:3px solid ${a.type === 'danger' ? 'var(--error)' : 'var(--warning)'};cursor:pointer;display:flex;align-items:center;gap:var(--sp-sm)"
      onclick="${a.action === 'service' ? `openServiceDetail('${a.id}')` : `openDomainDetail('${a.id}')`}">
      <span style="font-size:16px">${a.icon}</span>
      <span class="body-sm" style="flex:1">${a.text}</span>
      <span style="color:var(--mute);font-size:var(--fs-caption-xs)">查看 →</span>
    </div>
  `).join('');
}

// --- Status breakdown ---
function renderStatusBreakdown() {
  const container = document.getElementById('overview-status-breakdown');
  if (!container) return;

  const running = state.services.filter(s => s.status === 'running').length;
  const maintenance = state.services.filter(s => s.status === 'maintenance').length;
  const stopped = state.services.filter(s => s.status === 'stopped').length;
  const cfDomains = state.domains.filter(d => d.dns_provider === 'cloudflare').length;
  const manualDomains = state.domains.length - cfDomains;

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:var(--sp-sm);margin-bottom:var(--sp-md)">
      <div style="text-align:center;padding:var(--sp-md);border:1px solid var(--hairline);border-radius:var(--rounded-sm)">
        <div style="font-size:28px;font-weight:700;font-family:var(--font);color:var(--success-deep)">${running}</div>
        <div style="font-size:var(--fs-caption-xs);color:var(--mute);margin-top:var(--sp-xxs)">🟢 运行中</div>
      </div>
      <div style="text-align:center;padding:var(--sp-md);border:1px solid var(--hairline);border-radius:var(--rounded-sm)">
        <div style="font-size:28px;font-weight:700;font-family:var(--font);color:var(--warning)">${maintenance}</div>
        <div style="font-size:var(--fs-caption-xs);color:var(--mute);margin-top:var(--sp-xxs)">🟡 维护</div>
      </div>
      <div style="text-align:center;padding:var(--sp-md);border:1px solid var(--hairline);border-radius:var(--rounded-sm)">
        <div style="font-size:28px;font-weight:700;font-family:var(--font);color:var(--error)">${stopped}</div>
        <div style="font-size:var(--fs-caption-xs);color:var(--mute);margin-top:var(--sp-xxs)">🔴 停用</div>
      </div>
    </div>
    <div style="display:flex;gap:var(--sp-md);font-size:var(--fs-caption-sm);color:var(--mute)">
      <span style="display:flex;align-items:center;gap:var(--sp-xxs)">☁️ CF ${cfDomains}</span>
      <span style="display:flex;align-items:center;gap:var(--sp-xxs)">📋 手动 ${manualDomains}</span>
    </div>
  `;
}
function renderServiceGrid(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const emptyState = document.getElementById('service-empty');

  let services = state.services;
  if (state.currentFilter !== 'all') {
    services = services.filter(s => s.status === state.currentFilter);
  }
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    services = services.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.url.toLowerCase().includes(q) ||
      (s.description || '').toLowerCase().includes(q)
    );
  }

  if (services.length === 0) {
    container.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }
  if (emptyState) emptyState.classList.add('hidden');

  container.innerHTML = services.map(s => {
    const domainCount = state.domains.filter(d =>
      (d.service_ids || []).includes(s.id)
    ).length;
    const hasScreenshot = s.screenshots && s.screenshots.length > 0;
    const thumb = hasScreenshot
      ? `<img src="/screenshots/${s.screenshots[0]}" alt="${esc(s.name)}" loading="lazy">`
      : '';
    return `
      <div class="product-card" onclick="openServiceDetail('${s.id}')">
        <span class="corner-square" style="background:${s.status === 'running' ? 'var(--primary)' : s.status === 'maintenance' ? 'var(--warning)' : 'var(--ash)'}"></span>
        <div class="card-thumb">
          ${thumb || `<div class="placeholder">暂无截图</div>`}
        </div>
        <div class="card-body">
          <div class="title">${esc(s.name)}</div>
          <div class="url">${esc(s.url)}</div>
          <div class="desc">${esc(s.description || '')}</div>
        </div>
        <div class="card-footer">
          <span class="status-badge ${s.status}">
            ${s.status === 'running' ? '运行中' : s.status === 'maintenance' ? '维护中' : '已停用'}
          </span>
          ${domainCount > 0 ? `<span class="domain-count">🌐 ${domainCount} 个域名</span>` : `<span class="domain-count" style="color:var(--ash)">IP 直连</span>`}
        </div>
      </div>`;
  }).join('');
}

// --- Domain cards ---
function renderDomainGrid(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = state.domains.map(d => {
    const linkedServices = (d.service_ids || [])
      .map(sid => state.services.find(s => s.id === sid))
      .filter(Boolean);

    let expiryHTML = '';
    if (d.expiry_date) {
      const days = daysUntil(d.expiry_date);
      const cls = days < 7 ? 'danger' : days < 30 ? 'warning' : 'safe';
      expiryHTML = `<span class="expiry-badge ${cls}">📅 ${days} 天</span>`;
    }

    let sslHTML = '';
    if (d.ssl_expiry) {
      const days = daysUntil(d.ssl_expiry);
      const cls = days < 7 ? 'danger' : days < 30 ? 'warning' : 'safe';
      sslHTML = `<span class="expiry-badge ${cls}">🔒 ${days} 天</span>`;
    }

    return `
      <div class="resource-card" onclick="openDomainDetail('${d.id}')">
        <div>
          <div class="domain-name">${esc(d.domain)}</div>
          <div class="domain-meta" style="margin-top:var(--sp-xs)">
            <span class="badge-tag">${d.dns_provider === 'cloudflare' ? '☁️ CF' : '📋 手动'}</span>
            ${d.registrar ? `<span class="badge-tag">${esc(d.registrar)}</span>` : ''}
            ${d.cf_zone_id ? `<span style="font-size:var(--fs-caption-xs);color:var(--mute)">Zone</span>` : ''}
          </div>
        </div>
        <div class="domain-meta">
          ${expiryHTML}
          ${sslHTML}
        </div>
        ${linkedServices.length > 0 ? `
          <div class="domain-meta" style="margin-top:auto">
            ${linkedServices.map(sv => `<span class="badge-tag" style="font-size:var(--fs-caption-xs)">${esc(sv.name)}</span>`).join('')}
          </div>
        ` : ''}
      </div>`;
  }).join('');
}

// --- DNS Table ---
async function loadDnsRecords() {
  const select = document.getElementById('dns-zone-select');
  const zoneId = select.value;
  const container = document.getElementById('dns-table-container');

  if (!zoneId) {
    container.innerHTML = '<p class="body-sm text-mute">请选择一个 Cloudflare 域名。</p>';
    return;
  }

  container.innerHTML = '<p class="body-sm" style="color:var(--mute)">加载中…</p>';

  try {
    const resp = await fetch(`/api/cf/zones/${zoneId}/dns`);
    const data = await resp.json();

    if (!data.success) {
      container.innerHTML = `<p class="body-sm" style="color:var(--error)">❌ ${esc(JSON.stringify(data.errors))}</p>`;
      document.getElementById('dns-empty')?.classList.add('hidden');
      return;
    }

    if (data.result.length === 0) {
      container.innerHTML = '<p class="body-sm text-mute">该域名暂无 DNS 记录。</p>';
      return;
    }

    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>类型</th>
            <th>名称</th>
            <th>值</th>
            <th>TTL</th>
            <th>代理</th>
            <th>Cloudflare ID</th>
          </tr>
        </thead>
        <tbody>
          ${data.result.map(r => `
            <tr>
              <td><span class="badge-tag" style="font-size:var(--fs-caption-xs)">${esc(r.type)}</span></td>
              <td>${esc(r.name)}</td>
              <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(r.content)}">${esc(r.content)}</td>
              <td>${r.ttl === 1 ? 'Auto' : r.ttl}</td>
              <td><span class="proxy-badge ${r.proxied ? 'on' : 'off'}">${r.proxied ? '🟠 已代理' : '⬜ 仅 DNS'}</span></td>
              <td style="font-size:var(--fs-caption-xs);color:var(--mute)">${esc(r.id)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <p class="body-sm" style="color:var(--mute);margin-top:var(--sp-md)">共 ${data.result.length} 条 DNS 记录</p>
    `;

    // Update domain dns_records cache in local data
    const domain = state.domains.find(d => d.cf_zone_id === zoneId);
    if (domain) {
      domain.dns_records = data.result;
    }
  } catch (e) {
    container.innerHTML = `<p class="body-sm" style="color:var(--error)">❌ 请求失败: ${esc(e.message)}</p>`;
  }
}

function populateDnsZoneSelect() {
  const select = document.getElementById('dns-zone-select');
  const cfDomains = state.domains.filter(d => d.dns_provider === 'cloudflare' && d.cf_zone_id);
  select.innerHTML = '<option value="">-- 选择 Cloudflare 域名 --</option>' +
    cfDomains.map(d => `<option value="${esc(d.cf_zone_id)}">${esc(d.domain)}</option>`).join('');
  document.getElementById('dns-table-container').innerHTML =
    '<p class="body-sm text-mute" id="dns-empty">选择一个 Cloudflare 域名以加载 DNS 记录。</p>';
}

// ============================================================
// FILTER & SEARCH (Services view only)
// ============================================================

function filterServicesView(status, btn) {
  state.currentFilter = status;
  // Update active pill in services view
  document.querySelectorAll('#view-services .pill-tab[data-filter]').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderServiceGrid('service-cards-full');
}

function searchServicesView() {
  state.searchQuery = document.getElementById('services-search')?.value || '';
  renderServiceGrid('service-cards-full');
}

// ============================================================
// MODALS
// ============================================================

function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

// --- Service Detail ---
function openServiceDetail(id) {
  const s = state.services.find(sv => sv.id === id);
  if (!s) return;

  const linkedDomains = state.domains.filter(d => (d.service_ids || []).includes(s.id));
  const hasScreenshot = s.screenshots && s.screenshots.length > 0;

  document.getElementById('modal-service-content').innerHTML = `
    ${hasScreenshot ? `
      <div class="screenshot-large">
        <img src="/screenshots/${s.screenshots[0]}" alt="${esc(s.name)}">
      </div>
    ` : `
      <div class="upload-zone" onclick="document.getElementById('screenshot-upload-${s.id}').click()">
        <p>📷 点击上传截图</p>
        <input type="file" id="screenshot-upload-${s.id}" accept="image/*" style="display:none"
          onchange="uploadScreenshot('${s.id}', this)">
      </div>
    `}
    <h3 class="modal-title" style="margin-bottom:0">${esc(s.name)}</h3>
    <div class="info-grid">
      <div class="info-item"><span class="info-label">URL</span><span>${esc(s.url)}</span></div>
      <div class="info-item"><span class="info-label">状态</span><span class="status-badge ${s.status}">${statusLabel(s.status)}</span></div>
      <div class="info-item"><span class="info-label">分类</span><span class="badge-tag">${esc(s.category)}</span></div>
      <div class="info-item"><span class="info-label">创建时间</span><span style="font-size:var(--fs-caption-sm)">${fmtDate(s.created_at)}</span></div>
    </div>
    ${s.hosting && (s.hosting.provider || s.hosting.ip) ? `
      <div>
        <p class="caption-md" style="color:var(--mute);margin-bottom:var(--sp-sm)">托管信息</p>
        <div class="info-grid">
          ${s.hosting.provider ? `<div class="info-item"><span class="info-label">提供商</span><span>${esc(s.hosting.provider)}</span></div>` : ''}
          ${s.hosting.ip ? `<div class="info-item"><span class="info-label">IP</span><span style="font-family:monospace">${esc(s.hosting.ip)}</span></div>` : ''}
          ${s.hosting.port ? `<div class="info-item"><span class="info-label">端口</span><span>${s.hosting.port}</span></div>` : ''}
          ${s.hosting.stack ? `<div class="info-item"><span class="info-label">技术栈</span><span>${esc(s.hosting.stack)}</span></div>` : ''}
        </div>
      </div>
    ` : ''}
    ${s.description ? `<p class="body-md" style="color:var(--body)">${esc(s.description)}</p>` : ''}
    ${s.tags && s.tags.length > 0 ? `
      <div class="tag-list">
        ${s.tags.map(t => `<span class="badge-tag">${esc(t)}</span>`).join('')}
      </div>
    ` : ''}
    ${linkedDomains.length > 0 ? `
      <div>
        <p class="caption-md" style="color:var(--mute);margin-bottom:var(--sp-sm)">关联域名</p>
        ${linkedDomains.map(d => `<span class="badge-tag">🌐 ${esc(d.domain)}</span>`).join(' ')}
      </div>
    ` : ''}
    ${s.notes ? `<div class="notes-content">${esc(s.notes)}</div>` : ''}
    ${!hasScreenshot ? '' : `
      <div style="margin-top:var(--sp-sm)">
        <label class="btn btn-outline btn-sm" style="cursor:pointer">
          更换截图
          <input type="file" accept="image/*" style="display:none" onchange="uploadScreenshot('${s.id}', this)">
        </label>
      </div>
    `}
    <div style="display:flex;gap:var(--sp-md);margin-top:var(--sp-lg)">
      <button class="btn btn-primary btn-sm" onclick="closeModal('modal-service');openServiceForm('${s.id}')">编辑</button>
      <button class="btn btn-danger btn-sm" onclick="if(confirm('确定删除 ${esc(s.name)}？')) deleteServiceConfirm('${s.id}')">删除</button>
      <a href="${esc(s.url)}" target="_blank" class="btn btn-outline btn-sm">打开 →</a>
    </div>
  `;

  openModal('modal-service');
}

// --- Domain Detail ---
function openDomainDetail(id) {
  const d = state.domains.find(dm => dm.id === id);
  if (!d) return;

  const linkedServices = (d.service_ids || [])
    .map(sid => state.services.find(s => s.id === sid))
    .filter(Boolean);

  document.getElementById('modal-domain-content').innerHTML = `
    <h3 class="modal-title" style="margin-bottom:0">${esc(d.domain)}</h3>
    <div class="info-grid">
      <div class="info-item"><span class="info-label">注册商</span><span>${esc(d.registrar || '--')}</span></div>
      <div class="info-item"><span class="info-label">DNS 提供商</span><span class="badge-tag">${d.dns_provider === 'cloudflare' ? '☁️ Cloudflare' : '📋 手动'}</span></div>
      <div class="info-item"><span class="info-label">到期日</span><span>${d.expiry_date ? fmtDate(d.expiry_date) + (daysUntil(d.expiry_date) < 30 ? ` ⚠️ <span class="expiry-badge ${daysUntil(d.expiry_date) < 7 ? 'danger' : 'warning'}">${daysUntil(d.expiry_date)} 天</span>` : '') : '--'}</span></div>
      <div class="info-item"><span class="info-label">SSL</span><span>${d.ssl_expiry ? fmtDate(d.ssl_expiry) + (daysUntil(d.ssl_expiry) < 30 ? ` ⚠️ <span class="expiry-badge ${daysUntil(d.ssl_expiry) < 7 ? 'danger' : 'warning'}">${daysUntil(d.ssl_expiry)} 天</span>` : '') : '--'}</span></div>
      ${d.cf_zone_id ? `<div class="info-item"><span class="info-label">CF Zone ID</span><span style="font-family:monospace;font-size:var(--fs-caption-sm)">${esc(d.cf_zone_id)}</span></div>` : ''}
      <div class="info-item"><span class="info-label">状态</span><span>${esc(d.status || 'active')}</span></div>
    </div>
    ${linkedServices.length > 0 ? `
      <div><p class="caption-md" style="color:var(--mute);margin-bottom:var(--sp-sm)">关联服务</p>
        ${linkedServices.map(sv => `<span class="badge-tag" style="cursor:pointer" onclick="closeModal('modal-domain');openServiceDetail('${sv.id}')">${esc(sv.name)}</span>`).join(' ')}
      </div>
    ` : `<p class="body-sm" style="color:var(--mute)">未关联任何服务</p>`}
    ${d.dns_records && d.dns_records.length > 0 ? `
      <div>
        <p class="caption-md" style="color:var(--mute);margin-bottom:var(--sp-sm)">DNS 记录（缓存）</p>
        <table class="data-table" style="font-size:var(--fs-caption-sm)">
          <thead><tr><th>类型</th><th>名称</th><th>值</th><th>代理</th></tr></thead>
          <tbody>${d.dns_records.map(r => `
            <tr><td>${esc(r.type)}</td><td>${esc(r.name)}</td><td style="max-width:180px;overflow:hidden;text-overflow:ellipsis">${esc(r.content)}</td><td>${r.proxied ? '🟠' : '⬜'}</td></tr>
          `).join('')}</tbody>
        </table>
      </div>
    ` : ''}
    ${d.notes ? `<div class="notes-content">${esc(d.notes)}</div>` : ''}
    <div style="display:flex;gap:var(--sp-md);margin-top:var(--sp-lg)">
      <button class="btn btn-primary btn-sm" onclick="closeModal('modal-domain');openDomainForm('${d.id}')">编辑</button>
      <button class="btn btn-danger btn-sm" onclick="if(confirm('确定删除域名 ${esc(d.domain)}？')) deleteDomainConfirm('${d.id}')">删除</button>
    </div>
  `;

  openModal('modal-domain');
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
    document.getElementById('svc-name').value = s.name;
    document.getElementById('svc-url').value = s.url;
    document.getElementById('svc-desc').value = s.description || '';
    document.getElementById('svc-category').value = s.category || 'other';
    document.getElementById('svc-status').value = s.status;
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
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Save failed');
    closeModal('modal-service-form');
    await loadServices();
    renderAll();
  } catch (err) {
    alert('保存失败: ' + err.message);
  }
}

async function deleteServiceConfirm(id) {
  try {
    await fetch(`/api/services/${id}`, { method: 'DELETE' });
    closeModal('modal-service');
    await loadServices();
    renderAll();
  } catch (err) {
    alert('删除失败: ' + err.message);
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
    document.getElementById('dom-domain').value = d.domain;
    document.getElementById('dom-registrar').value = d.registrar || '';
    document.getElementById('dom-dns-provider').value = d.dns_provider || 'manual';
    document.getElementById('dom-cf-zone-id').value = d.cf_zone_id || '';
    document.getElementById('dom-expiry').value = d.expiry_date || '';
    document.getElementById('dom-ssl-expiry').value = d.ssl_expiry || '';
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
    registrar: document.getElementById('dom-registrar').value.trim(),
    dns_provider: document.getElementById('dom-dns-provider').value,
    cf_zone_id: document.getElementById('dom-cf-zone-id').value.trim() || null,
    expiry_date: document.getElementById('dom-expiry').value || null,
    ssl_expiry: document.getElementById('dom-ssl-expiry').value || null,
    service_ids: document.getElementById('dom-service-ids').value.split(',').map(s => s.trim()).filter(Boolean),
    notes: document.getElementById('dom-notes').value.trim(),
  };

  const url = id ? `/api/domains/${id}` : '/api/domains';
  const method = id ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Save failed');
    closeModal('modal-domain-form');
    await loadDomains();
    renderAll();
  } catch (err) {
    alert('保存失败: ' + err.message);
  }
}

async function deleteDomainConfirm(id) {
  try {
    await fetch(`/api/domains/${id}`, { method: 'DELETE' });
    closeModal('modal-domain');
    await loadDomains();
    renderAll();
  } catch (err) {
    alert('删除失败: ' + err.message);
  }
}

// --- Screenshot Upload ---
async function uploadScreenshot(serviceId, input) {
  const file = input.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('screenshot', file);

  try {
    const res = await fetch(`/api/services/${serviceId}/screenshots`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error('Upload failed');
    await loadServices();
    // Re-open detail modal
    closeModal('modal-service');
    setTimeout(() => openServiceDetail(serviceId), 200);
  } catch (err) {
    alert('上传失败: ' + err.message);
  }
}

// --- Settings ---
function openSettings() {
  openModal('modal-settings');
}

async function testCFConnection() {
  try {
    const res = await fetch('/api/cf/zones');
    const data = await res.json();
    const note = document.getElementById('settings-cf-note');
    if (data.success) {
      note.innerHTML = `✅ 连接成功！发现 <strong>${data.result.length}</strong> 个域名。 <button class="btn btn-primary btn-sm" style="margin-left:8px" onclick="syncFromCloudflare()">一键导入</button>`;
    } else if (data.error) {
      note.innerHTML = `❌ 错误: ${esc(data.error)}。请确保已设置 CF_API_TOKEN 环境变量。`;
    } else {
      note.innerHTML = `⚠️ API 返回异常: ${esc(JSON.stringify(data))}`;
    }
  } catch (err) {
    document.getElementById('settings-cf-note').innerHTML = `❌ 请求失败: ${esc(err.message)}`;
  }
}

async function syncFromCloudflare() {
  const btn = document.querySelector('.btn-outline-on-dark');
  const origText = btn.textContent;
  btn.textContent = '同步中…';
  btn.disabled = true;

  try {
    // Fetch all zones from CF
    const zonesResp = await fetch('/api/cf/zones?per_page=50');
    const zonesData = await zonesResp.json();

    if (!zonesData.success) {
      alert('CF 同步失败: ' + JSON.stringify(zonesData.errors));
      btn.textContent = origText;
      btn.disabled = false;
      return;
    }

    // Merge CF zones into local domains
    let added = 0;
    for (const zone of zonesData.result) {
      const existing = state.domains.find(d => d.cf_zone_id === zone.id);
      if (!existing) {
        await fetch('/api/domains', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            domain: zone.name,
            registrar: 'Cloudflare',
            dns_provider: 'cloudflare',
            cf_zone_id: zone.id,
            status: zone.status,
            service_ids: [],
          }),
        });
        added++;
      } else {
        // Update existing
        await fetch(`/api/domains/${existing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: zone.status,
            cf_zone_id: zone.id,
          }),
        });
      }
    }

    await loadDomains();
    await loadHealth();
    renderAll();
    alert(`✅ 同步完成！导入 ${added} 个新域名，共 ${zonesData.result.length} 个 Cloudflare 域名。`);
  } catch (err) {
    alert('同步失败: ' + err.message);
  }
  btn.textContent = origText;
  btn.disabled = false;
}

// ============================================================
// HELPERS
// ============================================================

function esc(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function statusLabel(s) {
  if (s === 'running') return '运行中';
  if (s === 'maintenance') return '维护中';
  if (s === 'stopped') return '已停用';
  return s;
}

function fmtDate(dateStr) {
  if (!dateStr) return '--';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
  } catch {
    return dateStr;
  }
}

function daysUntil(dateStr) {
  if (!dateStr) return Infinity;
  const target = new Date(dateStr);
  const now = new Date();
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

// ============================================================
// KEYBOARD SHORTCUTS
// ============================================================

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    // Close all modals
    document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(el => {
      el.classList.add('hidden');
    });
  }
  // Nav shortcuts: 1=Overview 2=Services 3=Domains 4=DNS
  if (e.metaKey || e.ctrlKey) {
    if (e.key === '1') { e.preventDefault(); navTo('overview'); }
    if (e.key === '2') { e.preventDefault(); navTo('services'); }
    if (e.key === '3') { e.preventDefault(); navTo('domains'); }
    if (e.key === '4') { e.preventDefault(); navTo('dns'); }
  }
});

// ============================================================
// START
// ============================================================

document.addEventListener('DOMContentLoaded', init);
