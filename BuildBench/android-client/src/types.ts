export type BuildMode = "debug" | "release";

export type TaskAction =
  | "android_build"
  | "android_install"
  | "flutter_test"
  | "flutter_clean"
  | "flutter_doctor"
  | "harmony_build"
  | "harmony_install";

export type AppTab = "home" | "logs" | "settings";

export interface ConnectionConfig {
  serviceUrl: string;
  token: string;
}

export interface ToolStatus {
  name: string;
  available: boolean;
  detail: string;
}

export interface RemoteStatus {
  online: boolean;
  running: boolean;
  project_name: string;
  version: string;
  tools?: ToolStatus[];
}

export interface BuildDevice {
  id: string;
  name: string;
  state: string;
  connection: string;
  platform: string;
}

export interface RemoteDevices {
  android: BuildDevice[];
  harmony: BuildDevice[];
}

export interface RemoteLog {
  id: number;
  timestamp_ms: number;
  message: string;
  level: string;
}

export type ConnectionKind =
  | "unconfigured"
  | "connecting"
  | "online"
  | "offline"
  | "unauthorized"
  | "network_error"
  | "server_error";

export interface ConnectionState {
  kind: ConnectionKind;
  message: string;
}

