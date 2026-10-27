import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import {
  lifecycleLabels,
  resourceInputSchema,
  resourceTypes,
  typeLabels,
  type Project,
  type Resource,
  type ResourceInput,
  type ResourceType,
} from "../../../../../packages/contracts";
import { api, json, refresh } from "../../api";
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
    { key: "ip", label: "IP 地址", placeholder: "多个 IPv4 / IPv6 用逗号分隔" },
    { key: "provider", label: "供应商" },
    { key: "region", label: "地区" },
    { key: "ssh_port", label: "SSH 端口", placeholder: "22" },
  ],
  service: [
    { key: "repository", label: "代码仓库" },
    { key: "kind", label: "服务类型", placeholder: "网站 / API / 自动化服务" },
  ],
  database: [
    {
      key: "engine",
      label: "数据库引擎",
      placeholder: "PostgreSQL / MySQL / Redis",
    },
    { key: "address", label: "连接主机名或 IP" },
    { key: "port", label: "端口" },
    { key: "backup_notes", label: "备份说明" },
  ],
  storage: [
    {
      key: "storage_type",
      label: "存储类型",
      placeholder: "对象存储 / 持久化卷 / 网盘",
    },
    { key: "identifier", label: "桶 / 卷 / 空间标识" },
    { key: "region", label: "区域" },
    { key: "backup_notes", label: "备份说明" },
  ],
  cloud: [
    {
      key: "subtype",
      label: "资源类型",
      placeholder: "PaaS / CDN / 队列 / 邮件服务",
    },
    { key: "provider", label: "供应商" },
    { key: "region", label: "区域" },
    { key: "external_id", label: "平台资源标识" },
  ],
  subscription: [
    { key: "provider", label: "服务平台" },
    { key: "plan", label: "套餐" },
    { key: "quota", label: "额度记录", placeholder: "请写明单位和观察日期" },
  ],
  account: [
    { key: "provider", label: "所属平台" },
    {
      key: "login_identifier",
      label: "登录标识",
      placeholder: "邮箱或账号别名",
    },
    {
      key: "credential_ref",
      label: "凭据引用",
      placeholder: "密码管理器条目名称；不要填写密码",
    },
  ],
  other: [
    { key: "subtype", label: "资源子类型" },
    { key: "identifier", label: "资源标识" },
  ],
};
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
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => api<Project[]>("/api/cmdb/projects"),
  });
  const [tagText, setTagText] = useState(resource?.tags.join(", ") || "");
  const form = useForm<ResourceInput>({
    resolver: zodResolver(resourceInputSchema) as Resolver<ResourceInput>,
    defaultValues: resource
      ? {
          type: resource.type,
          name: resource.name,
          purpose: resource.purpose,
          lifecycle: resource.lifecycle,
          notes: resource.notes,
          tags: resource.tags,
          management_url: resource.management_url,
          project_ids: resource.project_ids,
          details: resource.details,
        }
      : {
          type: initialType,
          name: "",
          purpose: "",
          lifecycle: "active",
          notes: "",
          tags: [],
          management_url: "",
          project_ids: [],
          details: {},
        },
  });
  const type = form.watch("type");
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
  });
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (
          !open &&
          (!form.formState.isDirty ||
            window.confirm("有未保存内容，确定关闭吗？"))
        )
          onClose();
      }}
      title={resource ? "编辑资源" : "添加资源"}
      description="先记下资源，再补充用途、项目与关联。资源标识与关系会独立维护。"
    >
      <form
        onSubmit={form.handleSubmit((data) =>
          save.mutate({
            ...data,
            tags: tagText
              .split(/[,，]/)
              .map((v) => v.trim())
              .filter(Boolean),
          }),
        )}
        className="resource-form"
      >
        <div className="form-scroll">
          <div className="field-grid">
            <label>
              资源类型
              <select {...form.register("type")} disabled={!!resource}>
                {resourceTypes.map((t) => (
                  <option key={t} value={t}>
                    {typeLabels[t]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              生命周期
              <select {...form.register("lifecycle")}>
                {Object.entries(lifecycleLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            资源名称 <span className="required">*</span>
            <input
              autoFocus
              {...form.register("name")}
              placeholder="用一个能认出来的名字，例如：个人博客"
            />
            {form.formState.errors.name && (
              <small className="error-text">
                {form.formState.errors.name.message}
              </small>
            )}
          </label>
          <label>
            用途
            <input
              {...form.register("purpose")}
              placeholder="这个资源用来做什么"
            />
          </label>
          <div className="form-section-label">{typeLabels[type]}信息</div>
          <div className="field-grid">
            {detailFields[type].map((field) => (
              <label key={`${type}:${field.key}`}>
                {field.label}
                <input
                  {...form.register(`details.${field.key}`)}
                  placeholder={field.placeholder}
                />
              </label>
            ))}
          </div>
          <label>
            管理后台
            <input
              {...form.register("management_url")}
              placeholder="https://…"
            />
            {form.formState.errors.management_url && (
              <small className="error-text">
                {form.formState.errors.management_url.message}
              </small>
            )}
          </label>
          <label>
            所属项目
            <div className="project-checkboxes">
              {projects.length ? (
                projects.map((p) => (
                  <label key={p.id} className="checkbox-label">
                    <input
                      type="checkbox"
                      value={p.id}
                      {...form.register("project_ids")}
                    />
                    {p.name}
                  </label>
                ))
              ) : (
                <span className="muted">还没有项目，可稍后在项目页创建。</span>
              )}
            </div>
          </label>
          <label>
            标签
            <input
              value={tagText}
              onChange={(e) => {
                setTagText(e.target.value);
                form.setValue("tags", [], { shouldDirty: true });
              }}
              placeholder="用逗号分隔，例如：生产环境, 个人项目"
            />
          </label>
          <label>
            备注
            <textarea
              rows={3}
              {...form.register("notes")}
              placeholder="记录使用说明；请勿填写口令或密钥"
            />
          </label>
          {Object.entries(form.formState.errors)
            .filter(([key]) => !["name", "management_url"].includes(key))
            .map(([key, value]) => (
              <p className="error-text" key={key}>
                {String(value.message || "请检查输入格式")}
              </p>
            ))}
          {save.error && (
            <div className="error-box" role="alert">
              {save.error.message}
              {"status" in save.error && save.error.status === 409 && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    refresh();
                    onClose();
                  }}
                >
                  重新加载
                </Button>
              )}
            </div>
          )}
        </div>
        <div className="dialog-footer">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              if (!form.formState.isDirty || window.confirm("放弃未保存内容？"))
                onClose();
            }}
          >
            取消
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? "保存中…" : "保存资源"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
