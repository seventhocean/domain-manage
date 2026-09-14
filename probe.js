// 域名真实探测：HTTP(S) 请求确认是否有服务，并从响应中识别服务类型（只读）
import http from 'node:http';
import https from 'node:https';

const DEFAULT_TIMEOUT_MS = 6000;
const MAX_REDIRECTS = 5;
const MAX_BODY_BYTES = 64 * 1024;
const USER_AGENT = 'Mozilla/5.0 (compatible; domain-manage-probe/1.0; +https://waitwinter.eu.cc)';

const CERT_ERRORS = new Set([
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'CERT_HAS_EXPIRED',
  'CERT_NOT_YET_VALID',
  'ERR_TLS_CERT_ALTNAME_INVALID',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'UNABLE_TO_GET_ISSUER_CERT',
]);

const KIND_RULES = [
  [/home\s*assistant/i, 'Home Assistant'],
  [/nextcloud/i, 'Nextcloud'],
  [/wordpress|wp-content|wp-includes/i, 'WordPress'],
  [/typecho/i, 'Typecho'],
  [/\bhalo\b|halo\.run/i, 'Halo'],
  [/ghost/i, 'Ghost'],
  [/qbittorrent/i, 'qBittorrent'],
  [/transmission/i, 'Transmission'],
  [/alist/i, 'AList'],
  [/cloudreve/i, 'Cloudreve'],
  [/navidrome/i, 'Navidrome'],
  [/immich/i, 'Immich'],
  [/jellyfin/i, 'Jellyfin'],
  [/\bemby\b/i, 'Emby'],
  [/\bplex\b/i, 'Plex'],
  [/uptime\s*kuma/i, 'Uptime Kuma'],
  [/komari/i, 'Komari'],
  [/grafana/i, 'Grafana'],
  [/prometheus/i, 'Prometheus'],
  [/青龙|qinglong/i, '青龙面板'],
  [/宝塔|bt[- ]?panel/i, '宝塔面板'],
  [/vaultwarden|bitwarden/i, 'Vaultwarden'],
  [/gitea|forgejo/i, 'Gitea'],
  [/gitlab/i, 'GitLab'],
  [/portainer/i, 'Portainer'],
  [/minio/i, 'MinIO'],
  [/openwrt|luci/i, 'OpenWrt'],
  [/routeros|mikrotik/i, 'RouterOS'],
  [/synology|群晖/i, 'Synology'],
  [/飞牛|fnos/i, '飞牛 OS'],
  [/domain-manage/i, 'domain-manage 面板'],
];

const BODY_RULES = [
  [/komari/i, 'Komari'],
  [/home\s*assistant/i, 'Home Assistant'],
  [/nextcloud/i, 'Nextcloud'],
  [/qbittorrent/i, 'qBittorrent'],
  [/transmission/i, 'Transmission'],
  [/alist/i, 'AList'],
  [/cloudreve/i, 'Cloudreve'],
  [/navidrome/i, 'Navidrome'],
  [/immich/i, 'Immich'],
  [/jellyfin/i, 'Jellyfin'],
  [/uptime\s*kuma/i, 'Uptime Kuma'],
  [/grafana/i, 'Grafana'],
  [/prometheus/i, 'Prometheus'],
  [/青龙|qinglong/i, '青龙面板'],
  [/宝塔|bt[- ]?panel/i, '宝塔面板'],
  [/vaultwarden|bitwarden/i, 'Vaultwarden'],
  [/gitea|forgejo/i, 'Gitea'],
  [/gitlab/i, 'GitLab'],
  [/portainer/i, 'Portainer'],
  [/minio/i, 'MinIO'],
  [/wordpress|wp-content/i, 'WordPress'],
  [/typecho/i, 'Typecho'],
];

const PLACEHOLDER_RULES = [
  [/welcome to nginx/i, 'Nginx 默认页'],
  [/^it works!$/i, 'Apache 默认页'],
  [/apache2? (ubuntu|debian) default page/i, 'Apache 默认页'],
];

function isCertError(error) {
  return Boolean(error) && (CERT_ERRORS.has(error.code) || /certificate|self[- ]signed/i.test(error.message || ''));
}

