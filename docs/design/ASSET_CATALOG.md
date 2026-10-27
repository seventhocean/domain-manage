# 素材规划与视觉资产清单

版本：1.0 · 日期：2026-10-27

本文档记录个人 CMDB（domain-manage）的视觉资产规划、规格要求、生成提示词规范及文件路径。

---

## 1. 设计标准与风格准则

为保证所有素材在暗黑控制台环境（背景 `#0A0A0B`，主调表面 `#16161A`，点睛色 `#6C5CE7`）中呈现克制、高级、统一的质感，所有生成的视觉素材必须遵循以下准则：

1. **真实透明通道 (Alpha Channel)**：所有素材生成必须为真正的透明背景 PNG（RGBA），禁止黑白底贴图或伪透明棋盘格。
2. **建筑陶瓷等距质感 (Maquette Isometric)**：精致微缩的建筑模型质感，硬朗几何结构、轻微圆角、哑光磨砂材质，杜绝廉价塑料玩具感或过于写实刺眼的高光。
3. **极简低饱和调色**：
   - 冷象牙白（Cool Ivory）模块主体
   - 深石墨灰（Graphite `#16161A`）阴影与侧面
   - 适度克制的靛紫色（`#6C5CE7`）作为能量槽、连线或点睛高光
4. **负向约束**：严禁画面出现任何真实文字、数字、第三方未经授权的品牌 Logo、真人形象、高饱和霓虹光污染或地面大阴影。

---

## 2. 场景默认封面素材清单 (Card Covers)

当服务或机器未上传自定义截图/封面时，采用以下预设场景封面：
- **存储路径**：`apps/web/public/art/`
- **尺寸规格**：720 × 400（16:9）或 600 × 600（1:1）

| 编号 | 文件名 | 适用分类 | 描述与用途 |
| :--- | :--- | :--- | :--- |
| **C1** | `cover-network-v1.png` | 网络与网关 | 适用于 OpenWrt、Nginx、Cloudflare、Clash 等网络服务 |
| **C2** | `cover-storage-v1.png` | 存储与数据 | 适用于 Nextcloud、Alist、MinIO、MySQL、Postgres 等数据服务 |
| **C3** | `cover-media-v1.png` | 影音与娱乐 | 适用于 Jellyfin、Plex、Immich、Navidrome 等多媒体服务 |
| **C4** | `cover-ops-v1.png` | 运维与系统 | 适用于 Komari、Portainer、青龙、宝塔、Docker 等运维面板 |

### 场景封面 Prompt 模板

#### C1: 网络与网关 (`cover-network-v1.png`)
```text
Use case: stylized-product-illustration
Asset type: a reusable concept card cover for network, gateway and router resources in a personal CMDB web application, on a genuinely transparent background.
Subject: an isometric miniature architectural routing node — a sleek dark graphite hexagonal pedestal with floating ivory circular gateway rings and two fine glowing indigo-violet #6C5CE7 fiber bridge lines linking compact modular relay blocks.
Style: refined architectural paper-and-ceramic maquette, precise isometric 3D geometry, subtle tactile matte surfaces, crisp silhouette, restrained editorial aesthetic.
Composition: centered cluster, 3/4 isometric angle, plenty of transparent margin, readable down to 240px wide.
Color palette: cool ivory modules, deep graphite #16161A, limited indigo-violet #6C5CE7 accents, designed for a near-black #0A0A0B dark theme.
Lighting: soft neutral studio lighting, subtle ambient occlusion, no background glow.
Constraints: actual alpha transparency; no text, numbers, letters, logos, UI frames, people, watermarks, ground plane.
```

#### C2: 存储与数据 (`cover-storage-v1.png`)
```text
Use case: stylized-product-illustration
Asset type: a reusable concept card cover for storage, cloud drive, and database resources in a personal CMDB web application, on a genuinely transparent background.
Subject: an isometric miniature storage repository — three stacked cool ivory cylindrical data tiers with precision cartridge slots neatly seated in a compact dark graphite chassis, with subtle indigo-violet #6C5CE7 status indicators.
Style: refined architectural paper-and-ceramic maquette, precise isometric 3D geometry, subtle tactile matte surfaces, crisp silhouette, restrained editorial aesthetic.
Composition: centered cluster, 3/4 isometric angle, generous transparent padding, fully visible silhouette.
Color palette: cool ivory, dark graphite #16161A, restrained indigo-violet #6C5CE7.
Lighting: soft neutral studio light, clean ambient shadows, no harsh glare.
Constraints: actual alpha transparency; no text, numbers, letters, logos, people, watermarks, ground plane.
```

