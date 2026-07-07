#!/usr/bin/env node
/**
 * 数据迁移脚本
 * 将旧的数据模型迁移到新的简化模型
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, 'data', 'data.json');

console.log('🔄 开始数据迁移...\n');

if (!existsSync(DATA_FILE)) {
  console.log('❌ 数据文件不存在，跳过迁移');
  process.exit(0);
}

const data = JSON.parse(readFileSync(DATA_FILE, 'utf-8'));

console.log(`找到 ${data.services?.length || 0} 个服务，${data.domains?.length || 0} 个域名\n`);

// 迁移服务数据
if (data.services) {
  data.services = data.services.map(s => ({
    id: s.id,
    name: s.name || '',
    cover_image: s.cover_image || '',
    domain: s.domain || (s.url ? new URL(s.url).hostname : ''),  // 从 URL 提取域名
    notes: s.notes || s.description || '',
    status: s.status || 'running',
    created_at: s.created_at,
    updated_at: s.updated_at,
  }));
  console.log('✅ 服务数据已迁移');
}

// 迁移域名数据
if (data.domains) {
  data.domains = data.domains.map(d => ({
    id: d.id,
    domain: d.domain || '',
    ip_address: d.ip_address || '',
    service_ids: d.service_ids || [],
    dns_provider: d.dns_provider || 'manual',
    dns_status: d.dns_status || 'inactive',
    expiry_date: d.expiry_date || null,
    ssl_status: d.ssl_status || 'unknown',
    registrar: d.registrar || '',
    notes: d.notes || '',
    created_at: d.created_at,
    updated_at: d.updated_at,
  }));
  console.log('✅ 域名数据已迁移');
}

// 备份旧数据
const backupFile = DATA_FILE + '.backup.' + Date.now();
writeFileSync(backupFile, JSON.stringify(data, null, 2));
console.log(`\n💾 旧数据已备份到: ${backupFile}`);

// 保存新数据
writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
console.log('✅ 新数据已保存\n');

console.log('🎉 迁移完成！');
