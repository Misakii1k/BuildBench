import {
  BadgeCheck,
  Braces,
  Code2,
  Download,
  Eraser,
  Hammer,
  HeartPulse,
  PackageCheck,
  Smartphone,
  TestTube2,
  Wrench,
} from "lucide-react";
import { ActionButton } from "../components/ActionButton";
import { ConnectionBanner } from "../components/ConnectionBanner";
import { DeviceCard } from "../components/DeviceCard";
import type {
  BuildMode,
  ConnectionState,
  RemoteDevices,
  RemoteStatus,
  TaskAction,
} from "../types";

interface HomeScreenProps {
  connection: ConnectionState;
  status: RemoteStatus | null;
  devices: RemoteDevices;
  mode: BuildMode;
  submittingTask: TaskAction | null;
  onModeChange: (mode: BuildMode) => void;
  onRunTask: (action: TaskAction) => void;
  onOpenSettings: () => void;
}

export function HomeScreen({
  connection,
  status,
  devices,
  mode,
  submittingTask,
  onModeChange,
  onRunTask,
  onOpenSettings,
}: HomeScreenProps) {
  const connected = connection.kind === "online";
  const busy = Boolean(status?.running || submittingTask);
  const tools = status?.tools || [];
  const flutterReady = tools.find((item) => item.name === "Flutter")?.available ?? false;
  const adbReady = tools.find((item) => item.name === "ADB")?.available ?? false;
  const hdcReady = tools.find((item) => item.name === "HDC")?.available ?? false;
  const controlsDisabled = !connected || busy;

  return (
    <main className="screen home-screen">
      <ConnectionBanner connection={connection} onOpenSettings={onOpenSettings} />

      <section className="project-overview" aria-labelledby="project-title">
        <div className="overview-topline">
          <span>当前项目</span>
          <span className={status?.running ? "task-state running" : "task-state"}>
            {status?.running ? "任务执行中" : connected ? "执行端空闲" : "等待连接"}
          </span>
        </div>
        <div className="project-title-row">
          <div>
            <h1 id="project-title">{status?.project_name || "未获取项目"}</h1>
            <p>{status ? `Windows BuildBench v${status.version}` : "Windows 构建执行端"}</p>
          </div>
          <span className={connected ? "overview-mark online" : "overview-mark"}>
            {connected ? <BadgeCheck size={25} /> : <Braces size={25} />}
          </span>
        </div>
      </section>

      {connected ? (
        <section className="content-section" aria-labelledby="tools-title">
          <div className="section-heading">
            <div>
              <Wrench size={20} aria-hidden="true" />
              <h2 id="tools-title">电脑端工具</h2>
            </div>
            <span>
              {[flutterReady, adbReady, hdcReady].filter(Boolean).length}/3 可用
            </span>
          </div>
          <div className="tool-status-grid">
            {[
              { name: "Flutter", ready: flutterReady },
              { name: "ADB", ready: adbReady },
              { name: "HDC", ready: hdcReady },
            ].map((item) => (
              <div key={item.name} className={`tool-status-chip ${item.ready ? "ok" : "bad"}`}>
                <strong>{item.name}</strong>
                <span>{item.ready ? "可用" : "未配置"}</span>
              </div>
            ))}
          </div>
          {!flutterReady ? (
            <p className="tool-hint">
              电脑未配置 Flutter 时，构建/测试按钮会禁用。可在桌面端设置里填写路径。
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="content-section" aria-labelledby="devices-title">
        <div className="section-heading">
          <div>
            <Smartphone size={20} aria-hidden="true" />
            <h2 id="devices-title">设备状态</h2>
          </div>
          <span>{devices.android.length + devices.harmony.length} 台</span>
        </div>
        <div className="device-grid">
          <DeviceCard
            title="Android"
            platform="android"
            devices={devices.android}
            icon={Smartphone}
          />
          <DeviceCard
            title="鸿蒙"
            platform="harmony"
            devices={devices.harmony}
            icon={HeartPulse}
          />
        </div>
      </section>

      <section className="content-section" aria-labelledby="actions-title">
        <div className="section-heading action-heading">
          <div>
            <Download size={20} aria-hidden="true" />
            <h2 id="actions-title">构建与测试</h2>
          </div>
          <div className="mode-switch" aria-label="构建模式">
            <button
              type="button"
              className={mode === "debug" ? "active" : ""}
              aria-pressed={mode === "debug"}
              onClick={() => onModeChange("debug")}
            >
              Debug
            </button>
            <button
              type="button"
              className={mode === "release" ? "active" : ""}
              aria-pressed={mode === "release"}
              onClick={() => onModeChange("release")}
            >
              Release
            </button>
          </div>
        </div>

        <div className="primary-actions">
          <ActionButton
            icon={Download}
            title="Android APK"
            description={
              flutterReady && adbReady
                ? "构建并安装到 Android 设备"
                : "需要电脑端 Flutter + ADB"
            }
            tone="android"
            disabled={controlsDisabled || !flutterReady || !adbReady}
            busy={submittingTask === "android_install"}
            onClick={() => onRunTask("android_install")}
          />
          <ActionButton
            icon={PackageCheck}
            title="鸿蒙 HAP"
            description={hdcReady ? "构建并安装到鸿蒙设备" : "需要电脑端 HDC"}
            tone="harmony"
            disabled={controlsDisabled || !hdcReady}
            busy={submittingTask === "harmony_install"}
            onClick={() => onRunTask("harmony_install")}
          />
        </div>

        <div className="utility-actions">
          <ActionButton
            icon={TestTube2}
            title="运行测试"
            description="flutter test"
            disabled={controlsDisabled || !flutterReady}
            busy={submittingTask === "flutter_test"}
            compact
            onClick={() => onRunTask("flutter_test")}
          />
          <ActionButton
            icon={Eraser}
            title="清理缓存"
            description="flutter clean"
            disabled={controlsDisabled || !flutterReady}
            busy={submittingTask === "flutter_clean"}
            compact
            onClick={() => onRunTask("flutter_clean")}
          />
          <ActionButton
            icon={HeartPulse}
            title="环境检查"
            description="flutter doctor -v"
            disabled={!connected || busy || !flutterReady}
            busy={submittingTask === "flutter_doctor"}
            compact
            onClick={() => onRunTask("flutter_doctor")}
          />
        </div>
      </section>

      <section className="content-section" aria-labelledby="build-title">
        <div className="section-heading">
          <div>
            <Hammer size={20} aria-hidden="true" />
            <h2 id="build-title">编译构建</h2>
          </div>
        </div>
        <div className="primary-actions">
          <ActionButton
            icon={Smartphone}
            title="Android APK"
            description={flutterReady ? "仅构建 APK" : "需要电脑端 Flutter"}
            tone="android"
            disabled={!flutterReady || submittingTask !== null}
            busy={submittingTask === "android_build"}
            onClick={() => onRunTask("android_build")}
          />
          <ActionButton
            icon={Code2}
            title="鸿蒙 HAP"
            description="仅构建 HAP"
            tone="harmony"
            disabled={submittingTask !== null}
            busy={submittingTask === "harmony_build"}
            onClick={() => onRunTask("harmony_build")}
          />
        </div>
      </section>
    </main>
  );
}
