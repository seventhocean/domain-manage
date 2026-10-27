import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Boxes,
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  Globe2,
  HardDrive,
  Image as ImageIcon,
  KeyRound,
  Layers,
  Link as LinkIcon,
  Loader2,
  Plus,
  Server,
  Sparkles,
  Trash2,
  Upload,
  User,
  Zap,
} from "lucide-react";
import React, { useRef, useState } from "react";
import {
  primaryResourceTypes,
  typeLabels,
  type Resource,
  type ResourceInput,
  type ResourceType,
} from "../../../../../packages/contracts";
import { api, json, refresh } from "../../api";
import { TagBadge } from "../../components/resource";
import { Button } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";

export const detailFields: Record<
  ResourceType,
  { key: string; label: string; placeholder?: string }[]
> = {
  domain: [
    { key: "domain", label: "完整域名", placeholder: "app.example.com" },
    { key: "registrar", label: "注册商" },
    { key: "expiry_date", label: "注册到期日", placeholder: "2027-10-27" },
  ],
  host: [
    { key: "ip", label: "IP 地址", placeholder: "例如 124.225.10.88" },
    { key: "price", label: "费用周期", placeholder: "例如 ¥38/年、$66/月" },
    { key: "provider", label: "供应商", placeholder: "DMIT、瓦工、腾讯云等" },
    { key: "region", label: "地区", placeholder: "香港 CN2、美西等" },
  ],
  service: [
    { key: "domain", label: "绑定域名", placeholder: "pan.waitwinter.eu.cc" },
    { key: "port", label: "内部端口", placeholder: "8080" },
    { key: "container", label: "容器名" },
  ],
  database: [
    { key: "engine", label: "数据库引擎", placeholder: "PostgreSQL / MySQL / Redis" },
    { key: "address", label: "连接主机名或 IP" },
    { key: "port", label: "端口" },
  ],
  storage: [
    { key: "storage_type", label: "存储类型" },
    { key: "identifier", label: "桶 / 卷 / 空间标识" },
  ],
  cloud: [
    { key: "subtype", label: "资源类型" },
    { key: "provider", label: "供应商" },
  ],
  subscription: [
    { key: "price", label: "费用与额度", placeholder: "例如 $20/月、100万 Token" },
    { key: "provider", label: "服务平台", placeholder: "冬天AI商店、OpenAI" },
    { key: "plan", label: "套餐" },
  ],
  account: [
    { key: "provider", label: "所属平台", placeholder: "小红书、抖音、推特" },
    { key: "login_identifier", label: "账号标识", placeholder: "用户名/手机号" },
  ],
  other: [
    { key: "subtype", label: "资源子类型" },
    { key: "identifier", label: "资源标识" },
  ],
};

const categoryIcons: Record<string, React.ComponentType<{ size?: number }>> = {
  service: Zap,
  host: Server,
  domain: Globe2,
  subscription: KeyRound,
  account: User,
};

const PRESET_TAGS: Record<ResourceType, string[]> = {
  host: ["建站", "代理", "主力机", "国内", "香港", "美西", "高防", "闲置"],
  domain: ["主域名", "博客", "API入口", "个人看板", "商业", "闲置"],
  service: ["常用", "监控", "AI工具", "个人网盘", "媒体影音", "自动化"],
  account: ["自媒体", "生活分享", "极客论坛", "开源开发", "社交", "全球资讯"],
  subscription: ["大模型", "商用 API", "按量扣费", "生产力会员", "年度订阅"],
  database: ["生产库", "缓存", "从库"],
  storage: ["对象存储", "备份", "网盘"],
  cloud: ["云厂商", "边缘节点"],
  other: ["常用"],
};

const PLATFORM_PRESETS = [
  { name: "小红书", url: "https://www.xiaohongshu.com", tags: ["生活分享", "自媒体"] },
  { name: "抖音", url: "https://www.douyin.com", tags: ["短视频", "自媒体"] },
  { name: "推特/X", url: "https://x.com", tags: ["全球资讯", "社交"] },
  { name: "NodeSeek", url: "https://www.nodeseek.com", tags: ["极客论坛", "VPS"] },
  { name: "GitHub", url: "https://github.com", tags: ["开源开发", "极客论坛"] },
  { name: "Bilibili", url: "https://www.bilibili.com", tags: ["媒体影音", "自媒体"] },
];

