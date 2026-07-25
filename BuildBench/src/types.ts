export type Mode = "debug" | "release";

export type Action =
  | "android_build"
  | "android_install"
  | "flutter_test"
  | "flutter_clean"
  | "flutter_doctor"
  | "harmony_build"
  | "harmony_install";

export type Config = {
  project_path: string;
  flutter_path: string;
  adb_path: string;
  hdc_path: string;
  android_device_id: string;
  harmony_device_id: string;
  remote_token: string;
};

export type Device = {
  id: string;
  name: string;
  state: string;
  connection: string;
  platform: "android" | "harmony";
};

export type ToolStatus = { name: string; available: boolean; detail: string };

export type LogLevel = "info" | "success" | "error" | "command";

export type LogItem = {
  time: string;
  message: string;
  level: LogLevel;
};

export type RemoteInfo = { address: string; port: number; token: string };

export type RemoteLink = { online: boolean; last_seen_ms: number };

export const emptyConfig: Config = {
  project_path: "",
  flutter_path: "",
  adb_path: "",
  hdc_path: "",
  android_device_id: "",
  harmony_device_id: "",
  remote_token: "",
};
