import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUpRight,
  Boxes,
  ChevronRight,
  FolderKanban,
  Layers,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { Link } from "react-router-dom";
import { resourceTypes, typeLabels } from "../../../../packages/contracts";
import { projectQuery, resourceQuery } from "../api";
import { Empty, Feedback, Loading, PageHeader } from "../components/common";
import {
  primaryValue,
  relativeTime,
  ResourceIcon,
} from "../components/resource";
import { Button } from "../components/ui/button";
export function Dashboard({ onCreate }: { onCreate: () => void }) {
  const query = useQuery(resourceQuery),
    projects = useQuery(projectQuery);
  if (query.isPending) return <Loading />;
  if (query.error) return <Feedback error={query.error} />;
  const all = query.data,
    active = all.filter((r) => r.lifecycle === "active"),
    incomplete = active.filter((r) => !r.purpose || !r.project_ids.length);
  const recent = [...all]
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, 6);
  return (
    <>
      <PageHeader
        eyebrow="工作空间概览"
        title="所有资源，清楚在握"
        description="从这里找到入口、查清归属，维护自己的在线资源。"
        actions={
          <Button onClick={onCreate}>
            <Plus size={15} />
            添加资源
          </Button>
        }
      />
      <div className="stat-grid">
        {[
          {
            label: "全部资源",
            value: all.length,
            sub: "统一登记的在线资产",
            icon: Boxes,
          },
          {
            label: "使用中",
            value: active.length,
            sub: "人工维护的生命周期",
            icon: Layers,
          },
          {
            label: "项目",
            value: projects.data ? projects.data.length : "—",
            sub: "按用途组织资源",
            icon: FolderKanban,
          },
          {
            label: "待完善资料",
            value: incomplete.length,
            sub: "缺少用途或所属项目",
            icon: SlidersHorizontal,
          },
        ].map((stat) => (
          <div className="stat-card" key={stat.label}>
            <div className="stat-label">
              {stat.label}
              <stat.icon size={16} />
            </div>
            <strong>
              {stat.value}
              <span> {stat.label === "项目" ? "个项目" : "项"}</span>
            </strong>
            <small>{stat.sub}</small>
          </div>
        ))}
      </div>
      <div className="dashboard-columns">
        <section className="panel">
          <div className="panel-header">
            <h2>最近更新</h2>
            <Link to="/resources">
              全部资源
              <ArrowRight size={13} />
            </Link>
          </div>
          {recent.length ? (
            <div className="resource-rows">
              {recent.map((r) => (
                <Link
                  to={`/resources/${r.id}`}
                  className="resource-row"
                  key={r.id}
                >
                  <ResourceIcon type={r.type} />
                  <span className="row-title">
                    {r.name}
                    <small>{r.purpose || primaryValue(r)}</small>
                  </span>
                  <span className="type-tag">{typeLabels[r.type]}</span>
                  <span className="muted row-time">
                    {relativeTime(r.updated_at)}
                  </span>
                  <ChevronRight size={15} />
                </Link>
              ))}
            </div>
          ) : (
            <Empty
              title="开始建立你的资源台账"
              description="添加第一个服务，或到同步中心导入已有域名和主机。"
              action={
                <Button variant="secondary" asChild>
                  <Link to="/integrations">
                    连接数据来源
                    <ArrowRight size={14} />
                  </Link>
                </Button>
              }
            />
          )}
        </section>
        <section className="panel">
          <div className="panel-header">
            <h2>资源分布</h2>
            <Boxes size={15} />
          </div>
          <div className="distribution">
            {resourceTypes
              .filter((t) => all.some((r) => r.type === t))
              .map((t) => (
                <Link key={t} to={`/resources?type=${t}`}>
                  <span>{typeLabels[t]}</span>
                  <div className="distribution-track">
                    <i
                      style={{
                        width: `${(all.filter((r) => r.type === t).length / Math.max(1, all.length)) * 100}%`,
                      }}
                    />
                  </div>
                  <strong>{all.filter((r) => r.type === t).length}</strong>
                </Link>
              ))}
            {!all.length && (
              <p className="muted">录入资源后，这里会展示实际分布。</p>
            )}
          </div>
          <div className="panel-note">
            <ShieldCheck size={16} />
            <p>
              状态有据可查
              <small>
                使用中表示资源仍在使用；实时在线状态由独立观察提供。
              </small>
            </p>
          </div>
        </section>
      </div>
      <section className="panel attention-panel">
        <div className="panel-header">
          <h2>把台账补充完整</h2>
          <span className="muted">{incomplete.length} 项待完善</span>
        </div>
        {incomplete.length ? (
          <div className="attention-grid">
            {incomplete.slice(0, 4).map((r) => (
              <Link key={r.id} to={`/resources/${r.id}`}>
                <ResourceIcon type={r.type} />
                <div>
                  {r.name}
                  <small>
                    {[
                      !r.purpose ? "补充用途" : "",
                      !r.project_ids.length ? "关联项目" : "",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </small>
                </div>
                <ArrowUpRight size={15} />
              </Link>
            ))}
          </div>
        ) : (
          <p className="muted panel-padding">
            {all.length
              ? "在用资源已填写用途和项目。"
              : "录入后会在这里提示缺失的用途与项目。"}
          </p>
        )}
      </section>
    </>
  );
}
