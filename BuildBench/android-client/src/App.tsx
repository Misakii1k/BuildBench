import { useEffect, useMemo, useState } from "react";
import { LoaderCircle, RefreshCw, Wrench } from "lucide-react";
import { BottomNav } from "./components/BottomNav";
import { useBuildBench } from "./hooks/useBuildBench";
import { ApiError, normalizeServiceUrl } from "./lib/api";
import {
  clearConnectionConfig,
  EMPTY_CONNECTION_CONFIG,
  loadConnectionConfig,
  saveConnectionConfig,
} from "./lib/storage";
import { HomeScreen } from "./screens/HomeScreen";
import { LogsScreen } from "./screens/LogsScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import type { AppTab, BuildMode, ConnectionConfig, TaskAction } from "./types";

const TASK_LABELS: Record<TaskAction, string> = {
  android_build: "仅构建 APK",
  android_install: "Android APK",
  flutter_test: "Flutter 测试",
  flutter_clean: "缓存清理",
  flutter_doctor: "环境检查",
  harmony_build: "仅构建 HAP",
  harmony_install: "鸿蒙 HAP",
};

interface ToastState {
  message: string;
  tone: "success" | "error";
}

export default function App() {
  const [config, setConfig] = useState<ConnectionConfig>(EMPTY_CONNECTION_CONFIG);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<AppTab>("home");
  const [mode, setMode] = useState<BuildMode>("debug");
  const [toast, setToast] = useState<ToastState | null>(null);
  const remote = useBuildBench(config);

  useEffect(() => {
    let active = true;
    void loadConnectionConfig()
      .then((stored) => {
        if (active) {
          setConfig(stored);
        }
      })
      .finally(() => {
        if (active) {
          setConfigLoaded(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timeoutId = window.setTimeout(() => setToast(null), 3_200);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  const connectionLabel = useMemo(() => {
    switch (remote.connection.kind) {
      case "online":
        return "在线";
      case "connecting":
        return "连接中";
      case "unauthorized":
        return "令牌错误";
      case "offline":
        return "网络离线";
      case "network_error":
        return "不可达";
      case "server_error":
        return "服务异常";
      default:
        return "未配置";
    }
  }, [remote.connection.kind]);

  const handleSaveConfig = async (draft: ConnectionConfig): Promise<boolean> => {
    try {
      const nextConfig = {
        serviceUrl: normalizeServiceUrl(draft.serviceUrl),
        token: draft.token.trim(),
      };
      if (!nextConfig.token) {
        throw new ApiError("invalid_config", "请输入配对令牌");
      }
      await saveConnectionConfig(nextConfig);
      setConfig(nextConfig);
      setActiveTab("home");
      setToast({ message: "连接配置已保存", tone: "success" });
      return true;
    } catch (error) {
      setToast({
        message: error instanceof Error ? error.message : "无法保存连接配置",
        tone: "error",
      });
      return false;
    }
  };

  const handleClearConfig = async () => {
    await clearConnectionConfig();
    setConfig(EMPTY_CONNECTION_CONFIG);
    setToast({ message: "连接配置已清除", tone: "success" });
  };

  const handleRunTask = async (action: TaskAction) => {
    try {
      await remote.runTask(action, mode);
      setToast({ message: `${TASK_LABELS[action]} 已提交`, tone: "success" });
    } catch (error) {
      setToast({
        message: error instanceof Error ? error.message : "任务提交失败",
        tone: "error",
      });
    }
  };

  if (!configLoaded) {
    return (
      <div className="app-loading">
        <LoaderCircle className="spin" size={30} />
        <span>正在载入 BuildBench</span>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-mark" aria-hidden="true">
          <Wrench size={21} strokeWidth={2.2} />
        </div>
        <div className="brand-copy">
          <strong>BuildBench</strong>
          <span>移动构建台</span>
        </div>
        <span className={`header-status status-${remote.connection.kind}`}>
          <i />
          {connectionLabel}
        </span>
        <button
          className="icon-button header-refresh"
          type="button"
          title="立即刷新"
          aria-label="立即刷新"
          disabled={remote.connection.kind === "unconfigured"}
          onClick={() => void remote.poll()}
        >
          <RefreshCw size={19} />
        </button>
      </header>

      {activeTab === "home" ? (
        <HomeScreen
          connection={remote.connection}
          status={remote.status}
          devices={remote.devices}
          mode={mode}
          submittingTask={remote.submittingTask}
          onModeChange={setMode}
          onRunTask={(action) => void handleRunTask(action)}
          onOpenSettings={() => setActiveTab("settings")}
        />
      ) : null}
      {activeTab === "logs" ? (
        <LogsScreen connection={remote.connection} logs={remote.logs} onClear={remote.clearLogs} />
      ) : null}
      {activeTab === "settings" ? (
        <SettingsScreen
          config={config}
          connection={remote.connection}
          onSave={handleSaveConfig}
          onClear={handleClearConfig}
        />
      ) : null}

      {toast ? <div className={`toast toast-${toast.tone}`}>{toast.message}</div> : null}
      <BottomNav activeTab={activeTab} logCount={remote.logs.length} onChange={setActiveTab} />
    </div>
  );
}

