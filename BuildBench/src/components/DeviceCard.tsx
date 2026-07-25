import { Laptop, Smartphone } from "lucide-react";
import type { Device } from "../types";

export function DeviceCard({
  platform,
  device,
  total,
  ready,
  selectedId,
  onSelect,
}: {
  platform: "android" | "harmony";
  device?: Device;
  total: number;
  ready: boolean;
  selectedId: string;
  onSelect: (device: Device) => void;
}) {
  const online = Boolean(device) && device?.state === "device";
  const title = platform === "android" ? "Android 设备" : "鸿蒙设备";
  return (
    <button
      className={`device-card ${platform} ${online ? "online" : ""}`}
      disabled={!device}
      onClick={() => device && onSelect(device)}
    >
      <span className="device-icon">
        {platform === "android" ? <Smartphone size={37} /> : <Laptop size={37} />}
      </span>
      <strong>{title}</strong>
      <span className={online ? "online-label" : "offline-label"}>
        {online ? "在线" : ready ? "未连接" : "未配置"}
      </span>
      <small>
        {online
          ? `${device?.name} · ${device?.connection}`
          : total
            ? `${total} 台可用设备`
            : ready
              ? "请连接或开启无线调试"
              : "请安装工具或填写路径"}
      </small>
      {device && selectedId === device.id ? <b className="selected-badge">已选择</b> : null}
    </button>
  );
}
