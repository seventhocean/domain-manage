import { useQuery } from "@tanstack/react-query";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { LayoutGrid, List, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import type { Resource, ResourceType } from "../../../../../packages/contracts";
import {
  lifecycleLabels,
  primaryResourceTypes,
  resourceTypes,
  typeLabels,
} from "../../../../../packages/contracts";
import { projectQuery, resourceQuery } from "../../api";
import { Empty, Feedback, Loading, PageHeader } from "../../components/common";
import {
  primaryValue,
  relativeTime,
  ResourceIcon,
  ShowcaseCard,
  Status,
} from "../../components/resource";
import { Button } from "../../components/ui/button";
export function ResourceList({
  onCreate,
}: {
  onCreate: (type: ResourceType) => void;
}) {
  const query = useQuery(resourceQuery),
    projects = useQuery(projectQuery);
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [viewMode, setViewMode] = useState<"card" | "table">("card");
  const type = params.get("type") || "",
    q = params.get("q") || "",
    life = params.get("lifecycle") || "",
    project = params.get("project") || "";
  const update = (key: string, value: string) => {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        value ? next.set(key, value) : next.delete(key);
        return next;
      },
      { replace: true },
    );
  };
  const filtered = useMemo(
    () =>
      (query.data || []).filter(
        (r) =>
          (!type || r.type === type) &&
          (!life || r.lifecycle === life) &&
          (!project || r.project_ids.includes(project)) &&
          [r.name, r.purpose, primaryValue(r), r.notes, r.tags.join(" ")]
            .join(" ")
            .toLowerCase()
            .includes(q.toLowerCase()),
      ),
    [query.data, type, life, project, q],
  );
  const columns = useMemo<ColumnDef<Resource>[]>(
    () => [
      {
        accessorKey: "name",
        header: "资源名称",
        cell: ({ row }) => (
          <div className="table-identity">
            <ResourceIcon type={row.original.type} resource={row.original} />
            <div>
              <Link to={`/resources/${row.original.id}`}>
                {row.original.name}
              </Link>
              <small className="mono">{primaryValue(row.original)}</small>
            </div>
          </div>
        ),
      },
      {
        accessorKey: "type",
        header: "类型",
        cell: ({ row }) => (
          <span className="type-tag">{typeLabels[row.original.type]}</span>
        ),
      },
      {
        accessorKey: "purpose",
        header: "用途",
        cell: ({ getValue }) => (
          <span className={getValue() ? "" : "muted"}>
            {String(getValue() || "待补充用途")}
          </span>
        ),
      },
      {
        accessorKey: "lifecycle",
        header: "生命周期",
        cell: ({ row }) => <Status value={row.original.lifecycle} />,
      },
      {
        id: "projects",
        header: "项目",
        cell: ({ row }) => (
          <span className="muted">
            {row.original.project_ids
              .map((id) => projects.data?.find((p) => p.id === id)?.name)
              .filter(Boolean)
              .join("、") || "未归集"}
          </span>
        ),
      },
      {
        accessorKey: "updated_at",
        header: "更新",
        cell: ({ row }) => (
          <span className="muted nowrap">
            {relativeTime(row.original.updated_at)}
          </span>
        ),
      },
    ],
    [projects.data],
  );
  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  if (query.isPending) return <Loading />;
  if (query.error) return <Feedback error={query.error} />;
  return (
    <>
      <PageHeader
        eyebrow="资源台账"
        title={(type && typeLabels[type as ResourceType]) || "全部资源"}
        description={`共 ${query.data.length} 项资源${filtered.length !== query.data.length ? `，当前显示 ${filtered.length} 项` : ""} · 用途、入口和关系集中在这里。`}
        actions={
          <Button
            onClick={() =>
              onCreate(
                resourceTypes.includes(type as ResourceType)
                  ? (type as ResourceType)
                  : "service",
              )
            }
          >
            <Plus size={15} />
            添加资源
          </Button>
        }
      />
      <div className="resource-toolbar">
        <div className="search-field">
          <Search size={16} />
          <input
            value={q}
            onChange={(e) => update("q", e.target.value)}
            placeholder="搜索名称、用途、域名或 IP…"
          />
        </div>
        <select
          aria-label="资源类型"
          value={type}
          onChange={(e) => update("type", e.target.value)}
        >
          <option value="">全部类型</option>
          {primaryResourceTypes.map((t) => (
            <option key={t} value={t}>
              {typeLabels[t]}
            </option>
          ))}
        </select>
        <select
          aria-label="生命周期"
          value={life}
          onChange={(e) => update("lifecycle", e.target.value)}
        >
          <option value="">全部状态</option>
          {Object.entries(lifecycleLabels).map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
        <select
          aria-label="所属项目"
          value={project}
          onChange={(e) => update("project", e.target.value)}
        >
          <option value="">全部项目</option>
          {projects.data?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <Button variant="ghost" asChild>
          <Link to="/projects">管理项目</Link>
        </Button>
        {params.size > 0 && (
          <Button variant="ghost" onClick={() => setParams({})}>
            清除筛选
          </Button>
        )}
        <div style={{ marginLeft: "auto", display: "flex", gap: "4px" }}>
          <Button
            variant={viewMode === "card" ? "secondary" : "ghost"}
            onClick={() => setViewMode("card")}
            title="卡片展厅"
          >
            <LayoutGrid size={15} />
            卡片
          </Button>
          <Button
            variant={viewMode === "table" ? "secondary" : "ghost"}
            onClick={() => setViewMode("table")}
            title="表格清单"
          >
            <List size={15} />
            表格
          </Button>
        </div>
      </div>
      {filtered.length ? (
        viewMode === "card" ? (
          <div className="bento-grid">
            {filtered.map((r) => (
              <ShowcaseCard key={r.id} resource={r} />
            ))}
          </div>
        ) : (
        <>
          <div className="table-container">
            <table className="resource-table">
              <thead>
                {table.getHeaderGroups().map((group) => (
                  <tr key={group.id}>
                    {group.headers.map((h) => (
                      <th key={h.id}>
                        <button onClick={h.column.getToggleSortingHandler()}>
                          {flexRender(
                            h.column.columnDef.header,
                            h.getContext(),
                          )}
                          {h.column.getIsSorted() === "asc"
                            ? " ↑"
                            : h.column.getIsSorted() === "desc"
                              ? " ↓"
                              : ""}
                        </button>
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={(e) => {
                      if (!(e.target as HTMLElement).closest("a,button,input"))
                        navigate(`/resources/${row.original.id}`);
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="table-footer">
              {filtered.length} 项资源<span>点击资源查看详情与关联</span>
            </div>
          </div>
          <div className="mobile-resource-list">
            {filtered.map((r) => (
              <Link
                to={`/resources/${r.id}`}
                key={r.id}
                className="mobile-resource-card"
              >
                <div>
                  <ResourceIcon type={r.type} resource={r} />
                  <strong>{r.name}</strong>
                  <Status value={r.lifecycle} />
                </div>
                <p>{r.purpose || "待补充用途"}</p>
                <small className="mono">{primaryValue(r)}</small>
              </Link>
            ))}
          </div>
        </>
        )
      ) : (
        <Empty
          title={query.data.length ? "没有匹配的资源" : "还没有资源"}
          description={
            query.data.length
              ? "试试其他关键词，或清除筛选条件。"
              : "从一个服务、域名或主机开始，把自己的在线资源逐步归集。"
          }
          action={
            <Button
              variant="secondary"
              onClick={() =>
                onCreate(
                  resourceTypes.includes(type as ResourceType)
                    ? (type as ResourceType)
                    : "service",
                )
              }
            >
              添加资源
            </Button>
          }
        />
      )}
    </>
  );
}
