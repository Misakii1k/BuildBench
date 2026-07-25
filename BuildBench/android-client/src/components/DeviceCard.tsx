import { Cable, MonitorSmartphone, Smartphone, type LucideIcon } from "lucide-react";
import type { BuildDevice } from "../types";

interface DeviceCardProps {
  title: string;
  platform: "android" | "harmony";
  devices: BuildDevice[];
  icon: LucideIcon;
}

function isDeviceOnline(device: BuildDevice): boolean {
  const state = device.state.toLowerCase();
  return state === "device" || state === "online" || state === "connected";
}

export function DeviceCard({ title, platform, devices, icon: Icon }: DeviceCardProps) {
  const onlineCount = devices.filter(isDeviceOnline).length;
  return (
    <article className={`device-card device-${platform}`}>
      <div className="device-card-head">
        <span className="device-platform-icon">
          <Icon size={22} strokeWidth={2.1} aria-hidden="true" />
        </span>
        <div>
          <h3>{title}</h3>
          <p>{onlineCount > 0 ? `${onlineCount} 台在线` : "未连接"}</p>
        </div>
        <i className={onlineCount > 0 ? "device-led online" : "device-led"} />
      </div>

      <div className="device-list">
        {devices.length === 0 ? (
          <div className="device-empty">
            <MonitorSmartphone size={19} aria-hidden="true" />
            <span>未检测到设备</span>
          </div>
        ) : (
          devices.map((device) => (
            <div className="device-row" key={`${platform}-${device.id}`}>
              {device.connection.toLowerCase().includes("usb") ? (
                <Cable size={16} aria-hidden="true" />
              ) : (
                <Smartphone size={16} aria-hidden="true" />
              )}
              <span title={device.id}>{device.name || device.id}</span>
              <small>{device.connection || device.state}</small>
            </div>
          ))
        )}
      </div>
    </article>
  );
}

