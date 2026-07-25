import { useEffect, useMemo, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import {
  getConfig,
  getRemoteInfo,
  getRemoteLink,
  inspectEnvironment,
  listAndroidDevices,
  listHarmonyDevices,
  runTask as runTaskApi,
  saveConfig,
} from "../lib/api";
import type {
  Action,
  Config,
  Device,
  LogItem,
  LogLevel,
  Mode,
  RemoteInfo,
  ToolStatus,
} from "../types";
import { emptyConfig } from "../types";

const now = () =>
  new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());

export function useBuildBench() {
  const [config, setConfig] = useState<Config>(emptyConfig);
  const [draft, setDraft] = useState<Config>(emptyConfig);
  const [android, setAndroid] = useState<Device[]>([]);
  const [harmony, setHarmony] = useState<Device[]>([]);
  const [tools, setTools] = useState<ToolStatus[]>([]);
  const [logs, setLogs] = useState<LogItem[]>([
    { time: now(), message: "本地构建台准备就绪。", level: "success" },
    { time: now(), message: "请选择项目目录，然后刷新设备。", level: "info" },
  ]);
  const [running, setRunning] = useState(false);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [mode, setMode] = useState<Mode>("debug");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [remoteInfo, setRemoteInfo] = useState<RemoteInfo | null>(null);
  const [phoneOnline, setPhoneOnline] = useState(false);
  const [copiedKey, setCopiedKey] = useState<"address" | "token" | null>(null);

  const log = (message: string, level: LogLevel = "info") =>
    setLogs((items) => [...items.slice(-499), { time: now(), message, level }]);

  const refreshEnvironment = async () => {
    try {
      setTools(await inspectEnvironment());
    } catch (error) {
      log(`环境检测失败：${String(error)}`, "error");
    }
  };

  const refreshDevices = async () => {
    setLoadingDevices(true);
    log("正在检测 Android 与鸿蒙设备…", "command");
    try {
      const [androidResult, harmonyResult] = await Promise.all([
        listAndroidDevices(),
        listHarmonyDevices(),
      ]);
      setAndroid(androidResult);
      setHarmony(harmonyResult);
      log(
        `检测完成：${androidResult.length} 台 Android，${harmonyResult.length} 台鸿蒙设备。`,
        "success",
      );
      if (androidResult.length === 0) {
        log(
          "未检测到 Android 设备。请确认 USB 调试已开启，或在设置中填写 ADB 完整路径。",
          "info",
        );
      }
    } catch (error) {
      log(`设备检测失败：${String(error)}`, "error");
    } finally {
      setLoadingDevices(false);
    }
  };

  useEffect(() => {
    void (async () => {
      try {
        const [saved, remote, link] = await Promise.all([
          getConfig(),
          getRemoteInfo(),
          getRemoteLink(),
        ]);
        setConfig(saved);
        setDraft(saved);
        setRemoteInfo(remote);
        setPhoneOnline(link.online);
      } catch {
        log("未能读取保存的配置，已使用默认设置。", "error");
      }
      await refreshEnvironment();
      await refreshDevices();
    })();

    const offLog = listen<{ message: string; level: LogLevel }>("build-log", (event) =>
      log(event.payload.message, event.payload.level),
    );
    const offState = listen<{ running: boolean }>("task-status", (event) => {
      setRunning(event.payload.running);
      if (!event.payload.running) void refreshDevices();
    });
    const offLink = listen<{ online: boolean }>("remote-link", (event) =>
      setPhoneOnline(event.payload.online),
    );
    return () => {
      void offLog.then((close) => close());
      void offState.then((close) => close());
      void offLink.then((close) => close());
    };
  }, []);

  const runTask = async (action: Action) => {
    if (!config.project_path && action !== "flutter_doctor") {
      log("请先在设置中选择项目目录。", "error");
      setSettingsOpen(true);
      return;
    }
    try {
      setRunning(true);
      await runTaskApi(action, mode);
    } catch (error) {
      setRunning(false);
      log(`无法启动任务：${String(error)}`, "error");
    }
  };

  const save = async () => {
    try {
      const saved = await saveConfig(draft);
      setConfig(saved);
      setDraft(saved);
      setSettingsOpen(false);
      log("设置已保存。", "success");
      await refreshEnvironment();
      await refreshDevices();
    } catch (error) {
      log(`设置保存失败：${String(error)}`, "error");
    }
  };

  const selectDevice = async (device: Device) => {
    const next: Config = {
      ...config,
      android_device_id: device.platform === "android" ? device.id : config.android_device_id,
      harmony_device_id: device.platform === "harmony" ? device.id : config.harmony_device_id,
    };
    setConfig(next);
    setDraft(next);
    try {
      await saveConfig(next);
      log(
        `已选择${device.platform === "android" ? " Android" : " 鸿蒙"}设备：${device.name}。`,
        "success",
      );
    } catch (error) {
      log(`无法保存设备选择：${String(error)}`, "error");
    }
  };

  const pickProject = async () => {
    const path = await open({ directory: true, multiple: false, title: "选择 Flutter 项目目录" });
    if (typeof path === "string") setDraft((current) => ({ ...current, project_path: path }));
  };

  const pickToolPath = async (
    field: "flutter_path" | "adb_path" | "hdc_path",
    title: string,
  ) => {
    const path = await open({
      multiple: false,
      title,
      filters: [{ name: "可执行文件", extensions: ["exe", "bat", "cmd"] }],
    });
    if (typeof path === "string") setDraft((current) => ({ ...current, [field]: path }));
  };

  const copyText = async (key: "address" | "token", value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 1_600);
      log(key === "address" ? "连接地址已复制。" : "配对令牌已复制。", "success");
    } catch {
      log("复制失败，请手动选择文本。", "error");
    }
  };

  const ready = (name: string) =>
    tools.find((item) => item.name === name)?.available ?? false;

  const projectName = useMemo(
    () => config.project_path.split(/[\\/]/).filter(Boolean).pop() || "未选择项目",
    [config.project_path],
  );

  const selectedAndroid =
    android.find((item) => item.id === config.android_device_id) || android[0];
  const selectedHarmony =
    harmony.find((item) => item.id === config.harmony_device_id) || harmony[0];

  const toolSummary = tools
    .map((item) => `${item.name}${item.available ? "✓" : "×"}`)
    .join("  ");

  return {
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
    log,
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
  };
}
