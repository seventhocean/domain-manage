import { QueryClient } from "@tanstack/react-query";
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const payload = await response
    .json()
    .catch(() => ({ error: "服务器返回了无法读取的结果" }));
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith("/api/auth/"))
      window.location.assign("/login");
    throw new ApiError(payload.error || "请求失败", response.status);
  }
  return payload;
}
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15000,
      retry: (count, error) =>
        error instanceof ApiError && error.status < 500 ? false : count < 1,
      refetchOnWindowFocus: true,
    },
  },
});
export function refresh() {
  return queryClient.invalidateQueries();
}
export const json = (method: string, data?: unknown): RequestInit => ({
  method,
  body: data === undefined ? undefined : JSON.stringify(data),
});

import type { Project, Resource } from "../../../packages/contracts";
export const resourceQuery = {
  queryKey: ["resources"],
  queryFn: () => api<Resource[]>("/api/cmdb/resources"),
};
export const projectQuery = {
  queryKey: ["projects"],
  queryFn: () => api<Project[]>("/api/cmdb/projects"),
};
