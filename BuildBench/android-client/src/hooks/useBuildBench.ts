import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, BuildBenchApi } from "../lib/api";
import type {
  BuildMode,
  ConnectionConfig,
  ConnectionState,
  RemoteDevices,
  RemoteLog,
  RemoteStatus,
  TaskAction,
} from "../types";

const POLL_INTERVAL_MS = 1_500;
const MAX_VISIBLE_LOGS = 500;
const EMPTY_DEVICES: RemoteDevices = { android: [], harmony: [] };

function connectionFromError(error: unknown): ConnectionState {
  if (error instanceof ApiError) {
    switch (error.kind) {
      case "unauthorized":
        return { kind: "unauthorized", message: error.message };
      case "offline":
        return { kind: "offline", message: error.message };
      case "network":
        return { kind: "network_error", message: error.message };
      case "invalid_config":
        return { kind: "unconfigured", message: error.message };
      default:
        return { kind: "server_error", message: error.message };
    }
  }
  return { kind: "network_error", message: "无法连接 Windows 服务" };
}

export function useBuildBench(config: ConnectionConfig) {
  const [connection, setConnection] = useState<ConnectionState>({
    kind: "unconfigured",
    message: "请配置 Windows 服务地址和配对令牌",
  });
  const [status, setStatus] = useState<RemoteStatus | null>(null);
  const [devices, setDevices] = useState<RemoteDevices>(EMPTY_DEVICES);
  const [logs, setLogs] = useState<RemoteLog[]>([]);
  const [submittingTask, setSubmittingTask] = useState<TaskAction | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const lastLogIdRef = useRef(0);
  const pollingRef = useRef(false);
  const connectedOnceRef = useRef(false);

  const api = useMemo(() => {
    if (!config.serviceUrl.trim() || !config.token.trim()) {
      return null;
    }
    try {
      return new BuildBenchApi(config);
    } catch {
      return null;
    }
  }, [config.serviceUrl, config.token]);

  const poll = useCallback(async () => {
    if (!api || pollingRef.current) {
      return;
    }
    pollingRef.current = true;
    if (!connectedOnceRef.current) {
      setConnection({ kind: "connecting", message: "正在连接 Windows 服务" });
    }

    try {
      const [nextStatus, nextDevices, nextLogs] = await Promise.all([
        api.getStatus(),
        api.getDevices(),
        api.getLogs(lastLogIdRef.current),
      ]);
      setStatus(nextStatus);
      setDevices(nextDevices);
      if (nextLogs.length > 0) {
        lastLogIdRef.current = Math.max(
          lastLogIdRef.current,
          ...nextLogs.map((item) => item.id),
        );
        setLogs((current) => {
          const knownIds = new Set(current.map((item) => item.id));
          const merged = [...current, ...nextLogs.filter((item) => !knownIds.has(item.id))];
          return merged.slice(-MAX_VISIBLE_LOGS);
        });
      }
      connectedOnceRef.current = true;
      setLastUpdated(Date.now());
      setConnection({ kind: "online", message: "Windows 服务已连接" });
    } catch (error) {
      setConnection(connectionFromError(error));
    } finally {
      pollingRef.current = false;
    }
  }, [api]);

  useEffect(() => {
    lastLogIdRef.current = 0;
    connectedOnceRef.current = false;
    pollingRef.current = false;
    setStatus(null);
    setDevices(EMPTY_DEVICES);
    setLogs([]);
    setLastUpdated(null);

    if (!api) {
      setConnection({
        kind: "unconfigured",
        message: "请配置 Windows 服务地址和配对令牌",
      });
      return;
    }

    void poll();
    const intervalId = window.setInterval(() => void poll(), POLL_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [api, poll]);

  useEffect(() => {
    const handleOnline = () => void poll();
    const handleOffline = () =>
      setConnection({ kind: "offline", message: "手机当前没有可用网络" });
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [poll]);

  const runTask = useCallback(
    async (action: TaskAction, mode: BuildMode) => {
      if (!api) {
        throw new ApiError("invalid_config", "请先完成连接配置");
      }
      setSubmittingTask(action);
      try {
        await api.runTask(action, mode);
        window.setTimeout(() => void poll(), 250);
      } catch (error) {
        setConnection(connectionFromError(error));
        throw error;
      } finally {
        setSubmittingTask(null);
      }
    },
    [api, poll],
  );

  const clearLogs = useCallback(() => setLogs([]), []);

  return {
    connection,
    status,
    devices,
    logs,
    submittingTask,
    lastUpdated,
    poll,
    runTask,
    clearLogs,
  };
}

