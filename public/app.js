// --- State ---
const state = {
  services: [],
  domains: [],
  dashboard: null,
  view: 'dashboard',
  servicesViewMode: 'grid', // 'grid' or 'list'
  domainsViewMode: 'grid',  // 'grid' or 'list'
};

// --- Init ---
async function init() {
  await Promise.all([
    loadServices(),
    loadDomains(),
    loadDashboardStats(),
  ]);
  navigate('dashboard');
}

// --- API Helpers ---
async function api(path, opts = {}) {
  const resp = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: resp.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return resp.json();
}

// --- Navigation ---
function navigate(view) {
  state.view = view;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(`view-${view}`).classList.add('active');
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  document.querySelector(`.nav-link[data-view="${view}"]`)?.classList.add('active');

  if (view === 'dashboard') renderDashboard();
  if (view === 'services') renderServices();
  if (view === 'domains') renderDomains();
}

// --- Dashboard ---
async function loadDashboardStats() {
  state.dashboard = await api('/api/dashboard/stats');
  renderDashboard();
}

function renderDashboard() {
  if (!state.dashboard) return;

  const d = state.dashboard;
  document.getElementById('metric-services-running').textContent = d.services.running;
  document.getElementById('metric-services-total').textContent = `共 ${d.services.total} 个服务`;
  document.getElementById('metric-domains-active').textContent = d.domains.active;
  document.getElementById('metric-domains-total').textContent = `共 ${d.domains.total} 个域名`;
  document.getElementById('metric-expiring').textContent = d.expiring_soon.length;
  document.getElementById('metric-alerts').textContent = d.alerts.length;
}

function showAlerts() {
  const panel = document.getElementById('alerts-panel');
  panel.classList.toggle('hidden');

  if (!panel.classList.contains('hidden')) {
    const list = document.getElementById('alerts-list');
    const alerts = state.dashboard?.alerts || [];

    if (alerts.length === 0) {
      list.innerHTML = '<p class="body-sm text-mute">没有告警信息</p>';
      return;
    }

    list.innerHTML = alerts.map(a => `
      <div class="alert-item alert-${a.severity}">
        <div class="alert-icon">${a.severity === 'error' ? '❌' : '⚠️'}</div>
        <div class="alert-content">
          <div class="alert-message">${esc(a.message)}</div>
          ${a.service_id ? `<a href="#" onclick="navigate('services'); return false;" class="alert-link">查看服务</a>` : ''}
          ${a.domain_id ? `<a href="#" onclick="navigate('domains'); return false;" class="alert-link">查看域名</a>` : ''}
        </div>
      </div>
    `).join('');
  }
}

// --- Services ---
async function loadServices() {
  state.services = await api('/api/services');
}

function renderServices() {
  const search = document.getElementById('services-search').value.toLowerCase();
  const statusFilter = document.getElementById('services-filter-status').value;

  let filtered = state.services.filter(s => {
    const matchSearch = !search || s.name.toLowerCase().includes(search) || (s.domain || '').toLowerCase().includes(search);
    const matchStatus = !statusFilter || s.status === statusFilter;
    return matchSearch && matchStatus;
  });

  if (state.servicesViewMode === 'grid') {
    renderServicesGrid(filtered);
  } else {
    renderServicesList(filtered);
  }
}

function renderServicesGrid(services) {
  const grid = document.getElementById('services-grid');
  const list = document.getElementById('services-list');
  grid.classList.remove('hidden');
  list.classList.add('hidden');

  if (services.length === 0) {
    grid.innerHTML = '<p class="body-sm text-mute">没有服务</p>';
    return;
  }

  grid.innerHTML = services.map(s => `
    <div class="service-card">
      ${s.cover_image ? `<img src="${esc(s.cover_image)}" alt="" class="service-cover">` : '<div class="service-cover-placeholder"></div>'}
      <div class="service-content">
        <div class="service-header">
          <h3 class="card-title">${esc(s.name)}</h3>
          <span class="status-badge status-${s.status}">${getStatusText(s.status)}</span>
        </div>
        ${s.domain ? `
          <div class="service-domains">
            ${s.domain.split(',').map(d => d.trim()).filter(d => d).map(d => `
              <a href="#" onclick="goToDomain('${esc(d)}'); return false;" class="domain-link">${esc(d)}</a>
            `).join('')}
          </div>
        ` : ''}
        ${s.notes ? `<p class="service-notes body-sm text-mute">${esc(s.notes)}</p>` : ''}
        <div class="service-actions">
          <button type="button" class="btn btn-outline btn-sm" onclick="editService('${s.id}')">编辑</button>
          <button type="button" class="btn btn-outline btn-sm" onclick="deleteServiceConfirm('${s.id}')">删除</button>
        </div>
      </div>
    </div>
  `).join('');
}

