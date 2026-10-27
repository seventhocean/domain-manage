# 资源台 · 个人 CMDB

用一个网站记录个人的域名、主机、服务、数据库、存储、云资源、SaaS/API 订阅和平台账号。资源可以按项目归集，并通过入口、部署和依赖相互关联。

技术栈：React + TypeScript + Vite、TanStack Query/Table、React Hook Form + Zod、Radix/shadcn 风格基础组件、Tailwind CSS、Express 5、SQLite + Drizzle。生产采用 Docker 单应用部署。

## 当前交付范围（0.2.0）

已实现资源核心流程：

- 九类资源建档、分类字段、标签、用途、项目、搜索筛选、详情 URL。
- 服务访问入口、域名关联、主机/托管平台部署、双向关系、变更历史。
- SQLite 事务、字段校验、版本冲突保护、回收站与恢复。
- 旧 JSON 的隔离迁移预检、首次启动迁移、原始备份与异常报告。
- 原有只读 Cloudflare / Komari 接入；Cloudflare 按具体主机名同步并清理旧地址。
- 服务发现预览与确认；内部端口未知时保持空值。
- 单口令认证、受控初始化、会话撤销、界面密钥加密存储。
- 服务端台账导出、在线数据库快照、桌面表格与移动卡片。

本版本是个人 CMDB 的资源核心版本。完整费用/续费系统、定时与持久任务中心、交互拓扑、文件导入和完整备份恢复界面仍待开发；不要将数据库快照当成包含图片和部署密钥的完整备份。当前上游同步仍是请求内执行，暂不能离开请求后查看持久任务进度。

## Docker 部署

```bash
# 仅新部署时复制模板；已有 .env 请保留并补充配置
cp -n .env.example .env
# 编辑 .env，至少配置 AUTH_PASSWORD 或 SETUP_TOKEN

docker compose up -d --build
docker compose logs -f domain-manage
```

- 默认监听 `127.0.0.1:3080`，由宿主机 nginx/其他反代提供 HTTPS。参考 [nginx.conf](nginx.conf)。镜像不含 nginx。
- 多阶段镜像使用 Node 24；构建阶段编译前后端与原生 SQLite 依赖，运行阶段只保留产物及生产依赖。
- 数据卷为 compose 的 `domain-data`，包含数据库、图片、迁移备份和数据库快照。已有部署保持同一 compose 项目名/卷即可沿用数据。
- 生产不再挂载 `./public`；修改前端后重新构建镜像。
- `/healthz` 只返回存活状态；资源、业务 API 与附件都需登录。
- 当前开发环境未安装 Docker，镜像构建与容器启动尚需在目标部署机验证；本机已验证应用构建和实际 API/页面。

### 环境变量

| 变量 | 用途 |
| --- | --- |
| `PANEL_PORT` | 宿主机本地端口，默认 3080 |
| `AUTH_PASSWORD` | 部署口令，优先于保存的口令；推荐至少 12 个字符 |
| `SETUP_TOKEN` | 无口令实例首次初始化凭证；不设置时生成数据目录内 setup-token 文件 |
| `CREDENTIAL_KEY` | 在界面保存连接器密钥时必填，64 位十六进制，单独安全保存 |
| `CF_API_TOKEN` | Cloudflare 只读 Token，优先于界面配置 |
| `KOMARI_URL` / `KOMARI_API_KEY` | Komari 来源地址与只读 Key，优先于界面配置 |
| `DATA_DIR` | 本机数据目录，默认 ./data；Docker 固定 /app/data |
| `HOST` / `PORT` | 应用监听地址/端口；compose 已配置容器内监听 |

需要界面保存密钥时，可用 `openssl rand -hex 32` 生成 CREDENTIAL_KEY 并写入 .env。不要将真实 .env 提交到仓库。备份数据卷不会备份该环境主密钥，丢失后需重新配置连接器。

首次没有配置 AUTH_PASSWORD 时，使用 SETUP_TOKEN 完成设置；若也未指定 SETUP_TOKEN，由本人在宿主机读取自动生成的凭证：

```bash
docker compose exec domain-manage cat /app/data/setup-token
```

忘记口令时，可在 .env 设置新的 AUTH_PASSWORD 后执行 `docker compose up -d --force-recreate`，原有会话随环境口令轮换失效。不要再通过删除旧 data.json 字段重置，正式数据已迁移到 SQLite。

## 从旧 demo 升级

1. 先停止旧应用，备份原数据卷与环境配置。不要运行历史版本的旧迁移脚本。
2. 在副本预检：把副本目录作为 DATA_DIR，运行 `npm run migrate`。默认只在临时目录执行，不修改输入。
3. 新版首次启动发现 data.json 且尚无迁移标记时，自动事务导入并保留原始 JSON、逐字节原始备份和 `backups/migration-report.json`。
4. 保留旧资源 ID、截图/封面引用和扩展字段；旧关系取并集，失效引用进入报告；旧 zone 汇总 IP 标注待核实。
5. 旧连接器密钥在配置 CREDENTIAL_KEY 时加密导入；未配置主密钥则跳过密钥并报告，需要改用环境变量或重新保存。原值仍在受保护的旧备份中。
6. 重复启动不会重复导入。已有 SQLite 正式记录但没有迁移标记时拒绝自动覆盖，需先检查副本。
7. 旧 JSON 不再写入。回滚旧版本必须使用迁移前数据卷快照；不能将新数据库交给旧版应用。

```bash
# 本机预检旧数据目录
DATA_DIR=/path/to/copied-data npm run migrate
# 明确应用到该目录
DATA_DIR=/path/to/copied-data npm run migrate -- --apply
# 生产镜像内可使用已编译的预检命令
# node dist/scripts/migrate.js
```

## 备份与恢复

界面“创建数据库快照”调用 SQLite 在线备份，保存在数据目录 backups/。它包含数据库内资源/关系/设置，不含图片文件和环境变量。界面“导出台账”是可读业务 JSON，也不含图片文件或连接器密钥。

完整卷备份应在暂停写入时包含数据库、附件及必要文件。示例（容器名保持默认 domain-manage）：

```bash
mkdir -p backups
docker compose stop domain-manage
docker run --rm --volumes-from domain-manage:ro -v "$PWD/backups:/backup" alpine \
  tar czf /backup/cmdb-data.tar.gz -C /app/data .
docker compose start domain-manage
```

环境配置与 CREDENTIAL_KEY 在卷外另行保护。恢复优先在新实例的空数据卷解包归档，恢复权限为容器 node 用户可读写，再挂载启动并校验资源、关系、附件和连接器；现有实例覆盖前先保存当前完整快照。当前尚无恢复向导，不提供默认覆盖正在使用的数据库的操作。

## 本地开发

Node >= 22.12；better-sqlite3 原生依赖在无预编译包的平台需要相应编译工具。

```bash
npm ci
npm run dev
# React：http://localhost:5173；API：http://localhost:3000

npm run typecheck
npm run build
npm start
# 构建后统一入口：http://localhost:3000
```

本地与 Docker 的数据目录是独立的；不要以本机 data/ 的内容推断 Docker 数据卷中的内容。验证数据修改时使用独立 DATA_DIR。

## 文档与维护

- [PRD.md](PRD.md)：完整目标、阶段与验收场景。
- [ARCHITECTURE.md](ARCHITECTURE.md)：已选择的 React/Docker 技术路线与实施状态。
- [DESIGN.md](DESIGN.md)：暗色控制台视觉规范。
- [AGENTS.md](AGENTS.md)：当前代码结构、真实命令与迁移规则。
- CLAUDE.md 为历史资料，部分内容已经过时。
