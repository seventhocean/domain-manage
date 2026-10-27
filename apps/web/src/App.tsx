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
  Plus,
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
    <div className="orbit-app">
      {/* 现代沉浸式玻璃顶栏 (彻底告别笨重运维侧边栏) */}
      <header className="orbit-navbar">
        <div className="orbit-navbar-inner">
          <Link to="/" className="orbit-brand">
            <span className="orbit-brand-orb">
              <Boxes size={18} />
            </span>
            <div className="orbit-brand-text">
              <span className="orbit-brand-name">Orbit</span>
              <span className="orbit-brand-sub">数字展厅</span>
            </div>
          </Link>

          {/* 核心主导航 Pills */}
          <nav className="orbit-nav-links">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `orbit-nav-item ${isActive ? "active" : ""}`
              }
            >
              <LayoutDashboard size={15} />
              <span>展厅</span>
            </NavLink>
            <NavLink
              to="/resources"
              className={({ isActive }) =>
                `orbit-nav-item ${isActive && !typeParams.get("type") ? "active" : ""}`
              }
            >
              <Boxes size={15} />
              <span>台账</span>
              <em className="orbit-nav-count">{resources.length}</em>
            </NavLink>
            <NavLink
              to="/projects"
              className={({ isActive }) =>
                `orbit-nav-item ${isActive ? "active" : ""}`
              }
            >
              <FolderKanban size={15} />
              <span>项目</span>
            </NavLink>
            <NavLink
              to="/integrations"
              className={({ isActive }) =>
                `orbit-nav-item ${isActive ? "active" : ""}`
              }
            >
              <RefreshCw size={15} />
              <span>同步</span>
            </NavLink>
          </nav>

          {/* 右侧全局操作区 */}
          <div className="orbit-navbar-right">
            <button
              type="button"
              className="orbit-search-btn"
              onClick={() => {
                setSearch("");
                setPalette(true);
              }}
            >
              <Search size={14} />
              <span>搜索资产…</span>
              <kbd>⌘K</kbd>
            </button>

            <Button
              onClick={() => setCreate("service")}
              className="orbit-add-btn"
            >
              <Plus size={14} />
              <span>录入资产</span>
            </Button>

            <NavLink
              to="/settings"
              className="orbit-icon-btn"
              title="设置与数据"
            >
              <Settings size={16} />
            </NavLink>

            <button
              type="button"
              className="orbit-icon-btn"
              title="退出登录"
              onClick={async () => {
                await api("/api/auth/logout", json("POST"));
                queryClient.clear();
                navigate("/login");
              }}
            >
              <LogOut size={16} />
            </button>

            <div className="orbit-user-pill" title="单用户 · 本地持久化">
              <span className="orbit-avatar">W</span>
            </div>
          </div>
        </div>
      </header>

      {/* 主画布内容区 */}
      <main id="main-content" className="orbit-main">
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
                <ResourceIcon type={r.type} resource={r} />
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
