import { useQuery } from "@tanstack/react-query";
import {
  Globe2,
  KeyRound,
  Layers,
  Plus,
  RefreshCw,
  Server,
  Sparkles,
  User,
  Zap,
} from "lucide-react";
import React, { useState } from "react";
import { Link } from "react-router-dom";
import type { Resource } from "../../../../packages/contracts";
import { resourceQuery } from "../api";
import { Empty, Feedback, Loading } from "../components/common";
import { ShowcaseCard } from "../components/resource";
import { Button } from "../components/ui/button";

export function Dashboard({ onCreate }: { onCreate: () => void }) {
  const query = useQuery(resourceQuery);
  const [activeTab, setActiveTab] = useState<string>("all");

  if (query.isPending) return <Loading />;
  if (query.error) return <Feedback error={query.error} />;

  const all = query.data || [];
  const services = all.filter((r) => r.type === "service");
  const hosts = all.filter((r) => r.type === "host");
  const domains = all.filter((r) => r.type === "domain");
  const subscriptions = all.filter((r) => r.type === "subscription");
  const accounts = all.filter((r) => r.type === "account");

  const displayedResources =
    activeTab === "all" ? all : all.filter((r) => r.type === activeTab);

  const categories = [
    { id: "all", label: "全部展厅", count: all.length, icon: Sparkles },
    { id: "service", label: "在线服务", count: services.length, icon: Zap },
    { id: "host", label: "云服务器", count: hosts.length, icon: Server },
    { id: "domain", label: "域名资产", count: domains.length, icon: Globe2 },
    {
      id: "subscription",
      label: "API与订阅",
      count: subscriptions.length,
      icon: KeyRound,
    },
    { id: "account", label: "常用平台", count: accounts.length, icon: User },
  ];

  return (
    <>
      {/* 1. 个人数字空间全景 Header */}
      <div className="bento-hero-banner">
        <div className="bento-hero-banner-content">
          <div className="bento-hero-eyebrow">
            <Sparkles size={13} className="text-primary" />
            <span>MY DIGITAL UNIVERSE · 个人数字空间</span>
          </div>
          <h1 className="bento-hero-title">
            我的在线服务、服务器与自媒体矩阵
          </h1>
          <p className="bento-hero-desc">
            聚合管理个人 VPS 节点、Cloudflare 域名、独立工具与常用账号 · 支持 ⌘V 粘贴截图极速换肤
          </p>
        </div>

        {/* 顶部轻量资产指标看板 */}
        <div className="bento-stat-pills">
          <div
            className={`bento-stat-pill ${activeTab === "host" ? "active" : ""}`}
            onClick={() => setActiveTab(activeTab === "host" ? "all" : "host")}
          >
            <Server size={15} className="text-purple-400" />
            <div className="bento-stat-pill-info">
              <span className="bento-stat-pill-val">{hosts.length}</span>
              <span className="bento-stat-pill-label">VPS 主机</span>
            </div>
          </div>

          <div
            className={`bento-stat-pill ${activeTab === "domain" ? "active" : ""}`}
            onClick={() => setActiveTab(activeTab === "domain" ? "all" : "domain")}
          >
            <Globe2 size={15} className="text-amber-400" />
            <div className="bento-stat-pill-info">
              <span className="bento-stat-pill-val">{domains.length}</span>
              <span className="bento-stat-pill-label">云解析域名</span>
            </div>
          </div>

          <div
            className={`bento-stat-pill ${activeTab === "service" ? "active" : ""}`}
            onClick={() => setActiveTab(activeTab === "service" ? "all" : "service")}
          >
            <Zap size={15} className="text-indigo-400" />
            <div className="bento-stat-pill-info">
              <span className="bento-stat-pill-val">{services.length}</span>
              <span className="bento-stat-pill-label">自建服务</span>
            </div>
          </div>

          <div
            className={`bento-stat-pill ${activeTab === "account" ? "active" : ""}`}
            onClick={() => setActiveTab(activeTab === "account" ? "all" : "account")}
          >
            <User size={15} className="text-pink-400" />
            <div className="bento-stat-pill-info">
              <span className="bento-stat-pill-val">{accounts.length}</span>
              <span className="bento-stat-pill-label">平台账号</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. 分类切换与快捷操作栏 */}
      <div className="bento-filter-bar">
        <div className="bento-category-pills">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeTab === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveTab(cat.id)}
                className={`bento-category-pill ${isActive ? "active" : ""}`}
              >
                <Icon size={14} />
                <span>{cat.label}</span>
                <span className="bento-pill-count">{cat.count}</span>
              </button>
            );
          })}
        </div>

        <div className="bento-filter-actions">
          <Button variant="secondary" asChild>
            <Link to="/integrations">
              <RefreshCw size={13} />
              同步数据
            </Link>
          </Button>
          <Button
            onClick={onCreate}
            className="bg-primary hover:bg-[#fa8c16] text-white"
          >
            <Plus size={14} />
            快捷录入
          </Button>
        </div>
      </div>

      {/* 3. 核心展厅卡片网格 */}
      {displayedResources.length ? (
        <div className="bento-grid">
          {displayedResources.map((res) => (
            <ShowcaseCard key={res.id} resource={res} />
          ))}
        </div>
      ) : (
        <Empty
          title="该分类下暂无资产"
          description="点击右上角「快捷录入」，截一张图按 ⌘V 即可极速收录。"
          action={
            <Button onClick={onCreate}>
              <Plus size={14} />
              立即录入
            </Button>
          }
        />
      )}
    </>
  );
}
