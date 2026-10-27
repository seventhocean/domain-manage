import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRight, Boxes, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { api, json, queryClient } from "../../api";
import { Feedback, Loading } from "../../components/common";
import { Button } from "../../components/ui/button";
export function AuthGate({ children }: { children: React.ReactNode }) {
  const auth = useQuery({
    queryKey: ["auth"],
    queryFn: () =>
      api<{
        authenticated: boolean;
        has_password: boolean;
        env_override: boolean;
      }>("/api/auth/status"),
    retry: false,
  });
  if (auth.isPending) return <Loading />;
  if (auth.error)
    return (
      <div className="auth-wrap">
        <Feedback error={auth.error} />
        <Button onClick={() => auth.refetch()}>重试</Button>
      </div>
    );
  if (!auth.data.authenticated) return <Navigate to="/login" replace />;
  return children;
}
export function Login() {
  const navigate = useNavigate();
  const auth = useQuery({
    queryKey: ["auth"],
    queryFn: () =>
      api<{ authenticated: boolean; has_password: boolean }>(
        "/api/auth/status",
      ),
    retry: false,
  });
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const setup = auth.data && !auth.data.has_password;
  const login = useMutation({
    mutationFn: async () => {
      if (setup && password !== confirm)
        throw new Error("两次输入的口令不一致");
      return api(
        "/api/auth/" + (setup ? "setup" : "login"),
        json("POST", { password, setup_token: token }),
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["auth"] });
      navigate("/");
    },
    onError: (e) => setError(e.message),
  });
  if (auth.data?.authenticated) return <Navigate to="/" replace />;
  return (
    <div className="auth-wrap">
      <form
        className="auth-card"
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          login.mutate();
        }}
      >
        <div className="brand">
          <span className="brand-symbol">
            <Boxes size={20} />
          </span>
          <span>
            资源台 <small>个人 CMDB</small>
          </span>
        </div>
        <h1>{setup ? "初始化资源台" : "欢迎回来"}</h1>
        <p className="muted">
          {setup
            ? "使用部署初始化凭证设置访问口令。"
            : "登录后查看和管理你的在线资源。"}
        </p>
        {setup && (
          <label>
            初始化凭证
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              autoComplete="off"
              required
            />
            <small>
              由 SETUP_TOKEN 环境变量或数据卷 setup-token 文件提供。
            </small>
          </label>
        )}
        <label>
          访问口令
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={setup ? "new-password" : "current-password"}
            minLength={setup ? 12 : undefined}
            maxLength={1024}
            required
            autoFocus
          />
        </label>
        {setup && (
          <label>
            确认口令
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              minLength={12}
              required
              autoComplete="new-password"
            />
          </label>
        )}
        {(error || auth.error) && (
          <p className="error-text" role="alert">
            {error || auth.error?.message}
          </p>
        )}
        <Button
          disabled={login.isPending || auth.isPending || !!auth.error}
          type="submit"
        >
          {login.isPending ? "正在验证…" : setup ? "设置并进入" : "进入资源台"}
          <ArrowRight size={15} />
        </Button>
        <div className="auth-foot">
          <ShieldCheck size={14} />
          仅限本人访问 · 数据保存在自己的服务器
        </div>
      </form>
    </div>
  );
}
