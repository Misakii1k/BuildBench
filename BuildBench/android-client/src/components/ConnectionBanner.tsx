import { CircleAlert, CloudOff, KeyRound, LoaderCircle, Settings2, WifiOff } from "lucide-react";
import type { ConnectionState } from "../types";

interface ConnectionBannerProps {
  connection: ConnectionState;
  onOpenSettings: () => void;
}

export function ConnectionBanner({ connection, onOpenSettings }: ConnectionBannerProps) {
  if (connection.kind === "online") {
    return null;
  }

  const presentation = {
    unconfigured: { icon: Settings2, title: "连接尚未配置", tone: "info" },
    connecting: { icon: LoaderCircle, title: "正在连接", tone: "info" },
    offline: { icon: WifiOff, title: "手机网络离线", tone: "warning" },
    unauthorized: { icon: KeyRound, title: "配对令牌无效", tone: "danger" },
    network_error: { icon: CloudOff, title: "Windows 服务不可达", tone: "warning" },
    server_error: { icon: CircleAlert, title: "Windows 服务异常", tone: "danger" },
    online: { icon: CircleAlert, title: "", tone: "info" },
  }[connection.kind];
  const Icon = presentation.icon;

  return (
    <div className={`connection-banner banner-${presentation.tone}`} role="status">
      <Icon
        className={connection.kind === "connecting" ? "spin" : ""}
        size={20}
        aria-hidden="true"
      />
      <div>
        <strong>{presentation.title}</strong>
        <span>{connection.message}</span>
      </div>
      <button type="button" onClick={onOpenSettings}>
        配置
      </button>
    </div>
  );
}

