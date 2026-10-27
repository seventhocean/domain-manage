import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Database, Download, ShieldCheck } from "lucide-react";
import { useState } from "react";
import type { Resource } from "../../../../packages/contracts";
import { typeLabels } from "../../../../packages/contracts";
import { api, json, refresh } from "../api";
import { Feedback, PageHeader } from "../components/common";
import { ResourceIcon } from "../components/resource";
import { Button } from "../components/ui/button";
type SettingsData = {
  cf_api_token_set: boolean;
  cf_env_token: boolean;
  komari_api_key_set: boolean;
  komari_env_key: boolean;
  komari_url: string;
  komari_base_url: string;
  credential_storage_ready?: boolean;
  credential_unavailable?: boolean;
};
export function SettingsPage() {
  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: () => api<SettingsData>("/api/settings"),
  });
  const system = useQuery({
    queryKey: ["system"],
    queryFn: () =>
      api<{
        version: string;
        storage: string;
        schema_version: number;
        resources: number;
        migration: {
          counts: Record<string, number>;
          warnings: string[];
        } | null;
      }>("/api/cmdb/system"),
  });
  const trash = useQuery({
    queryKey: ["trash"],
    queryFn: () => api<Resource[]>("/api/cmdb/trash"),
  });
  const [token, setToken] = useState("");
  const [komariUrl, setKomariUrl] = useState("");
  const [komariKey, setKomariKey] = useState("");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState<Error | null>(null);
  const [busy, setBusy] = useState("");
  async function action(kind: string) {
    setBusy(kind);
    setError(null);
    setNotice("");
    try {
      if (kind === "cf") {
        if (!token.trim()) throw new Error("请输入 Token");
        await api("/api/settings", json("PUT", { cf_api_token: token.trim() }));
        setToken("");
        setNotice("Cloudflare 配置已保存。");
      }
      if (kind === "komari") {
        const payload: Record<string, string> = {};
        if (komariUrl.trim()) payload.komari_url = komariUrl.trim();
        if (komariKey.trim()) payload.komari_api_key = komariKey.trim();
        if (!Object.keys(payload).length)
          throw new Error("请填写地址或 API Key");
        await api("/api/settings", json("PUT", payload));
        setKomariKey("");
        setNotice("Komari 配置已保存。");
      }
      if (kind === "password") {
        await api("/api/auth/password", json("POST", { current, next }));
        setCurrent("");
        setNext("");
        setNotice("访问口令已更新，原有会话已撤销。");
      }
      if (kind === "backup") {
        const result = await api<{ name: string; note: string }>(
          "/api/cmdb/backups",
          json("POST"),
        );
        setNotice(`快照已创建：${result.name}。${result.note}`);
      }
      if (kind === "export") {
        const data = await api("/api/cmdb/export");
        const url = URL.createObjectURL(
          new Blob([JSON.stringify(data, null, 2)], {
            type: "application/json",
          }),
        );
        const link = document.createElement("a");
        link.href = url;
        link.download = `cmdb-${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setNotice("台账已导出；不包含图片文件、会话和连接器密钥。");
      }
      await refresh();
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusy("");
    }
  }
  const restore = useMutation({
    mutationFn: (id: string) =>
      api(`/api/cmdb/resources/${id}/restore`, json("POST")),
    onSuccess: () => refresh(),
  });
  return (
    <>
      <PageHeader
        eyebrow="个人空间设置"
        title="设置与数据"
        description="管理只读连接、访问口令和本地数据。"
      />
      <Feedback error={error || settings.error || restore.error} />
      {settings.data?.credential_unavailable && (
        <div className="error-box">
          已保存的连接密钥无法解密，请恢复原
          CREDENTIAL_KEY，或重新配置连接器。资源台账仍可使用。
        </div>
      )}
      {notice && (
        <div className="notice-box" role="status">
          <Check size={16} />
          {notice}
        </div>
      )}
      <div className="settings-grid">
        <section className="panel">
          <div className="panel-header">
            <h2>Cloudflare 连接</h2>
            <span className="type-tag">
              {settings.data?.cf_env_token
                ? "环境配置"
                : settings.data?.cf_api_token_set
                  ? "已保存"
                  : "未配置"}
            </span>
          </div>
          <div className="settings-body">
            <p className="muted">
              {settings.data?.credential_storage_ready
                ? "界面保存的密钥将加密存储。"
                : "建议使用 CF_API_TOKEN 环境变量。界面保存密钥需先配置 CREDENTIAL_KEY。"}
            </p>
            <label>
              API Token
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="不会回显已保存的 Token"
                autoComplete="off"
                disabled={settings.data?.cf_env_token}
              />
            </label>
            <Button
              variant="secondary"
              disabled={!!busy || settings.data?.cf_env_token}
              onClick={() => action("cf")}
            >
              保存 Token
            </Button>
          </div>
        </section>
        <section className="panel">
          <div className="panel-header">
            <h2>Komari 连接</h2>
            <span className="type-tag">
              {settings.data?.komari_env_key
                ? "环境配置"
                : settings.data?.komari_api_key_set
                  ? "已保存"
                  : "未配置"}
            </span>
          </div>
          <div className="settings-body">
            <label>
              来源地址
              <input
                value={komariUrl}
                onChange={(e) => setKomariUrl(e.target.value)}
                placeholder={settings.data?.komari_base_url || "https://…"}
              />
            </label>
            <label>
              API Key
              <input
                type="password"
                value={komariKey}
                onChange={(e) => setKomariKey(e.target.value)}
                placeholder="留空保留原 Key"
                autoComplete="off"
                disabled={settings.data?.komari_env_key}
              />
            </label>
            <Button
              variant="secondary"
              disabled={!!busy}
              onClick={() => action("komari")}
            >
              保存连接
            </Button>
          </div>
        </section>
        <section className="panel">
          <div className="panel-header">
            <h2>数据管理</h2>
            <Database size={16} />
          </div>
          <div className="settings-body">
            <dl className="system-values">
              <div>
                <dt>应用版本</dt>
                <dd>{system.data?.version || "读取中"}</dd>
              </div>
              <div>
                <dt>存储</dt>
                <dd>
                  {system.data?.storage || "读取中"} · schema{" "}
                  {system.data?.schema_version || "—"}
                </dd>
              </div>
              <div>
                <dt>资源数量</dt>
                <dd>{system.data?.resources ?? "—"}</dd>
              </div>
            </dl>
            <p className="muted">
              导出包含资源与关系；数据库快照单独保存在数据卷 backups
              目录。完整恢复还需要图片附件和部署环境配置。
            </p>
            <div className="page-actions">
              <Button
                variant="secondary"
                disabled={!!busy}
                onClick={() => action("export")}
              >
                <Download size={14} />
                导出台账
              </Button>
              <Button
                variant="secondary"
                disabled={!!busy}
                onClick={() => action("backup")}
              >
                {busy === "backup" ? "创建中…" : "创建数据库快照"}
              </Button>
            </div>
            {system.data?.migration && (
              <div className="inline-note">
                已从旧 JSON 迁移；原文件与迁移前备份保留。
                {system.data.migration.warnings.length > 0 &&
                  ` ${system.data.migration.warnings.length} 项关系需核对，详见迁移报告。`}
              </div>
            )}
          </div>
        </section>
        <section className="panel">
          <div className="panel-header">
            <h2>访问口令</h2>
            <ShieldCheck size={16} />
          </div>
          <form
            className="settings-body"
            onSubmit={(e) => {
              e.preventDefault();
              action("password");
            }}
          >
            <label>
              当前口令
              <input
                type="password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            <label>
              新口令
              <input
                type="password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                minLength={12}
                maxLength={1024}
                placeholder="至少 12 个字符"
                autoComplete="new-password"
                required
              />
            </label>
            <Button type="submit" variant="secondary" disabled={!!busy}>
              更新口令
            </Button>
            <small className="muted">
              若使用 AUTH_PASSWORD 环境变量，请在部署配置中轮换口令。
            </small>
          </form>
        </section>
      </div>
      <section className="panel">
        <div className="panel-header">
          <h2>回收站</h2>
          <span className="muted">关联保留，可恢复</span>
        </div>
        {trash.data?.length ? (
          <div className="simple-rows">
            {trash.data.map((r) => (
              <div className="simple-row" key={r.id}>
                <ResourceIcon type={r.type} />
                <div>
                  {r.name}
                  <small>{typeLabels[r.type]}</small>
                </div>
                <Button
                  variant="secondary"
                  disabled={restore.isPending}
                  onClick={() => restore.mutate(r.id)}
                >
                  恢复资源
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="panel-padding muted">回收站为空。</p>
        )}
      </section>
    </>
  );
}
