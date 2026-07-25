import { useEffect, useState } from "react";
import { Eye, EyeOff, KeyRound, Link2, LoaderCircle, Save, Trash2, WandSparkles } from "lucide-react";
import type { ConnectionConfig, ConnectionState } from "../types";

interface SettingsScreenProps {
  config: ConnectionConfig;
  connection: ConnectionState;
  onSave: (config: ConnectionConfig) => Promise<boolean>;
  onClear: () => Promise<void>;
}

export function SettingsScreen({ config, connection, onSave, onClear }: SettingsScreenProps) {
  const [draft, setDraft] = useState(config);
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => setDraft(config), [config]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
    }
  };

  const fillExample = () => {
    setDraft((current) => ({
      serviceUrl: current.serviceUrl.trim() || "http://192.168.1.110:48484",
      token: current.token,
    }));
  };

  return (
    <main className="screen settings-screen">
      <div className="screen-titlebar settings-titlebar">
        <div>
          <span className={`settings-state state-${connection.kind}`}>
            <i />
            {connection.kind === "online" ? "已连接" : "未连接"}
          </span>
          <h1>连接设置</h1>
          <p>{connection.message}</p>
        </div>
      </div>

      <section className="settings-form" aria-label="Windows 服务连接配置">
        <label htmlFor="service-url">Windows 服务地址</label>
        <div className="input-shell">
          <Link2 size={19} aria-hidden="true" />
          <input
            id="service-url"
            type="url"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="http://192.168.1.10:48484"
            value={draft.serviceUrl}
            onChange={(event) =>
              setDraft((current) => ({ ...current, serviceUrl: event.target.value }))
            }
          />
        </div>

        <label htmlFor="pairing-token">配对令牌</label>
        <div className="input-shell">
          <KeyRound size={19} aria-hidden="true" />
          <input
            id="pairing-token"
            type={showToken ? "text" : "password"}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="输入 Windows 端显示的令牌"
            value={draft.token}
            onChange={(event) =>
              setDraft((current) => ({ ...current, token: event.target.value }))
            }
          />
          <button
            type="button"
            title={showToken ? "隐藏令牌" : "显示令牌"}
            aria-label={showToken ? "隐藏令牌" : "显示令牌"}
            onClick={() => setShowToken((visible) => !visible)}
          >
            {showToken ? <EyeOff size={19} /> : <Eye size={19} />}
          </button>
        </div>

        <button className="example-fill-button" type="button" onClick={fillExample}>
          <WandSparkles size={18} />
          填入本机常见地址示例
        </button>

        <button
          className="save-button"
          type="button"
          disabled={saving || !draft.serviceUrl.trim() || !draft.token.trim()}
          onClick={() => void handleSave()}
        >
          {saving ? <LoaderCircle className="spin" size={20} /> : <Save size={20} />}
          保存并连接
        </button>

        <button
          className="clear-config-button"
          type="button"
          disabled={!config.serviceUrl && !config.token}
          onClick={() => void onClear()}
        >
          <Trash2 size={18} />
          清除连接配置
        </button>
      </section>

      <section className="endpoint-list" aria-label="服务接口状态">
        <div>
          <span>状态轮询</span>
          <code>/api/status</code>
        </div>
        <div>
          <span>设备轮询</span>
          <code>/api/devices</code>
        </div>
        <div>
          <span>增量日志</span>
          <code>/api/logs?after=</code>
        </div>
        <small>轮询间隔 1.5 秒 · 手机与电脑需同一 WiFi</small>
      </section>
    </main>
  );
}
