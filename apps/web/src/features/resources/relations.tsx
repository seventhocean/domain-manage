import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import type { Resource } from "../../../../../packages/contracts";
import { typeLabels } from "../../../../../packages/contracts";
import { api, json, refresh } from "../../api";
import { Feedback } from "../../components/common";
import { primaryValue } from "../../components/resource";
import { Button } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";
export function RelationForm({
  resource,
  resources,
  onClose,
}: {
  resource: Resource;
  resources: Resource[];
  onClose: () => void;
}) {
  const [kind, setKind] = useState("depends_on");
  const [target, setTarget] = useState("");
  const [notes, setNotes] = useState("");
  const candidates = resources.filter(
    (r) =>
      r.id !== resource.id && (kind !== "uses_hostname" || r.type === "domain"),
  );
  const save = useMutation({
    mutationFn: () =>
      api(
        "/api/cmdb/relations",
        json("POST", {
          source_id: resource.id,
          target_id: target,
          kind,
          notes,
        }),
      ),
    onSuccess: async () => {
      await refresh();
      onClose();
    },
  });
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title="添加关联"
      description={`为「${resource.name}」关联已有资源。关系会在两侧详情中显示。`}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div className="dialog-body">
          <label>
            关系类型
            <select
              value={kind}
              onChange={(e) => {
                setKind(e.target.value);
                setTarget("");
              }}
            >
              <option value="depends_on">依赖</option>
              <option value="backs_up_to">备份到</option>
              <option value="related_to">关联</option>
              {resource.type === "service" && (
                <option value="uses_hostname">使用域名</option>
              )}
            </select>
          </label>
          <label>
            目标资源
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              required
            >
              <option value="">选择资源</option>
              {candidates.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} · {typeLabels[r.type]}
                </option>
              ))}
            </select>
          </label>
          <label>
            说明
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={1000}
            />
          </label>
          <Feedback error={save.error} />
        </div>
        <div className="dialog-footer">
          <Button type="button" variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" disabled={!target || save.isPending}>
            建立关联
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
export function DeploymentForm({
  resource,
  resources,
  onClose,
}: {
  resource: Resource;
  resources: Resource[];
  onClose: () => void;
}) {
  const [target, setTarget] = useState("");
  const [port, setPort] = useState("");
  const [protocol, setProtocol] = useState("http");
  const [path, setPath] = useState("");
  const [container, setContainer] = useState("");
  const [environment, setEnvironment] = useState("production");
  const save = useMutation({
    mutationFn: () =>
      api(
        "/api/cmdb/deployments",
        json("POST", {
          service_id: resource.id,
          server_id: target,
          protocol,
          port,
          path,
          container,
          environment,
          notes: "",
        }),
      ),
    onSuccess: async () => {
      await refresh();
      onClose();
    },
  });
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title="添加部署"
      description="记录内部运行位置。未知端口可留空，不会使用公网入口端口代替。"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div className="dialog-body">
          <label>
            承载资源
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              required
            >
              <option value="">选择主机或云托管平台</option>
              {resources
                .filter((r) => ["host", "cloud"].includes(r.type))
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} · {primaryValue(r)}
                  </option>
                ))}
            </select>
          </label>
          <div className="field-grid">
            <label>
              协议
              <select
                value={protocol}
                onChange={(e) => setProtocol(e.target.value)}
              >
                {["http", "https", "tcp", "udp"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              内部端口
              <input
                type="number"
                min={1}
                max={65535}
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder="未知可留空"
              />
            </label>
          </div>
          <label>
            环境
            <select
              value={environment}
              onChange={(e) => setEnvironment(e.target.value)}
            >
              <option value="production">生产环境</option>
              <option value="staging">预发布</option>
              <option value="development">开发环境</option>
            </select>
          </label>
          <div className="field-grid">
            <label>
              路径
              <input value={path} onChange={(e) => setPath(e.target.value)} />
            </label>
            <label>
              容器 / 实例名
              <input
                value={container}
                onChange={(e) => setContainer(e.target.value)}
              />
            </label>
          </div>
          <Feedback error={save.error} />
        </div>
        <div className="dialog-footer">
          <Button type="button" variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" disabled={!target || save.isPending}>
            保存部署
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
export function EndpointForm({
  resource,
  onClose,
}: {
  resource: Resource;
  onClose: () => void;
}) {
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const save = useMutation({
    mutationFn: () =>
      api(
        "/api/cmdb/endpoints",
        json("POST", {
          service_id: resource.id,
          url,
          label,
          environment: "production",
        }),
      ),
    onSuccess: async () => {
      await refresh();
      onClose();
    },
  });
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title="添加访问入口"
      description="URL 对应的域名会复用或创建台账记录，并与服务关联。"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div className="dialog-body">
          <label>
            入口地址
            <input
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://app.example.com"
            />
          </label>
          <label>
            入口名称
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="主站 / 管理后台 / API"
            />
          </label>
          <Feedback error={save.error} />
        </div>
        <div className="dialog-footer">
          <Button type="button" variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" disabled={save.isPending}>
            保存入口
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
