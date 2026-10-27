import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  Globe2,
  Link2,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import type { ResourceDetail } from "../../../../../packages/contracts";
import { relationLabels, typeLabels } from "../../../../../packages/contracts";
import { api, json, projectQuery, refresh, resourceQuery } from "../../api";
import { Empty, Feedback, Loading } from "../../components/common";
import {
  CopyValue,
  External,
  relativeTime,
  ResourceIcon,
  Status,
  TagBadge,
} from "../../components/resource";
import { Button } from "../../components/ui/button";
import { detailFields, ResourceForm } from "../../features/resources/form";
import { DeploymentForm, EndpointForm, RelationForm } from "./relations";
export function ResourcePage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "overview";
  const query = useQuery({
    queryKey: ["resource", id],
    queryFn: () => api<ResourceDetail>(`/api/cmdb/resources/${id}`),
  });
  const all = useQuery(resourceQuery),
    projects = useQuery(projectQuery);
  const [modal, setModal] = useState<string | null>(null);
  const remove = useMutation({
    mutationFn: () =>
      api(
        `/api/cmdb/resources/${id}`,
        json("DELETE", { revision: query.data?.resource.revision }),
      ),
    onSuccess: async () => {
      await refresh();
      navigate("/resources");
    },
  });
  const unlink = useMutation({
    mutationFn: ({ kind, target }: { kind: string; target: string }) =>
      api(`/api/cmdb/${kind}/${target}`, json("DELETE")),
    onSuccess: () => refresh(),
  });
  if (query.isPending) return <Loading />;
  if (query.error)
    return (
      <>
        <Link className="back-link" to="/resources">
          <ArrowLeft size={14} />
          返回资源
        </Link>
        <Feedback error={query.error} />
      </>
    );
  const {
    resource: r,
    relations,
    deployments: deps,
    endpoints: entries,
    history,
  } = query.data;
  const lookup = (key: string) => all.data?.find((x) => x.id === key);
  const relationCount = relations.length + deps.length;
  return (
    <>
      <Link className="back-link" to={`/resources?type=${r.type}`}>
        <ArrowLeft size={14} />
        {typeLabels[r.type]}台账
      </Link>
      <div className="detail-header">
        <ResourceIcon type={r.type} resource={r} size={24} />
        <div>
          <div className="eyebrow">
            {typeLabels[r.type]}
            <span className="dot-divider">·</span>
            <span className="mono">v{r.revision}</span>
          </div>
          <h1>{r.name}</h1>
          <p>{r.purpose || "尚未填写用途，补充后更容易找回这项资源。"}</p>
        </div>
        <div className="detail-actions">
          <Status value={r.lifecycle} />
          <Button variant="secondary" onClick={() => setModal("edit")}>
            编辑资源
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="移入回收站"
            onClick={() => {
              if (
                window.confirm(
                  `将「${r.name}」移入回收站？\n已有 ${relationCount} 条关联/部署记录会保留，相关资源不会删除。`,
                )
              )
                remove.mutate();
            }}
          >
            <Trash2 size={16} />
          </Button>
        </div>
      </div>
      <Feedback error={remove.error || unlink.error} />
      <div className="detail-tabs">
        {[
          { id: "overview", label: "概况" },
          { id: "relations", label: "关联与依赖", count: relations.length },
          { id: "deployments", label: "部署", count: deps.length },
          { id: "history", label: "变更记录", count: history.length },
        ].map((item) => (
          <button
            key={item.id}
            className={tab === item.id ? "active" : ""}
            onClick={() => setParams({ tab: item.id })}
          >
            {item.label}
            {item.count !== undefined && <span>{item.count}</span>}
          </button>
        ))}
      </div>
      {tab === "overview" && (
        <div className="detail-columns">
          <div>
            <section className="panel">
              <div className="panel-header">
                <h2>资源信息</h2>
                <span className="type-tag">人工台账</span>
              </div>
              <dl className="info-list">
                <div>
                  <dt>用途</dt>
                  <dd>{r.purpose || <span className="muted">待补充</span>}</dd>
                </div>
                <div>
                  <dt>生命周期</dt>
                  <dd>
                    <Status value={r.lifecycle} />
                  </dd>
                </div>
                {detailFields[r.type].map((field) => (
                  <div key={field.key}>
                    <dt>{field.label}</dt>
                    <dd>
                      {r.details[field.key] ? (
                        <CopyValue value={String(r.details[field.key])} />
                      ) : (
                        <span className="muted">未记录</span>
                      )}
                    </dd>
                  </div>
                ))}
                <div>
                  <dt>管理后台</dt>
                  <dd>
                    {r.management_url ? (
                      <External url={r.management_url} label="打开管理后台" />
                    ) : (
                      <span className="muted">未记录</span>
                    )}
                  </dd>
                </div>
              </dl>
              {r.details.address_source === "legacy_unverified" && (
                <div className="inline-note">
                  <AlertCircle size={15} />
                  IP 来自旧版区域汇总，需同步并核实实际归属。
                </div>
              )}
            </section>
            {r.type === "service" && (
              <section className="panel">
                <div className="panel-header">
                  <h2>访问入口</h2>
                  <Button variant="ghost" onClick={() => setModal("endpoint")}>
                    <Plus size={14} />
                    添加入口
                  </Button>
                </div>
                {entries.length ? (
                  <div className="simple-rows">
                    {entries.map((entry) => (
                      <div className="simple-row" key={entry.id}>
                        <Globe2 size={16} />
                        <div>
                          <External
                            url={entry.url}
                            label={entry.label || entry.url}
                          />
                          <small className="mono">{entry.url}</small>
                        </div>
                        <span className="type-tag">
                          {entry.environment === "production"
                            ? "生产"
                            : entry.environment === "staging"
                              ? "预发布"
                              : "开发"}
                        </span>
                        <button
                          className="icon-action"
                          title="移除入口"
                          onClick={() => {
                            if (
                              window.confirm(
                                "确定移除这条访问入口？域名关联会保留。",
                              )
                            )
                              unlink.mutate({
                                kind: "endpoints",
                                target: entry.id,
                              });
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="panel-padding muted">
                    添加访问地址后，可从这里直接打开服务，并关联对应域名。
                  </p>
                )}
              </section>
            )}
            {r.notes && (
              <section className="panel">
                <div className="panel-header">
                  <h2>备注</h2>
                </div>
                <p className="notes-text">{r.notes}</p>
              </section>
            )}
          </div>
          <aside>
            <section className="panel">
              <div className="panel-header">
                <h2>归集与标记</h2>
              </div>
              <div className="panel-padding">
                <span className="field-caption">所属项目</span>
                <div className="chip-row">
                  {r.project_ids.length ? (
                    r.project_ids.map((project) => (
                      <Link
                        key={project}
                        className="chip"
                        to={`/resources?project=${project}`}
                      >
                        {projects.data?.find((p) => p.id === project)?.name ||
                          project}
                      </Link>
                    ))
                  ) : (
                    <span className="muted">尚未归集到项目</span>
                  )}
                </div>
                <span className="field-caption">标签</span>
                <div className="chip-row">
                  {r.tags.length ? (
                    r.tags.map((tag) => (
                      <TagBadge key={tag} tag={tag} size="md" />
                    ))
                  ) : (
                    <span className="muted">暂无标签</span>
                  )}
                </div>
              </div>
            </section>
            <section className="panel">
              <div className="panel-header">
                <h2>记录信息</h2>
              </div>
              <dl className="info-list compact">
                <div>
                  <dt>创建</dt>
                  <dd>{relativeTime(r.created_at)}</dd>
                </div>
                <div>
                  <dt>更新</dt>
                  <dd>{relativeTime(r.updated_at)}</dd>
                </div>
                <div>
                  <dt>版本</dt>
                  <dd className="mono">{r.revision}</dd>
                </div>
                <div>
                  <dt>资源 ID</dt>
                  <dd className="break-all mono">{r.id}</dd>
                </div>
              </dl>
            </section>
            <div className="quiet-note">
              <ShieldCheck size={17} />
              <p>
                这里记录管理意图与资源关系。实时在线状态应以来源观察和检查时间为依据。
              </p>
            </div>
          </aside>
        </div>
      )}
      {tab === "relations" && (
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>关联与依赖</h2>
              <p>仅展示已记录关系，未记录不代表没有影响。</p>
            </div>
            <Button variant="secondary" onClick={() => setModal("relation")}>
              <Plus size={14} />
              添加关联
            </Button>
          </div>
          {relations.length ? (
            <div className="simple-rows">
              {relations.map((rel) => {
                const outgoing = rel.source_id === id;
                const target = lookup(outgoing ? rel.target_id : rel.source_id);
                return (
                  <div className="simple-row relation-row" key={rel.id}>
                    {target ? (
                      <ResourceIcon type={target.type} resource={target} />
                    ) : (
                      <Link2 size={18} />
                    )}
                    <div>
                      {target ? (
                        <Link to={`/resources/${target.id}`}>
                          {target.name}
                        </Link>
                      ) : (
                        <span className="muted">回收站中的资源</span>
                      )}
                      <small>
                        {outgoing ? "当前资源 →" : "→ 当前资源"} ·{" "}
                        {relationLabels[rel.kind] || rel.kind}
                      </small>
                    </div>
                    <span className="type-tag">已记录</span>
                    <button
                      className="icon-action"
                      title="移除关联"
                      onClick={() => {
                        if (window.confirm("确定移除这条关联？"))
                          unlink.mutate({ kind: "relations", target: rel.id });
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <Empty
              title="还没有关联"
              description="把域名、服务和依赖连接起来，之后就能双向查找。"
            />
          )}
        </section>
      )}
      {tab === "deployments" && (
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>部署记录</h2>
              <p>公网入口与内部监听端口分别记录。</p>
            </div>
            {r.type === "service" && (
              <Button
                variant="secondary"
                onClick={() => setModal("deployment")}
              >
                <Plus size={14} />
                添加部署
              </Button>
            )}
          </div>
          {deps.length ? (
            <div className="simple-rows">
              {deps.map((dep) => {
                const target = lookup(
                  r.type === "service" ? dep.server_id : dep.service_id,
                );
                return (
                  <div className="simple-row" key={dep.id}>
                    <ResourceIcon type={target?.type || "host"} resource={target || undefined} />
                    <div>
                      {target ? (
                        <Link to={`/resources/${target.id}`}>
                          {target.name}
                        </Link>
                      ) : (
                        "承载资源已移入回收站"
                      )}
                      <small className="mono">
                        {[
                          dep.protocol,
                          dep.port ? `:${dep.port}` : "内部端口未记录",
                          dep.path,
                          dep.container,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </small>
                    </div>
                    <span className="type-tag">
                      {dep.environment === "production"
                        ? "生产"
                        : "开发 / 预发布"}
                    </span>
                    <button
                      className="icon-action"
                      title="移除部署"
                      onClick={() => {
                        if (window.confirm("确定移除这条部署记录？"))
                          unlink.mutate({
                            kind: "deployments",
                            target: dep.id,
                          });
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <Empty
              title="还没有部署记录"
              description={
                r.type === "service"
                  ? "记录承载主机或平台、环境、内部端口和容器名。"
                  : "其他服务部署到这个资源后，会显示在这里。"
              }
            />
          )}
        </section>
      )}
      {tab === "history" && (
        <section className="panel">
          <div className="panel-header">
            <h2>变更记录</h2>
            <span className="muted">最近 100 条</span>
          </div>
          <div className="history-list">
            {history.map((item) => (
              <details key={item.id}>
                <summary>
                  <span className="history-marker" />
                  <span>
                    {{
                      created: "创建资源",
                      hostname_renamed: "域名标识变更",
                      deleted: "移入回收站",
                      updated: "更新资源",
                      linked: "建立关联",
                      unlinked: "解除关联",
                      deployment_saved: "保存部署",
                      deployment_removed: "移除部署",
                      endpoint_added: "添加入口",
                      endpoint_removed: "移除入口",
                      restored: "恢复资源",
                    }[item.action] || item.action}
                    <small>
                      {item.source === "manual" ? "手工操作" : item.source}
                    </small>
                  </span>
                  <time>{new Date(item.at).toLocaleString("zh-CN")}</time>
                </summary>
                <pre>{JSON.stringify(item.changes, null, 2)}</pre>
              </details>
            ))}
          </div>
        </section>
      )}
      {modal === "edit" && (
        <ResourceForm
          resource={r}
          onClose={() => setModal(null)}
          onSaved={() => setModal(null)}
        />
      )}
      {modal === "relation" && (
        <RelationForm
          resource={r}
          resources={all.data || []}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "deployment" && (
        <DeploymentForm
          resource={r}
          resources={all.data || []}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "endpoint" && (
        <EndpointForm resource={r} onClose={() => setModal(null)} />
      )}
    </>
  );
}