function decodeEntities(text) {
  return String(text)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function requestOnce(target, { timeout, rejectUnauthorized }) {
  return new Promise(resolve => {
    let settled = false;
    const started = Date.now();
    const done = value => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const mod = target.protocol === 'https:' ? https : http;
    const req = mod.request({
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || undefined,
      path: `${target.pathname || '/'}${target.search || ''}`,
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      timeout,
      rejectUnauthorized,
    }, res => {
      const contentType = String(res.headers['content-type'] || '');
      const readable = /text\/html|application\/json|text\/plain|application\/xhtml/i.test(contentType);
      let body = '';
      let size = 0;

      res.on('data', chunk => {
        if (!readable) return;
        if (size < MAX_BODY_BYTES) {
          body += chunk.slice(0, MAX_BODY_BYTES - size).toString('utf8');
          size += chunk.length;
        }
        if (size >= MAX_BODY_BYTES) req.destroy();
      });

      const finish = () => done({
        status: res.statusCode,
        headers: res.headers,
        body,
        elapsed_ms: Date.now() - started,
      });

      res.on('end', finish);
      res.on('close', finish);
      res.on('error', finish);
    });

    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', error => done({ error }));
    req.end();
  });
}

async function fetchWithTlsFallback(target, timeout) {
  const first = await requestOnce(target, { timeout, rejectUnauthorized: true });
  if (first.error && isCertError(first.error)) {
    const retry = await requestOnce(target, { timeout, rejectUnauthorized: false });
    return { response: retry, tlsInvalid: true };
  }
  return { response: first, tlsInvalid: false };
}

async function followRedirects(url, timeout) {
  let current = new URL(url);
  let tlsInvalid = false;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const { response, tlsInvalid: hopTlsInvalid } = await fetchWithTlsFallback(current, timeout);
    if (hopTlsInvalid) tlsInvalid = true;

    if (response.error) {
      return { ok: false, error: response.error.message || String(response.error), final_url: current.href, tls_invalid: tlsInvalid };
    }
    if (response.status >= 300 && response.status < 400 && response.headers.location) {
      try {
        current = new URL(response.headers.location, current);
      } catch {
        return { ok: false, error: 'invalid redirect', final_url: current.href, tls_invalid: tlsInvalid };
      }
      continue;
    }
    return {
      ok: true,
      status: response.status,
      headers: response.headers,
      body: response.body,
      final_url: current.href,
      tls_invalid: tlsInvalid,
      elapsed_ms: response.elapsed_ms,
    };
  }

  return { ok: false, error: 'too many redirects', final_url: current.href, tls_invalid: tlsInvalid };
}

function detectKind(result) {
  const headers = result.headers || {};
  const body = result.body || '';
  const titleMatch = body.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeEntities(titleMatch[1]).replace(/\s+/g, ' ').trim().slice(0, 120) : '';
  const generatorMatch = body.match(/<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)/i);
  const generator = generatorMatch ? generatorMatch[1].trim().slice(0, 80) : '';
  const haystack = `${title} ${generator} ${headers['server'] || ''} ${headers['x-powered-by'] || ''}`;

  for (const [pattern, kind] of KIND_RULES) {
    if (pattern.test(haystack)) return { title, generator, kind };
  }
  const bodyHaystack = body.slice(0, 32 * 1024);
  for (const [pattern, kind] of BODY_RULES) {
    if (pattern.test(bodyHaystack)) return { title, generator, kind };
  }
  for (const [pattern, kind] of PLACEHOLDER_RULES) {
    if (pattern.test(title) || pattern.test(bodyHaystack)) return { title, generator, kind, placeholder: true };
  }
  if (title) return { title, generator, kind: '网页' };
  if (generator) return { title, generator, kind: generator };
  if (headers['www-authenticate']) return { title, generator, kind: '需登录的服务' };
  const server = headers['server'];
  return { title, generator, kind: server ? server : 'HTTP 服务' };
}

export async function probeDomain(domain, { timeout = DEFAULT_TIMEOUT_MS } = {}) {
  const clean = String(domain || '').trim().toLowerCase();
  if (!clean) {
    return { ok: false, error: 'empty domain', checked_at: new Date().toISOString() };
  }

  let result = await followRedirects(`https://${clean}/`, timeout);
  if (!result.ok && !result.status) {
    const viaHttp = await followRedirects(`http://${clean}/`, timeout);
    if (viaHttp.ok) result = viaHttp;
  }

  const detected = detectKind(result);
  return {
    ok: Boolean(result.ok),
    status: result.status || null,
    final_url: result.final_url || null,
    scheme: String(result.final_url || '').startsWith('http://') ? 'http' : 'https',
    server: (result.headers && result.headers.server) || null,
    powered_by: (result.headers && result.headers['x-powered-by']) || null,
    title: detected.title,
    generator: detected.generator,
    kind: result.ok ? detected.kind : null,
    placeholder: Boolean(result.ok && detected.placeholder),
    tls_invalid: Boolean(result.tls_invalid),
    elapsed_ms: result.elapsed_ms || null,
    error: result.ok ? null : (result.error || 'no response'),
    checked_at: new Date().toISOString(),
  };
}

export async function mapPool(items, limit, worker) {
  const results = new Array(items.length);
  let index = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const current = index++;
      if (current >= items.length) return;
      results[current] = await worker(items[current], current);
    }
  });
  await Promise.all(runners);
  return results;
}