#### C3: 影音与娱乐 (`cover-media-v1.png`)
```text
Use case: stylized-product-illustration
Asset type: a reusable concept card cover for media, streaming, photo, and music server resources in a personal CMDB web application, on a genuinely transparent background.
Subject: an isometric miniature media studio module — a central ivory cubic prism with a stepped optical lens geometry, flanked by small dark graphite waveform blocks and a delicate circular violet disc (#6C5CE7).
Style: refined architectural paper-and-ceramic maquette, precise isometric 3D geometry, subtle tactile matte surfaces, crisp silhouette, restrained editorial aesthetic.
Composition: centered cluster, 3/4 isometric view, ample transparent padding.
Color palette: cool ivory, graphite #16161A, quiet indigo-violet #6C5CE7 accents.
Lighting: soft studio lighting, delicate edge definition, no neon or bloom.
Constraints: actual alpha transparency; no text, numbers, logos, people, watermarks, ground plane.
```

#### C4: 运维与系统 (`cover-ops-v1.png`)
```text
Use case: stylized-product-illustration
Asset type: a reusable concept card cover for operations, server management, monitor, and container tools in a personal CMDB web application, on a genuinely transparent background.
Subject: an isometric miniature server rack cluster — two clean ivory modular blade server bays with precision front vents and a compact graphite monitoring console block with quiet indigo-violet #6C5CE7 connection pins.
Style: refined architectural paper-and-ceramic maquette, precise isometric 3D geometry, subtle tactile matte surfaces, crisp silhouette, restrained editorial aesthetic.
Composition: centered cluster, 3/4 isometric angle, clean silhouette with generous transparent padding.
Color palette: cool ivory, deep graphite #16161A, restrained indigo-violet #6C5CE7.
Lighting: soft neutral lighting, ambient occlusion, crisp borders.
Constraints: actual alpha transparency; no text, numbers, logos, UI frames, people, watermarks, ground plane.
```

---

## 3. 状态与空状态插画 (Empty States & Guides)

- **存储路径**：`apps/web/public/art/`
- **尺寸规格**：约 600 × 600（1:1）

| 编号 | 文件名 | 状态 | 适用场景 | 描述 |
| :--- | :--- | :--- | :--- | :--- |
| **E1** | `resource-workspace-v1.png` | 已就绪 | 资源页/概览空状态 | 三合一资产积木托盘（服务器+存储+域名圆环） |
| **E2** | `connect-source-v1.png` | 已就绪 | 外部连接空状态 | 数据源模块通过紫色桥梁连入工作区 |
| **E3** | `art-empty-search-v1.png` | 规划中 | 搜索无结果 | 半开的极简档案屉与漂浮的悬空透镜环 |
| **E4** | `art-server-node-v1.png` | 规划中 | 主机列表头部/空状态 | 单体高密度刀片节点与插槽托盘 |

---

## 4. 自建服务高清小图标规范 (Service Icons)

在卡片、行列表等小尺寸场景（16–28px），不采用 AI 生成的位图，而使用以下三级梯队：

1. **真实 Favicon**：通过后端探针抓取的真实站点图标缓存（`/data/icons/{domain}.png` 或 `/api/cmdb/icons/{id}`）。
2. **内置自建应用 SVG 映射**：根据名称或探针指纹命中内置 SVG（Nextcloud, Vaultwarden, Komari, Docker, 青龙, 宝塔, Alist, Jellyfin, Home Assistant, Gitea, Nginx, OpenWrt 等）。
3. **首字母单色徽章 (Monogram)**：依据服务名称哈希计算确定的饱和度适中的品牌色背景与居中大写字母，确保任意两个未收录的服务视觉上有明确区分。