function renderServicesList(services) {
  const grid = document.getElementById('services-grid');
  const list = document.getElementById('services-list');
  grid.classList.add('hidden');
  list.classList.remove('hidden');

  if (services.length === 0) {
    list.innerHTML = '<p class="body-sm text-mute">没有服务</p>';
    return;
  }

  list.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>名称</th>
          <th>域名</th>
          <th>状态</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        ${services.map(s => `
          <tr>
            <td><strong>${esc(s.name)}</strong></td>
            <td>
              ${s.domain ? s.domain.split(',').map(d => d.trim()).filter(d => d).map(d => `
                <a href="#" onclick="goToDomain('${esc(d)}'); return false;">${esc(d)}</a>
              `).join(', ') : '<span class="text-mute">-</span>'}
            </td>
            <td><span class="status-badge status-${s.status}">${getStatusText(s.status)}</span></td>
            <td>
              <button type="button" class="btn btn-outline btn-sm" onclick="editService('${s.id}')">编辑</button>
              <button type="button" class="btn btn-outline btn-sm" onclick="deleteServiceConfirm('${s.id}')">删除</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function toggleServicesView() {
  state.servicesViewMode = state.servicesViewMode === 'grid' ? 'list' : 'grid';
  const btn = document.getElementById('btn-toggle-services-view');
  btn.querySelector('span').textContent = state.servicesViewMode === 'grid' ? '列表' : '卡片';
  renderServices();
}

function openServiceModal(service = null) {
  document.getElementById('service-modal-title').textContent = service ? '编辑服务' : '添加服务';
  document.getElementById('service-id').value = service?.id || '';
  document.getElementById('service-name').value = service?.name || '';
  document.getElementById('service-domain').value = service?.domain || '';
  document.getElementById('service-status').value = service?.status || 'running';
  document.getElementById('service-notes').value = service?.notes || '';

  const preview = document.getElementById('service-cover-preview');
  if (service?.cover_image) {
    preview.src = service.cover_image;
    preview.style.display = 'block';
  } else {
    preview.style.display = 'none';
  }

  openModal('modal-service');
}

function editService(id) {
  const service = state.services.find(s => s.id === id);
  if (service) openServiceModal(service);
}

async function saveService(event) {
  event.preventDefault();
  const id = document.getElementById('service-id').value;
  const data = {
    name: document.getElementById('service-name').value,
    domain: document.getElementById('service-domain').value,
    status: document.getElementById('service-status').value,
    notes: document.getElementById('service-notes').value,
  };

  try {
    if (id) {
      await api(`/api/services/${id}`, { method: 'PUT', body: JSON.stringify(data) });
      showToast('success', '服务已更新');
    } else {
      await api('/api/services', { method: 'POST', body: JSON.stringify(data) });
      showToast('success', '服务已添加');
    }
    await loadServices();
    await loadDashboardStats();
    renderServices();
    closeModal('modal-service');
  } catch (err) {
    showToast('error', '保存失败', err.message);
  }
}

async function deleteServiceConfirm(id) {
  if (!confirm('确定要删除这个服务吗？')) return;
  try {
    await api(`/api/services/${id}`, { method: 'DELETE' });
    showToast('success', '服务已删除');
    await loadServices();
    await loadDashboardStats();
    renderServices();
  } catch (err) {
    showToast('error', '删除失败', err.message);
  }
}

async function uploadCover(event) {
  const file = event.target.files[0];
  if (!file) return;

  const serviceId = document.getElementById('service-id').value;
  if (!serviceId) {
    showToast('error', '请先保存服务再上传封面');
    return;
  }

  const formData = new FormData();
  formData.append('cover', file);

  try {
    const resp = await fetch(`/api/services/${serviceId}/cover`, {
      method: 'POST',
      body: formData,
    });
    const data = await resp.json();
    if (data.url) {
      const preview = document.getElementById('service-cover-preview');
      preview.src = data.url;
      preview.style.display = 'block';
      showToast('success', '封面已上传');
    }
  } catch (err) {
    showToast('error', '上传失败', err.message);
  }
}

// --- Domains ---
async function loadDomains() {
  state.domains = await api('/api/domains');
}

function renderDomains() {
  const search = document.getElementById('domains-search').value.toLowerCase();
  const statusFilter = document.getElementById('domains-filter-status').value;

  let filtered = state.domains.filter(d => {
    const matchSearch = !search || d.domain.toLowerCase().includes(search);
    const matchStatus = !statusFilter || d.dns_status === statusFilter;
    return matchSearch && matchStatus;
  });

  if (state.domainsViewMode === 'grid') {
    renderDomainsGrid(filtered);
  } else {
    renderDomainsList(filtered);
  }
}

function renderDomainsGrid(domains) {
  const grid = document.getElementById('domains-grid');
  const list = document.getElementById('domains-list');
  grid.classList.remove('hidden');
  list.classList.add('hidden');

  if (domains.length === 0) {
    grid.innerHTML = '<p class="body-sm text-mute">没有域名</p>';
    return;
  }

  grid.innerHTML = domains.map(d => {
    const services = (d.service_ids || []).map(id => state.services.find(s => s.id === id)).filter(Boolean);
    return `
      <div class="domain-card">
        <div class="domain-header">
          <h3 class="card-title">${esc(d.domain)}</h3>
          <span class="status-badge status-${d.dns_status}">${d.dns_status === 'active' ? '已解析' : '未解析'}</span>
        </div>
        <div class="domain-info">
          ${d.ip_address ? `<div class="info-row"><span class="info-label">IP:</span> <span class="mono">${esc(d.ip_address)}</span></div>` : ''}
          ${services.length > 0 ? `
            <div class="info-row">
              <span class="info-label">服务:</span>
              ${services.map(s => `<a href="#" onclick="goToService('${s.id}'); return false;" class="service-link">${esc(s.name)}</a>`).join(', ')}
            </div>
          ` : ''}
          ${d.expiry_date ? `<div class="info-row"><span class="info-label">到期:</span> <span>${esc(d.expiry_date)}</span></div>` : ''}
          ${d.ssl_status !== 'unknown' ? `<div class="info-row"><span class="info-label">SSL:</span> <span class="ssl-status ssl-${d.ssl_status}">${getSSLStatusText(d.ssl_status)}</span></div>` : ''}
        </div>
        ${d.notes ? `<p class="domain-notes body-sm text-mute">${esc(d.notes)}</p>` : ''}
        <div class="domain-actions">
          <button type="button" class="btn btn-outline btn-sm" onclick="editDomain('${d.id}')">编辑</button>
          <button type="button" class="btn btn-outline btn-sm" onclick="deleteDomainConfirm('${d.id}')">删除</button>
        </div>
      </div>
    `;
  }).join('');
}

function renderDomainsList(domains) {
  const grid = document.getElementById('domains-grid');
  const list = document.getElementById('domains-list');
  grid.classList.add('hidden');
  list.classList.remove('hidden');

  if (domains.length === 0) {
    list.innerHTML = '<p class="body-sm text-mute">没有域名</p>';
    return;
  }

  list.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>域名</th>
          <th>IP</th>
          <th>服务</th>
          <th>状态</th>
          <th>到期</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        ${domains.map(d => {
          const services = (d.service_ids || []).map(id => state.services.find(s => s.id === id)).filter(Boolean);
          return `
            <tr>
              <td><strong>${esc(d.domain)}</strong></td>
              <td>${d.ip_address ? `<span class="mono">${esc(d.ip_address)}</span>` : '<span class="text-mute">-</span>'}</td>
              <td>
                ${services.length > 0 ? services.map(s => `<a href="#" onclick="goToService('${s.id}'); return false;">${esc(s.name)}</a>`).join(', ') : '<span class="text-mute">-</span>'}
              </td>
              <td><span class="status-badge status-${d.dns_status}">${d.dns_status === 'active' ? '已解析' : '未解析'}</span></td>
              <td>${d.expiry_date || '<span class="text-mute">-</span>'}</td>
              <td>
                <button type="button" class="btn btn-outline btn-sm" onclick="editDomain('${d.id}')">编辑</button>
                <button type="button" class="btn btn-outline btn-sm" onclick="deleteDomainConfirm('${d.id}')">删除</button>
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

function toggleDomainsView() {
  state.domainsViewMode = state.domainsViewMode === 'grid' ? 'list' : 'grid';
  const btn = document.getElementById('btn-toggle-domains-view');
  btn.querySelector('span').textContent = state.domainsViewMode === 'grid' ? '列表' : '卡片';
  renderDomains();
}

function openDomainModal(domain = null) {
  document.getElementById('domain-modal-title').textContent = domain ? '编辑域名' : '添加域名';
  document.getElementById('domain-id').value = domain?.id || '';
  document.getElementById('domain-name').value = domain?.domain || '';
  document.getElementById('domain-ip').value = domain?.ip_address || '';
  document.getElementById('domain-dns-status').value = domain?.dns_status || 'inactive';
  document.getElementById('domain-expiry').value = domain?.expiry_date || '';
  document.getElementById('domain-ssl-status').value = domain?.ssl_status || 'unknown';
  document.getElementById('domain-notes').value = domain?.notes || '';

  // Populate services select
  const select = document.getElementById('domain-service');
  select.innerHTML = state.services.map(s => `
    <option value="${s.id}" ${domain?.service_ids?.includes(s.id) ? 'selected' : ''}>${esc(s.name)}</option>
  `).join('');

  openModal('modal-domain');
}

function editDomain(id) {
  const domain = state.domains.find(d => d.id === id);
  if (domain) openDomainModal(domain);
}

async function saveDomain(event) {
  event.preventDefault();
  const id = document.getElementById('domain-id').value;
  const serviceIds = Array.from(document.getElementById('domain-service').selectedOptions).map(o => o.value).filter(v => v);

  const data = {
    domain: document.getElementById('domain-name').value,
    ip_address: document.getElementById('domain-ip').value,
    service_ids: serviceIds,
    dns_status: document.getElementById('domain-dns-status').value,
    expiry_date: document.getElementById('domain-expiry').value || null,
    ssl_status: document.getElementById('domain-ssl-status').value,
    notes: document.getElementById('domain-notes').value,
  };

  try {
    if (id) {
      await api(`/api/domains/${id}`, { method: 'PUT', body: JSON.stringify(data) });
      showToast('success', '域名已更新');
    } else {
      await api('/api/domains', { method: 'POST', body: JSON.stringify(data) });
      showToast('success', '域名已添加');
    }
    await loadDomains();
    await loadDashboardStats();
    renderDomains();
    closeModal('modal-domain');
  } catch (err) {
    showToast('error', '保存失败', err.message);
  }
}

async function deleteDomainConfirm(id) {
  if (!confirm('确定要删除这个域名吗？')) return;
  try {
    await api(`/api/domains/${id}`, { method: 'DELETE' });
    showToast('success', '域名已删除');
    await loadDomains();
    await loadDashboardStats();
    renderDomains();
  } catch (err) {
    showToast('error', '删除失败', err.message);
  }
}

// --- Navigation Helpers ---
function goToDomain(domainName) {
  navigate('domains');
  setTimeout(() => {
    document.getElementById('domains-search').value = domainName;
    renderDomains();
  }, 100);
}

function goToService(serviceId) {
  navigate('services');
  setTimeout(() => {
    const service = state.services.find(s => s.id === serviceId);
    if (service) {
      document.getElementById('services-search').value = service.name;
      renderServices();
    }
  }, 100);
}

// --- Cloudflare ---
async function syncFromCloudflare() {
  const btn = document.querySelector('.nav-actions .btn-outline-on-dark');
  const orig = btn ? btn.textContent : '同步 CF';
  if (btn) { btn.disabled = true; btn.textContent = '同步中…'; }

  try {
    const result = await api('/api/cf/sync', { method: 'POST' });
    showToast('success', '同步完成',
      `发现 ${result.total_zones} 个域名，新增 ${result.added} 个，更新 ${result.updated} 个 IP 记录`);
    await loadDomains();
    await loadDashboardStats();
    if (state.view === 'domains') renderDomains();
    renderDashboard();
  } catch (err) {
    showToast('error', '同步失败', err.message);
  }

  if (btn) { btn.textContent = orig; btn.disabled = false; }
}

// --- Settings ---
function openSettings() { openModal('modal-settings'); }

async function saveCFToken() {
  const tokenInput = document.getElementById('settings-cf-token');
  const note = document.getElementById('settings-cf-note');
  const token = tokenInput.value.trim();

  if (!token) {
    note.innerHTML = '⚠️ 请输入 Cloudflare API Token';
    return;
  }

  note.innerHTML = '保存中…';
  try {
    const data = await api('/api/settings', {
      method: 'PUT',
      body: JSON.stringify({ cf_api_token: token })
    });

    if (data.cf_api_token_set) {
      note.innerHTML = '✅ Token 已保存！点击"验证连接"测试。';
      tokenInput.value = '';
      updateCFStatus(true);
    } else {
      note.innerHTML = '❌ 保存失败，请重试';
    }
  } catch (err) {
    note.innerHTML = `❌ 保存失败: ${esc(err.message)}`;
  }
}

async function testCFConnection() {
  const note = document.getElementById('settings-cf-note');

  const tokenInput = document.getElementById('settings-cf-token');
  const token = tokenInput.value.trim();
  if (token) {
    note.innerHTML = '保存 Token 中…';
    try {
      await api('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({ cf_api_token: token })
      });
      tokenInput.value = '';
    } catch (err) {
      note.innerHTML = `❌ 保存失败: ${esc(err.message)}`;
      return;
    }
  }

  note.innerHTML = '验证中…';
  try {
    const data = await api('/api/cf/zones');
    if (data.success) {
      note.innerHTML = `✅ 连接成功！发现 <strong>${data.result.length}</strong> 个域名。`;
      updateCFStatus(true);
    } else if (data.error) {
      note.innerHTML = `❌ 错误: ${esc(data.error)}。请在设置中配置 CF API Token。`;
      updateCFStatus(false);
    } else {
      note.innerHTML = `⚠️ API 返回异常: ${esc(JSON.stringify(data))}`;
      updateCFStatus(false);
    }
  } catch (err) {
    note.innerHTML = `❌ 请求失败: ${esc(err.message)}`;
    updateCFStatus(false);
  }
}

function updateCFStatus(connected) {
  const dot = document.getElementById('cf-status-dot');
  const text = document.getElementById('cf-status-text');
  dot.className = `dot ${connected ? 'green' : 'red'}`;
  text.textContent = connected ? 'CF 已连接' : 'CF 未连接';
}

// --- Helpers ---
function openModal(id) {
  const el = document.getElementById(id);
  el.classList.remove('hidden');
  // Trigger reflow for CSS transition to work
  void el.offsetWidth;
  el.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  const el = document.getElementById(id);
  el.classList.remove('open');
  el.addEventListener('transitionend', function handler() {
    el.removeEventListener('transitionend', handler);
    el.classList.add('hidden');
    document.body.style.overflow = '';
  }, { once: true });
  // Fallback: hide after timeout if transitionend doesn't fire
  setTimeout(() => {
    if (el.classList.contains('open')) return;
    el.classList.add('hidden');
    document.body.style.overflow = '';
  }, 400);
}

function showToast(type, title, message = '') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-body">
      <div class="toast-title">${esc(title)}</div>
      ${message ? `<div class="toast-msg">${esc(message)}</div>` : ''}
    </div>
  `;
  container.appendChild(toast);
  // Trigger reflow for CSS transition
  void toast.offsetWidth;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

function esc(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function getStatusText(status) {
  const map = { running: '运行中', stopped: '已停止', maintenance: '维护中' };
  return map[status] || status;
}

function getSSLStatusText(status) {
  const map = { active: '正常', expiring: '即将到期', expired: '已过期', unknown: '未知' };
  return map[status] || status;
}

// --- Start ---
init();
