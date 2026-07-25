import { CapacitorHttp, type HttpOptions } from "@capacitor/core";
import type {
  BuildMode,
  ConnectionConfig,
  RemoteDevices,
  RemoteLog,
  RemoteStatus,
  TaskAction,
} from "../types";

export type ApiErrorKind =
  | "invalid_config"
  | "offline"
  | "unauthorized"
  | "network"
  | "server";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;

  constructor(kind: ApiErrorKind, message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
  }
}

export function normalizeServiceUrl(rawValue: string): string {
  const value = rawValue.trim();
  if (!value) {
    throw new ApiError("invalid_config", "请输入 Windows 服务地址");
  }

  const candidate = /^https?:\/\//i.test(value) ? value : `http://${value}`;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new ApiError("invalid_config", "Windows 服务地址格式不正确");
  }

  if (!parsed.hostname || (parsed.protocol !== "http:" && parsed.protocol !== "https:")) {
    throw new ApiError("invalid_config", "Windows 服务地址仅支持 HTTP 或 HTTPS");
  }

  parsed.hash = "";
  parsed.search = "";
  return parsed.toString().replace(/\/$/, "");
}

function responseMessage(data: unknown, fallback: string): string {
  if (typeof data === "string" && data.trim()) {
    return data.trim();
  }
  if (data && typeof data === "object" && "message" in data) {
    const message = (data as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }
  }
  return fallback;
}

function parseResponse<T>(data: unknown): T {
  if (typeof data !== "string") {
    return data as T;
  }
  try {
    return JSON.parse(data) as T;
  } catch {
    return data as T;
  }
}

export class BuildBenchApi {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(config: ConnectionConfig) {
    this.baseUrl = normalizeServiceUrl(config.serviceUrl);
    this.token = config.token.trim();
    if (!this.token) {
      throw new ApiError("invalid_config", "请输入配对令牌");
    }
  }

  private async request<T>(
    path: string,
    method: "GET" | "POST" = "GET",
    data?: unknown,
  ): Promise<T> {
    const options: HttpOptions = {
      url: `${this.baseUrl}${path}`,
      method,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-BuildBench-Token": this.token,
      },
      connectTimeout: 5_000,
      readTimeout: 8_000,
      data,
    };

    try {
      const response = await CapacitorHttp.request(options);
      if (response.status === 401) {
        throw new ApiError("unauthorized", "配对令牌无效，请重新核对", 401);
      }
      if (response.status < 200 || response.status >= 300) {
        const fallback = `Windows 服务返回错误（${response.status}）`;
        throw new ApiError("server", responseMessage(response.data, fallback), response.status);
      }
      return parseResponse<T>(response.data);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        throw new ApiError("offline", "手机当前没有可用网络");
      }
      const detail = error instanceof Error ? error.message : "未知网络错误";
      throw new ApiError("network", `无法连接 Windows 服务：${detail}`);
    }
  }

  getStatus(): Promise<RemoteStatus> {
    return this.request<RemoteStatus>("/api/status");
  }

  getDevices(): Promise<RemoteDevices> {
    return this.request<RemoteDevices>("/api/devices");
  }

  getLogs(after: number): Promise<RemoteLog[]> {
    return this.request<RemoteLog[]>(`/api/logs?after=${after}`);
  }

  runTask(action: TaskAction, mode: BuildMode): Promise<{ accepted: boolean }> {
    return this.request<{ accepted: boolean }>(`/api/tasks/${action}`, "POST", { mode });
  }
}

