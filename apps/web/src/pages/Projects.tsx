import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowUpRight, FolderKanban, Plus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api, json, projectQuery, refresh } from "../api";
import { Empty, Feedback, Loading, PageHeader } from "../components/common";
import { Button } from "../components/ui/button";
import { Dialog } from "../components/ui/dialog";
export function Projects() {
  const query = useQuery(projectQuery);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const save = useMutation({
    mutationFn: () =>
      api("/api/cmdb/projects", json("POST", { name, purpose })),
    onSuccess: async () => {
      await refresh();
      setOpen(false);
      setName("");
      setPurpose("");
    },
  });
  return (
    <>
      <PageHeader
        eyebrow="按用途归集"
        title="项目"
        description="一个项目连接相关服务、主机与数据资源；共享资源可以属于多个项目。"
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus size={15} />
            创建项目
          </Button>
        }
      />
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <Feedback error={query.error} />
      ) : query.data.length ? (
        <div className="project-grid">
          {query.data.map((p) => (
            <Link
              key={p.id}
              to={`/resources?project=${p.id}`}
              className="project-card"
            >
              <span className="resource-icon">
                <FolderKanban size={20} />
              </span>
              <h2>{p.name}</h2>
              <p>{p.purpose || "尚未填写项目用途"}</p>
              <div>
                <span>{p.resource_count} 项资源</span>
                <ArrowUpRight size={16} />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <Empty
          title="把相关资源放在一起"
          description="例如个人博客、AI 工具、家庭服务。资源可以跨项目共享。"
        />
      )}
      <Dialog open={open} onOpenChange={setOpen} title="创建项目">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="dialog-body">
            <label>
              项目名称
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={120}
              />
            </label>
            <label>
              项目用途
              <textarea
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                rows={3}
                maxLength={1000}
              />
            </label>
            <Feedback error={save.error} />
          </div>
          <div className="dialog-footer">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              取消
            </Button>
            <Button type="submit" disabled={save.isPending}>
              创建项目
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
