# domain-manage

个人域名 / 服务 / 服务器台账面板：记录注册的域名、部署的服务和所在服务器，并让每个域名一眼可认。Express 5 + 原生 JS 前端 + JSON 文件存储。

## 本地运行

```bash
npm install
npm start        # http://localhost:3000
npm run dev      # node --watch，改代码自动重启
```

## Docker 部署（生产）

```bash
docker compose up -d --build
# 访问 http://localhost:3080
```

- 生产域名：`https://waitwinter.eu.cc`（Cloudflare 代理 → 主机 3080 端口）。
- 数据持久化在 named volume `domain-manage_domain-data`（`data/data.json`、`data/icons/`、截图与封面），`docker compose down` 不会删除数据。
- `./public` 以 bind mount 挂载，改前端文件后刷新页面即可，无需重建镜像。
- `CF_API_TOKEN` 环境变量可选；也可在面板「设置」中保存（存于 `data.json`）。
- `nginx.conf` 是外部反向代理的参考配置，Docker 镜像内不含 nginx，容器直接运行 Node。

## Komari 监控联动（只读）

面板可读取独立部署的 Komari 监控数据：自动导入服务器、显示实时状态（CPU / 内存 / 磁盘 / 负载 / uptime）与续费、成本统计。

- 在 Komari 后台生成 API Key（需 1.0.3+），然后到面板「设置 → Komari」填地址与 Key；也可设置环境变量 `KOMARI_URL` / `KOMARI_API_KEY`（优先于面板设置）。
- 配置后打开服务器页点「同步 Komari」，或在空台账时自动导入全部节点；节点按 IP 自动匹配到服务器。
- 只读：不会向 Komari 写入任何数据，告警仍由 Komari 自己推送。
- 未配置 Key 时降级为公开接口：节点列表与状态可用，但拿不到 IP，无法自动匹配。

## 服务自动推断与探测

- 域名页「探测」：服务端真实请求每个域名，记录是否有响应、状态码、页面标题和服务类型（如 Komari、Nextcloud、宝塔面板），结果显示在域名卡片上。
- 服务页「从域名推断」：域名解析 IP 命中服务器后**先做真实探测**，只有真正有服务的域名才会创建服务与 `https:443` 部署记录；无响应、默认页（如 nginx 欢迎页）和 5xx 都不会创建，只在域名上保留探测结果。
- 结果标注：域名卡片绿点=正常、黄点=默认页/5xx、红点=无响应；服务卡片也会显示识别类型与异常标记。
- 默认命名：域名别名，否则取域名首段；两台机器上重名时用完整域名区分。自动创建的服务带「自动推断」和识别类型 chip，可随时手动编辑、合并或删除。
- 探测是一次性的 HTTP 检查，不是持续监控；持续监控与告警仍由 Komari 负责。

## 登录

首次打开面板会进入「设置访问口令」页，设置后自动登录；之后访问需要输入口令（30 天 HttpOnly Cookie，侧栏底部可退出）。

- 也可用环境变量指定口令：在项目目录 `.env` 里设置 `AUTH_PASSWORD=你的口令`，环境变量优先于面板里保存的口令。
- 忘记口令：删除数据卷中 `data/data.json` 的 `auth_password_hash` 和 `session_version` 字段，刷新后会回到设置口令页。
- 面板「设置」里可修改口令；修改后其他设备的登录会失效。

### 备份 / 恢复数据卷

```bash
# 备份到当前目录
docker run --rm -v domain-manage_domain-data:/data -v "$PWD":/backup alpine \
  tar czf /backup/domain-manage-data.tar.gz -C /data .

# 从备份恢复
docker run --rm -v domain-manage_domain-data:/data -v "$PWD":/backup alpine \
  sh -c "tar xzf /backup/domain-manage-data.tar.gz -C /data"
```

## 文档

- `DESIGN.md` — UI 规范，改前端前先读；`npx @google/design.md lint DESIGN.md` 校验。
- `PRD.md` — 产品定位、功能优先级与路线图。
- `CLAUDE.md` — 历史笔记，可能过时。
