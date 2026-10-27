import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Box,
  Boxes,
  ChevronRight,
  Cloud,
  Database,
  FolderKanban,
  Globe2,
  HardDrive,
  KeyRound,
  Layers,
  LayoutDashboard,
  LogOut,
  RefreshCw,
  Search,
  Server,
  Settings,
  Shapes,
} from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
import {
  BrowserRouter,
  Link,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import type { ResourceType } from "../../../packages/contracts";
import { resourceTypes, typeLabels } from "../../../packages/contracts";
import { api, json, queryClient, resourceQuery } from "./api";
import { Empty, Loading } from "./components/common";
import { primaryValue, ResourceIcon } from "./components/resource";
import { Button } from "./components/ui/button";
import { Dialog } from "./components/ui/dialog";
import { AuthGate, Login } from "./features/auth/pages";
import { ResourceForm } from "./features/resources/form";
const Dashboard = lazy(() =>
  import("./pages/Dashboard").then((module) => ({ default: module.Dashboard })),
);
const ResourceList = lazy(() =>
  import("./features/resources/list").then((module) => ({
    default: module.ResourceList,
  })),
);
const ResourcePage = lazy(() =>
  import("./features/resources/detail").then((module) => ({
    default: module.ResourcePage,
  })),
);
const Projects = lazy(() =>
  import("./pages/Projects").then((module) => ({ default: module.Projects })),
);
const Integrations = lazy(() =>
  import("./pages/Integrations").then((module) => ({
    default: module.Integrations,
  })),
);
const SettingsPage = lazy(() =>
  import("./pages/Settings").then((module) => ({
    default: module.SettingsPage,
  })),
);
const typeIcons = {
  domain: Globe2,
  host: Server,
  service: Box,
  database: Database,
  storage: HardDrive,
  cloud: Cloud,
  subscription: KeyRound,
  account: Layers,
  other: Shapes,
};
function Shell() {
  const location = useLocation(),
    navigate = useNavigate();
  const { data: resources = [] } = useQuery(resourceQuery);
  const [palette, setPalette] = useState(false);
  const [search, setSearch] = useState("");
  const [create, setCreate] = useState<ResourceType | null>(null);
  const [typeParams] = useSearchParams();
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((v) => !v);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);
  const page = location.pathname.startsWith("/resources")
    ? "资源"
    : location.pathname.startsWith("/projects")
      ? "项目"
      : location.pathname.startsWith("/integrations")
        ? "同步中心"
        : location.pathname.startsWith("/settings")
          ? "设置"
          : "总览";
  const matches = resources
    .filter((r) =>
      [r.name, r.purpose, primaryValue(r), r.tags.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()),
    )
    .slice(0, 12);
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link to="/" className="brand">
          <span className="brand-symbol">
            <Boxes size={20} />
          </span>
          <span>
            资源台<small>个人 CMDB</small>
          </span>
        </Link>
        <div className="workspace-label">个人工作空间</div>
        <nav>
          <NavLink to="/" end>
            <LayoutDashboard size={17} />
            <span>总览</span>
          </NavLink>
          <NavLink to="/projects">
            <FolderKanban size={17} />
            <span>项目</span>
          </NavLink>
          <NavLink
            to="/resources"
            className={({ isActive }) =>
              isActive && !typeParams.get("type") ? "active" : ""
            }
          >
            <Boxes size={17} />
            <span>全部资源</span>
            <em>{resources.length}</em>
          </NavLink>
        </nav>
        <div className="nav-section-label">资源分类</div>
        <nav className="type-nav">
          {resourceTypes.map((type) => {
            const Icon = typeIcons[type];
            return (
              <Link
                key={type}
                to={`/resources?type=${type}`}
                className={
                  location.pathname === "/resources" &&
                  typeParams.get("type") === type
                    ? "active"
                    : ""
                }
              >
                <Icon size={16} />
                <span>{typeLabels[type]}</span>
                <em>
                  {resources.filter((r) => r.type === type).length || "—"}
                </em>
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <nav>
            <NavLink to="/integrations">
              <RefreshCw size={17} />
              <span>同步中心</span>
            </NavLink>
            <NavLink to="/settings">
              <Settings size={17} />
              <span>设置与数据</span>
            </NavLink>
          </nav>
          <div className="workspace-person">
            <span className="person-avatar">W</span>
            <div>
              我的资源空间<small>单用户 · 本地持久化</small>
            </div>
            <button
              className="icon-action"
              title="退出登录"
              onClick={async () => {
                await api("/api/auth/logout", json("POST"));
                queryClient.clear();
                navigate("/login");
              }}
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>
      <header className="topbar">
        <div className="breadcrumbs">
          <span>工作空间</span>
          <ChevronRight size={13} />
          <strong>{page}</strong>
        </div>
        <button
          className="search-trigger"
          onClick={() => {
            setSearch("");
            setPalette(true);
          }}
        >
          <Search size={15} />
          <span>搜索所有资源</span>
          <kbd>⌘ K</kbd>
        </button>
        <span className="private-label">
          <i className="dot active" />
          个人空间
        </span>
      </header>
      <main id="main-content" className="content">
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route
              path="/"
              element={<Dashboard onCreate={() => setCreate("service")} />}
            />
            <Route
              path="/resources"
              element={<ResourceList onCreate={(type) => setCreate(type)} />}
            />
            <Route path="/resources/:id" element={<ResourcePage />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/integrations" element={<Integrations />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route
              path="*"
              element={
                <Empty
                  title="页面不存在"
                  description="从左侧导航重新选择，或使用全局搜索定位资源。"
                  action={
                    <Button asChild variant="secondary">
                      <Link to="/">返回总览</Link>
                    </Button>
                  }
                />
              }
            />
          </Routes>
        </Suspense>
      </main>
      <nav className="mobile-tabs">
        <NavLink to="/" end>
          <LayoutDashboard size={18} />
          总览
        </NavLink>
        <NavLink
          to="/resources"
          className={({ isActive }) =>
            isActive && !typeParams.get("type") ? "active" : ""
          }
        >
          <Boxes size={18} />
          资源
        </NavLink>
        <NavLink to="/integrations">
          <RefreshCw size={18} />
          同步
        </NavLink>
        <NavLink to="/settings">
          <Settings size={18} />
          设置
        </NavLink>
      </nav>
      {create && (
        <ResourceForm
          initialType={create}
          onClose={() => setCreate(null)}
          onSaved={(r) => {
            setCreate(null);
            navigate(`/resources/${r.id}`);
          }}
        />
      )}
      <Dialog
        open={palette}
        onOpenChange={setPalette}
        title="搜索资源"
        description="搜索名称、用途、域名、IP 和标签。"
      >
        <div className="palette-search">
          <Search size={17} />
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="输入资源名称、域名或用途…"
          />
        </div>
        <div className="palette-results">
          {matches.length ? (
            matches.map((r) => (
              <button
                key={r.id}
                onClick={() => {
                  setPalette(false);
                  navigate(`/resources/${r.id}`);
                }}
              >
                <ResourceIcon type={r.type} />
                <span>
                  {r.name}
                  <small>{primaryValue(r)}</small>
                </span>
                <span className="muted">{typeLabels[r.type]}</span>
                <ArrowUpRight size={14} />
              </button>
            ))
          ) : (
            <p className="muted">没有匹配资源</p>
          )}
        </div>
      </Dialog>
    </div>
  );
}
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/*"
          element={
            <AuthGate>
              <Shell />
            </AuthGate>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
