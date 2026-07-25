import {
  Activity, ArchiveX, ClipboardList, Code2, Hammer, LoaderCircle, PackageCheck, Play,
  RefreshCw, Settings, ShieldCheck, Smartphone, Sparkles, Terminal, Trash2, Wifi, Wrench,
} from "lucide-react";
import { ActionButton } from "../components/ActionButton";
import { DeviceCard } from "../components/DeviceCard";
import { useBuildBench } from "../hooks/useBuildBench";
import { SettingsModal } from "./SettingsModal";

export function MainScreen() {
  const {
    config,
    draft,
    setDraft,
    android,
    harmony,
    tools,
    logs,
    setLogs,
    running,
    loadingDevices,
    mode,
    setMode,
    settingsOpen,
    setSettingsOpen,
    remoteInfo,
    phoneOnline,
    copiedKey,
    refreshEnvironment,
    refreshDevices,
    runTask,
    save,
    selectDevice,
    pickProject,
    pickToolPath,
    copyText,
    ready,
    projectName,
    selectedAndroid,
    selectedHarmony,
    toolSummary,
  } = useBuildBench();

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <Smartphone size={26} />
            <Wrench size={15} />
          </div>
          <div>
            <h1>本地构建台</h1>
            <p>{projectName}</p>
          </div>
        </div>
        <div className="top-actions">
          <span className={`run-state ${running ? "is-running" : ""}`}>
            {running ? <LoaderCircle size={15} className="spin" /> : <ShieldCheck size={16} />}
            {running ? "任务执行中" : "就绪"}
          </span>
          <span className={`phone-state ${phoneOnline ? "online" : "offline"}`}>
            <Wifi size={15} />
            {phoneOnline ? "手机已连接" : "手机未连接"}
          </span>
          <button
            className="icon-button"
            onClick={() => setSettingsOpen(true)}
            aria-label="打开设置"
          >
            <Settings size={22} />
          </button>
        </div>
      </header>

      <section className="workspace">
        <div className="control-pane">
          <section className="section-block">
            <div className="section-heading">
              <div>
                <Wrench size={21} />
                <h2>工具状态</h2>
              </div>
              <button className="text-button" onClick={() => void refreshEnvironment()}>
                <RefreshCw size={17} /> 检测
              </button>
            </div>
            <div className="tool-grid">
              {["Flutter", "ADB", "HDC"].map((name) => {
                const tool = tools.find((item) => item.name === name);
                const available = tool?.available ?? false;
                return (
                  <div key={name} className={`tool-chip ${available ? "ok" : "bad"}`}>
                    <strong>{name}</strong>
                    <span>{available ? "可用" : "未配置"}</span>
                    <small title={tool?.detail || ""}>
                      {tool?.detail || "尚未检测"}
                    </small>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="section-block">
            <div className="section-heading">
              <div>
                <Smartphone size={21} />
                <h2>设备状态</h2>
              </div>
              <button
                className="text-button"
                onClick={() => void refreshDevices()}
                disabled={loadingDevices}
              >
                <RefreshCw size={17} className={loadingDevices ? "spin" : ""} /> 刷新
              </button>
            </div>
            <div className="device-grid">
              <DeviceCard
                platform="android"
                device={selectedAndroid}
                total={android.length}
                ready={ready("ADB")}
                selectedId={config.android_device_id}
                onSelect={selectDevice}
              />
              <DeviceCard
                platform="harmony"
                device={selectedHarmony}
                total={harmony.length}
                ready={ready("HDC")}
                selectedId={config.harmony_device_id}
                onSelect={selectDevice}
              />
            </div>
            {android.length > 1 ? (
              <div className="device-list-inline">
                {android.map((device) => (
                  <button
                    key={device.id}
                    className={config.android_device_id === device.id ? "selected" : ""}
                    onClick={() => void selectDevice(device)}
                  >
                    {device.name}
                  </button>
                ))}
              </div>
            ) : null}
          </section>

          <section className="section-block">
            <div className="section-heading">
              <div>
                <Sparkles size={21} />
                <h2>快速操作</h2>
              </div>
            </div>
            <ActionButton
              className="primary-action"
              icon={<Play size={23} />}
              title="Android APK"
              description="构建并安装到已选设备"
              disabled={!ready("Flutter") || !ready("ADB") || running}
              onClick={() => void runTask("android_install")}
            />
            <div className="action-row">
              <ActionButton
                icon={<Activity size={21} />}
                title="运行测试"
                description="flutter test"
                disabled={!ready("Flutter") || running}
                onClick={() => void runTask("flutter_test")}
              />
              <ActionButton
                icon={<PackageCheck size={21} />}
                title="鸿蒙 HAP"
                description="构建并安装"
                disabled={!ready("HDC") || running}
                onClick={() => void runTask("harmony_install")}
              />
            </div>
          </section>

          <section className="section-block">
            <div className="section-heading">
              <div>
                <Hammer size={21} />
                <h2>编译构建</h2>
              </div>
            </div>
            <div className="build-mode">
              <span>模式</span>
              <button
                className={mode === "debug" ? "selected" : ""}
                onClick={() => setMode("debug")}
              >
                Debug
              </button>
              <button
                className={mode === "release" ? "selected" : ""}
                onClick={() => setMode("release")}
              >
                Release
              </button>
            </div>
            <div className="action-row">
              <ActionButton
                icon={<Smartphone size={22} />}
                title="Android APK"
                description="仅构建 APK"
                disabled={!ready("Flutter") || running}
                onClick={() => void runTask("android_build")}
              />
              <ActionButton
                icon={<Code2 size={22} />}
                title="鸿蒙 HAP"
                description="仅构建 HAP"
                disabled={running}
                onClick={() => void runTask("harmony_build")}
              />
            </div>
          </section>

          <section className="section-block compact-section">
            <div className="section-heading">
              <div>
                <Wrench size={21} />
                <h2>工具</h2>
              </div>
            </div>
            <div className="action-row">
              <ActionButton
                icon={<ArchiveX size={21} />}
                title="清理缓存"
                description="flutter clean"
                disabled={!ready("Flutter") || running}
                onClick={() => void runTask("flutter_clean")}
              />
              <ActionButton
                icon={<ClipboardList size={21} />}
                title="环境检查"
                description="flutter doctor -v"
                disabled={!ready("Flutter") || running}
                onClick={() => void runTask("flutter_doctor")}
              />
            </div>
          </section>
        </div>

        <aside className="log-pane">
          <div className="log-toolbar">
            <div>
              <Terminal size={20} />
              <h2>构建日志</h2>
            </div>
            <button
              className="icon-button subtle"
              onClick={() => setLogs([])}
              aria-label="清空日志"
            >
              <Trash2 size={19} />
            </button>
          </div>
          <div className="log-list" aria-live="polite">
            {logs.length === 0 ? (
              <div className="empty-logs">日志将在此显示。</div>
            ) : (
              logs.map((item, index) => (
                <div className={`log-line ${item.level}`} key={`${item.time}-${index}`}>
                  <time>{item.time}</time>
                  <span>{item.message}</span>
                </div>
              ))
            )}
          </div>
        </aside>
      </section>

      <footer className="statusbar">
        <span>
          <i className="status-dot" /> 本地执行，不上传项目代码
        </span>
        <span title={toolSummary || "工具未检测"}>
          {toolSummary || "Flutter / Android / HarmonyOS"}
        </span>
      </footer>

      {settingsOpen ? (
        <SettingsModal
          draft={draft}
          remoteInfo={remoteInfo}
          copiedKey={copiedKey}
          onClose={() => setSettingsOpen(false)}
          onSave={() => void save()}
          onPickProject={() => void pickProject()}
          onPickToolPath={pickToolPath}
          onDraftChange={setDraft}
          onCopyText={copyText}
        />
      ) : null}
    </main>
  );
}