export function ResourceForm({
  resource,
  initialType = "service",
  onClose,
  onSaved,
}: {
  resource?: Resource;
  initialType?: ResourceType;
  onClose: () => void;
  onSaved: (resource: Resource) => void;
}) {
  const [type, setType] = useState<ResourceType>(resource?.type || initialType);
  const [name, setName] = useState(resource?.name || "");
  const [address, setAddress] = useState(
    resource?.management_url ||
      String(resource?.details?.ip || resource?.details?.domain || ""),
  );
  const [purpose, setPurpose] = useState(resource?.purpose || "");
  const [price, setPrice] = useState(String(resource?.details?.price || ""));
  const [specs, setSpecs] = useState(
    String(
      resource?.details?.specs ||
        (resource?.notes ? resource.notes.split("·")[1]?.trim() : "") ||
        resource?.details?.provider ||
        "",
    ),
  );
  const [coverImage, setCoverImage] = useState(
    String(resource?.details?.cover_image || ""),
  );
  const [tags, setTags] = useState<string[]>(resource?.tags || []);
  const [customTag, setCustomTag] = useState("");
  const [notes, setNotes] = useState(resource?.notes || "");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const save = useMutation({
    mutationFn: (data: ResourceInput) =>
      api<Resource>(
        resource ? `/api/cmdb/resources/${resource.id}` : "/api/cmdb/resources",
        json(
          resource ? "PUT" : "POST",
          resource ? { ...data, revision: resource.revision } : data,
        ),
      ),
    onSuccess: async (value) => {
      await refresh();
      onSaved(value);
    },
    onError: (err) => {
      setErrorMessage(err.message || "保存失败，请检查填写内容");
    },
  });

  // Handle uploading an image file
  const handleUploadFile = async (file: File) => {
    setUploading(true);
    setErrorMessage("");
    try {
      const formData = new FormData();
      formData.append("file", file, file.name);
      const res = await fetch("/api/cmdb/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error || "上传图片失败");
      }
      setCoverImage(data.url);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "图片上传失败";
      setErrorMessage(message);
    } finally {
      setUploading(false);
    }
  };

  // Handle Clipboard Paste (⌘V / Ctrl+V anywhere in modal)
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          handleUploadFile(file);
          break;
        }
      }
    }
  };

  const toggleTag = (tag: string) => {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const handleAddCustomTag = () => {
    const t = customTag.trim();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
      setCustomTag("");
    }
  };

  const currentPresets = PRESET_TAGS[type] || [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage("请填写资源或服务名称");
      return;
    }

    let safeManagementUrl = "";
    const cleanAddr = address.trim();

    if (cleanAddr.startsWith("http://") || cleanAddr.startsWith("https://")) {
      safeManagementUrl = cleanAddr;
    } else if (type === "service" || type === "domain" || type === "account") {
      if (cleanAddr && !cleanAddr.includes(" ")) {
        safeManagementUrl = `https://${cleanAddr}`;
      }
    }

    const details: Record<string, unknown> = {
      ...(resource?.details || {}),
      price: price.trim() || undefined,
      cover_image: coverImage || undefined,
      specs: specs.trim() || undefined,
    };

    if (type === "host") {
      details.ip = cleanAddr;
      if (specs.trim()) details.provider = specs.trim();
    } else if (type === "domain") {
      details.domain = cleanAddr;
    } else if (type === "service") {
      details.domain = cleanAddr;
    }

    const finalNotes = notes.trim() || (specs.trim() ? `配置: ${specs.trim()}` : "");

    const payload: ResourceInput = {
      type,
      name: name.trim(),
      purpose: purpose.trim(),
      lifecycle: resource?.lifecycle || "active",
      notes: finalNotes,
      tags,
      management_url: safeManagementUrl,
      project_ids: resource?.project_ids || [],
      details,
    };

    save.mutate(payload);
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={resource ? "编辑数字资产" : "收纳新资产"}
      description="快速归集并管理你的 VPS、域名、自建服务、API 与社交平台"
    >
      <form onSubmit={handleSubmit} onPaste={handlePaste} className="space-y-4">
        {errorMessage && (
          <div className="p-2.5 text-xs rounded-lg bg-red-950/60 border border-red-500/30 text-red-300">
            {errorMessage}
          </div>
        )}

        {/* 1. 五大资产类型分段选项卡 */}
        {!resource && (
          <div>
            <label className="block text-[11px] text-muted mb-2 font-medium">
              资产分类
            </label>
            <div className="grid grid-cols-5 gap-2 bg-[#0A0C11] p-1.5 rounded-xl border border-white/5">
              {primaryResourceTypes.map((catKey) => {
                const Icon = categoryIcons[catKey] || Boxes;
                const active = type === catKey;
                return (
                  <button
                    key={catKey}
                    type="button"
                    onClick={() => {
                      setType(catKey);
                      setErrorMessage("");
                    }}
                    className={`flex flex-col items-center justify-center py-2.5 px-1 rounded-lg text-xs transition-all ${
                      active
                        ? "bg-[#F6821F] text-white font-semibold shadow-md shadow-orange-950/40"
                        : "text-[#8B8F99] hover:text-[#F5F6F7] hover:bg-white/[0.04]"
                    }`}
                  >
                    <Icon size={17} />
                    <span className="mt-1.5 text-[11px] truncate max-w-full">
                      {typeLabels[catKey].split(" ")[0]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 常用平台快捷预设条 */}
        {type === "account" && !resource && (
          <div className="p-2.5 rounded-lg bg-[#0F1118] border border-white/5">
            <span className="text-[11px] text-muted block mb-1.5 font-medium">
              快捷填入常用平台：
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {PLATFORM_PRESETS.map((p) => (
                <button
                  type="button"
                  key={p.name}
                  onClick={() => {
                    setName(p.name);
                    setAddress(p.url);
                    setTags((prev) => Array.from(new Set([...prev, ...p.tags])));
                  }}
                  className="text-[11px] px-2.5 py-1 rounded-md bg-white/[0.04] text-slate-300 hover:text-white hover:bg-white/[0.08] border border-white/5 transition-colors"
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 2. 上下文自适应核心表单区 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] text-muted mb-1 font-medium">
              {type === "host"
                ? "主机名称"
                : type === "domain"
                  ? "完整域名"
                  : type === "service"
                    ? "服务名称"
                    : type === "account"
                      ? "平台/账号名称"
                      : "订阅名称"}{" "}
              <span className="text-[#F6821F]">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                type === "host"
                  ? "例如：Wawo-HK、炭云美西"
                  : type === "domain"
                    ? "例如：waitwinter.eu.cc"
                    : type === "service"
                      ? "例如：冬天 AI 商店、Komari 探针"
                      : type === "account"
                        ? "例如：小红书、推特/X"
                        : "例如：Winter AI API、Claude Pro"
              }
              className="w-full h-9 px-3 text-xs bg-[#0F1118] border border-white/10 rounded-lg text-ink focus:border-[#F6821F] focus:outline-none"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-[11px] text-muted mb-1 font-medium">
              {type === "host"
                ? "公网 IP 地址"
                : type === "domain"
                  ? "解析指向 (IP / CNAME)"
                  : type === "service"
                    ? "访问链接 / 域名"
                    : type === "account"
                      ? "主页链接 / 用户名"
                      : "API 接口地址 / 控制台 URL"}
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={
                type === "host"
                  ? "例如：2.27.109.59"
                  : type === "domain"
                    ? "例如：156.245.245.200"
                    : "例如：https://winters.eu.cc"
              }
              className="w-full h-9 px-3 text-xs bg-[#0F1118] border border-white/10 rounded-lg text-ink font-mono focus:border-[#F6821F] focus:outline-none"
            />
          </div>
        </div>

        {/* 费用与辅助配置信息 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] text-muted mb-1 font-medium">
              费用周期 (直显在卡片角标)
            </label>
            <input
              type="text"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="例如：¥38/年、$66/月、免费"
              className="w-full h-9 px-3 text-xs bg-[#0F1118] border border-white/10 rounded-lg text-ink font-mono focus:border-[#F6821F] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] text-muted mb-1 font-medium">
              {type === "host"
                ? "硬件配置 / 地区备注"
                : type === "domain"
                  ? "DNS 托管商"
                  : type === "service"
                    ? "关联宿主机"
                    : type === "account"
                      ? "账号唯一标识 / UID"
                      : "额度 / 套餐信息"}
            </label>
            <input
              type="text"
              value={specs}
              onChange={(e) => setSpecs(e.target.value)}
              placeholder={
                type === "host"
                  ? "例如：Xeon E3 · 1C 0.5G · 香港 CN2"
                  : type === "domain"
                    ? "例如：Cloudflare DNS"
                    : type === "service"
                      ? "例如：TYyun-HK"
                      : "例如：100万 Token/月"
              }
              className="w-full h-9 px-3 text-xs bg-[#0F1118] border border-white/10 rounded-lg text-ink focus:border-[#F6821F] focus:outline-none"
            />
          </div>
        </div>

        {/* 3. 标签选择与高亮系统 */}
        <div className="p-3 rounded-xl bg-[#0F1118] border border-white/5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted font-medium">
              分类高亮标签（点击一键选中）
            </span>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    handleAddCustomTag();
                  }
                }}
                placeholder="+ 自定义标签"
                className="h-6 px-2 text-[10.5px] bg-[#161823] border border-white/10 rounded text-ink focus:border-[#F6821F] focus:outline-none w-28"
              />
              {customTag.trim() && (
                <button
                  type="button"
                  onClick={handleAddCustomTag}
                  className="text-[10px] px-2 py-0.5 rounded bg-[#F6821F] text-white"
                >
                  添加
                </button>
              )}
            </div>
          </div>

          {/* 预设标签池（带高亮选中态） */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {currentPresets.map((t) => {
              const active = tags.includes(t);
              return (
                <TagBadge
                  key={t}
                  tag={t}
                  active={active}
                  onClick={() => toggleTag(t)}
                />
              );
            })}
            {/* 用户新加的非预设标签 */}
            {tags
              .filter((t) => !currentPresets.includes(t))
              .map((t) => (
                <TagBadge
                  key={t}
                  tag={t}
                  active
                  onRemove={() => toggleTag(t)}
                />
              ))}
          </div>
        </div>

        {/* 4. 视觉封面（支持直接按 ⌘V 粘贴截屏） */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[11px] text-muted font-medium flex items-center gap-1.5">
              <Camera size={13} className="text-[#F6821F]" />
              <span>视觉封面（支持直接截图按 ⌘V 粘贴）</span>
            </label>
            {coverImage && (
              <button
                type="button"
                onClick={() => setCoverImage("")}
                className="text-[10.5px] text-red-400 hover:underline flex items-center gap-1"
              >
                <Trash2 size={11} /> 移除封面
              </button>
            )}
          </div>

          {coverImage ? (
            <div className="relative h-28 w-full rounded-xl overflow-hidden border border-white/10 bg-[#0A0C11] group">
              <img
                src={coverImage}
                alt="封面预览"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1 rounded-md text-xs bg-white/20 text-white hover:bg-white/30 backdrop-blur-md"
                >
                  更换图片
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="h-20 w-full rounded-xl border border-dashed border-white/15 hover:border-[#F6821F]/60 bg-[#0F1118]/60 hover:bg-[#141722] transition-all flex flex-col items-center justify-center cursor-pointer p-3 text-center group"
            >
              {uploading ? (
                <div className="flex items-center gap-2 text-xs text-[#F6821F]">
                  <Loader2 size={16} className="animate-spin" />
                  <span>正在上传截图封面...</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-1.5 text-slate-300 text-xs font-medium mb-1 group-hover:text-white">
                    <Sparkles size={13} className="text-[#F6821F]" />
                    <span>截屏后在此按 ⌘V 粘贴截图，或点击选择图片</span>
                  </div>
                  <span className="text-[10px] text-muted">
                    无需上传图床，直接粘贴剪贴板图片即可设为封面
                  </span>
                </>
              )}
            </div>
          )}

          {/* 绝对隐藏的原生 input，防止浏览器破相 */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUploadFile(file);
            }}
          />
        </div>

        {/* 5. 一句话用途描述 */}
        <div>
          <label className="block text-[11px] text-muted mb-1 font-medium">
            一句话用途 / 备注说明
          </label>
          <input
            type="text"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="例如：个人核心网盘、主力建站节点、每日自媒体运营账号"
            className="w-full h-8 px-3 text-xs bg-[#0F1118] border border-white/10 rounded-lg text-ink focus:border-[#F6821F] focus:outline-none"
          />
        </div>

        {/* 6. 高级选项折叠 */}
        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-[11px] text-muted hover:text-ink flex items-center gap-1 py-1"
          >
            {showAdvanced ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            <span>
              {showAdvanced ? "收起长备注" : "展开高级设置（配置命令、长备忘）"}
            </span>
          </button>

          {showAdvanced && (
            <div className="mt-2 space-y-2 pt-2 border-t border-white/5">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="记录购买时间、续费提醒、SSH 命令、Token 密钥等..."
                rows={3}
                className="w-full p-2.5 text-xs bg-[#0F1118] border border-white/10 rounded-lg text-ink focus:border-[#F6821F] focus:outline-none"
              />
            </div>
          )}
        </div>

        {/* 7. 操作按钮 */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
          <Button type="button" variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button
            type="submit"
            disabled={save.isPending}
            className="bg-[#F6821F] hover:bg-[#FA8C16] text-white font-medium px-5"
          >
            {save.isPending ? "保存中..." : resource ? "保存修改" : "立即创建"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
