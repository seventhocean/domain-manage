import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Check,
  Cloud,
  LoaderCircle,
  RefreshCw,
  Server,
  Settings,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import type { Resource } from "../../../../packages/contracts";
import { api, json, refresh } from "../api";
import { Feedback, PageHeader } from "../components/common";
import { Button } from "../components/ui/button";
type SettingsData = {
  cf_api_token_set: boolean;
  cf_env_token: boolean;
  komari_api_key_set: boolean;
  komari_env_key: boolean;
  komari_url: string;
  komari_base_url: string;
  credential_storage_ready?: boolean;
};
type Candidate = {
  domain_id: string;
  domain: string;
  server_id: string;
  server_name: string;
  name: string;
  probe: {
    ok: boolean;
    status: number | null;
    scheme: string;
    kind: string;
    title: string;
    placeholder: boolean;
    tls_invalid: boolean;
    error: string | null;
  };
};
export function Integrations() {
  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: () => api<SettingsData>("/api/settings"),
  });
  const [message, setMessage] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [action, setAction] = useState("");
  const [error, setError] = useState<Error | null>(null);
  async function run(kind: string) {
    setAction(kind);
    setError(null);
    setMessage("");
    try {
      if (kind === "cf") {
        const result = await api<{
          added: number;
          updated: number;
          failures: { zone: string; error: string }[];
        }>("/api/cf/sync", json("POST"));
        setMessage(
          `新增 ${result.added} 个域名，更新 ${result.updated} 个${result.failures.length ? `；${result.failures.length} 个区域失败，旧记录已保留` : ""}`,
        );
      }
      if (kind === "komari") {
        const result = await api<{
          created: number;
          linked: number;
          fallback_reason: string | null;
        }>("/api/komari/import", json("POST"));
        setMessage(
          `新增 ${result.created} 台主机，关联 ${result.linked} 台${result.fallback_reason ? "；当前使用降级数据" : ""}`,
        );
      }
      if (kind === "probe") {
        const result = await api<{ total: number; ok: number }>(
          "/api/domains/probe",
          json("POST"),
        );
        setMessage(
          `已检查 ${result.total} 个域名，${result.ok} 个收到响应；有响应不等于服务健康。`,
        );
      }
      if (kind === "discover") {
        const result = await api<{ candidates: Candidate[] }>(
          "/api/services/discover",
          json("POST"),
        );
        setCandidates(result.candidates);
        setMessage(
          `发现 ${result.candidates.length} 个候选，检查结果后再确认入库。`,
        );
      }
      await refresh();
    } catch (e) {
      setError(e as Error);
    } finally {
      setAction("");
    }
  }
  const accept = useMutation({
    mutationFn: (candidate: Candidate) =>
      api<Resource>(
        "/api/cmdb/discovery/accept",
        json("POST", {
          domain_id: candidate.domain_id,
          server_id: candidate.server_id,
          name: candidate.name,
        }),
      ),
    onSuccess: async (_r, c) => {
      setCandidates((v) => v.filter((x) => x.domain_id !== c.domain_id));
      setMessage(`「${c.name}」已确认入库，内部端口留待核实。`);
      await refresh();
    },
  });
  const cf = settings.data?.cf_api_token_set || settings.data?.cf_env_token,
    komari = settings.data?.komari_api_key_set || settings.data?.komari_env_key;
  return (
    <>
      <PageHeader
        eyebrow="连接外部来源"
        title="同步中心"
        description="从已授权来源补充资源事实，发现建议由你确认。"
        actions={
          <Button variant="secondary" asChild>
            <Link to="/settings">
              <Settings size={14} />
              连接设置
            </Link>
          </Button>
        }
      />
      <Feedback error={error || settings.error || accept.error} />
      {message && (
        <div className="notice-box" role="status">
          <Check size={16} />
          {message}
        </div>
      )}
      <div className="integration-grid">
        <section className="panel integration-card">
          <span className="integration-icon">
            <Cloud size={24} />
          </span>
          <div className="integration-title">
            <h2>Cloudflare</h2>
            <span className="type-tag">{cf ? "已配置" : "未配置"}</span>
          </div>
          <p>
            读取 DNS
            区域和记录，按具体主机名整理域名与地址。保留人工用途和项目。
          </p>
          <div className="integration-meta">
            <span className="dot active" />
            只读来源<span>环境变量优先</span>
          </div>
          <Button
            variant="secondary"
            disabled={!!action || !cf}
            onClick={() => run("cf")}
          >
            {action === "cf" ? (
              <LoaderCircle className="spin" size={15} />
            ) : (
              <RefreshCw size={15} />
            )}
            同步并导入域名
          </Button>
        </section>
        <section className="panel integration-card">
          <span className="integration-icon">
            <Server size={24} />
          </span>
          <div className="integration-title">
            <h2>Komari</h2>
            <span className="type-tag">
              {komari ? "已配置" : "公开接口 / 未配置"}
            </span>
          </div>
          <p>
            读取主机节点、规格和状态快照。UUID 用于稳定绑定，IP 仅作为匹配依据。
          </p>
          <div className="integration-meta">
            <span className="dot active" />
            只读来源<span>允许公开接口降级</span>
          </div>
          <Button
            variant="secondary"
            disabled={!!action}
            onClick={() => run("komari")}
          >
            {action === "komari" ? (
              <LoaderCircle className="spin" size={15} />
            ) : (
              <RefreshCw size={15} />
            )}
            同步并导入主机
          </Button>
        </section>
      </div>
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>检查与发现</h2>
            <p>执行一次 HTTP 检查；检查结果和推断不代表持续监控。</p>
          </div>
          <div className="page-actions">
            <Button
              variant="secondary"
              disabled={!!action}
              onClick={() => run("probe")}
            >
              {action === "probe" ? "检查中…" : "检查域名"}
            </Button>
            <Button
              variant="secondary"
              disabled={!!action}
              onClick={() => run("discover")}
            >
              {action === "discover" ? "发现中…" : "发现服务候选"}
            </Button>
          </div>
        </div>
        {candidates.length ? (
          <div className="simple-rows">
            {candidates.map((c) => {
              const valid =
                c.probe.ok &&
                c.probe.status !== null &&
                c.probe.status < 400 &&
                !c.probe.placeholder &&
                !c.probe.tls_invalid;
              return (
                <div className="candidate-row" key={c.domain_id}>
                  <div>
                    <strong>{c.name}</strong>
                    <span className="mono">{c.domain}</span>
                    <small>
                      {c.server_name} · {c.probe.kind || "未知类型"} ·{" "}
                      {c.probe.status || c.probe.error || "无响应"}
                      {c.probe.placeholder ? " · 默认页" : ""}
                      {c.probe.tls_invalid ? " · 证书异常" : ""}
                    </small>
                  </div>
                  <Button
                    variant="secondary"
                    disabled={!valid || accept.isPending}
                    onClick={() => accept.mutate(c)}
                  >
                    {valid ? "确认服务与归属" : "需手工复核"}
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="panel-padding muted">
            发现后会列出候选；只有有效的页面响应才能在这里确认。也可以在资源页手工建档。
          </p>
        )}
      </section>
    </>
  );
}
