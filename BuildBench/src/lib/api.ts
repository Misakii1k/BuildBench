import { invoke } from "@tauri-apps/api/core";
import type {
  Action,
  Config,
  Device,
  Mode,
  RemoteInfo,
  RemoteLink,
  ToolStatus,
} from "../types";

export const getConfig = (): Promise<Config> => invoke<Config>("get_config");

export const saveConfig = (config: Config): Promise<Config> =>
  invoke<Config>("save_config", { config });

export const getRemoteInfo = (): Promise<RemoteInfo> =>
  invoke<RemoteInfo>("get_remote_info");

export const getRemoteLink = (): Promise<RemoteLink> =>
  invoke<RemoteLink>("get_remote_link");

export const inspectEnvironment = (): Promise<ToolStatus[]> =>
  invoke<ToolStatus[]>("inspect_environment");

export const listAndroidDevices = (): Promise<Device[]> =>
  invoke<Device[]>("list_android_devices");

export const listHarmonyDevices = (): Promise<Device[]> =>
  invoke<Device[]>("list_harmony_devices");

export const runTask = (action: Action, mode: Mode): Promise<void> =>
  invoke<void>("run_task", { action, mode });
