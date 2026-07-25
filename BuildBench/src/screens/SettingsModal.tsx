import { Check, CircleAlert, Copy, FolderOpen, Settings, Wifi, X } from "lucide-react";
import type { Config, RemoteInfo } from "../types";

export function SettingsModal({
  draft,
  remoteInfo,
  copiedKey,
  onClose,
  onSave,
  onPickProject,
  onPickToolPath,
  onDraftChange,
  onCopyText,
}: {
  draft: Config;
  remoteInfo: RemoteInfo | null;
  copiedKey: "address" | "token" | null;
  onClose: () => void;
  onSave: () => void;
  onPickProject: () => void;
  onPickToolPath: (field: "flutter_path" | "adb_path" | "hdc_path", title: string) => void;
  onDraftChange: (next: Config) => void;
  onCopyText: (key: "address" | "token", value: string) => void;
}) {
  return (
    <div className="modal-backdrop">
      <section className="settings-modal" role="dialog" aria-modal="true" aria-label="工具设置">
        <div className="modal-header">
          <div>
            <Settings size={21} />
            <h2>工具设置</h2>
          </div>
          <button className="icon-button subtle" onClick={onClose} aria-label="关闭设置">
            <X size={20} />
          </button>
        </div>
        <p className="modal-copy">
          路径留空时，工具会自动搜索系统 PATH、ANDROID_HOME 与常见安装目录。
        </p>

        <label>
          Flutter 项目目录
          <div className="path-picker">
            <input
              value={draft.project_path}
              onChange={(event) =>
                onDraftChange({ ...draft, project_path: event.target.value })
              }
              placeholder="例如 D:\\Projects\\my_flutter_app"
            />
            <button onClick={onPickProject} aria-label="选择项目目录">
              <FolderOpen size={18} />
            </button>
          </div>
        </label>

        <label>
          Flutter 命令或完整路径
          <div className="path-picker">
            <input
              value={draft.flutter_path}
              onChange={(event) =>
                onDraftChange({ ...draft, flutter_path: event.target.value })
              }
              placeholder="flutter 或 C:\\src\\flutter\\bin\\flutter.bat"
            />
            <button
              onClick={() => onPickToolPath("flutter_path", "选择 Flutter 可执行文件")}
              aria-label="选择 Flutter"
            >
              <FolderOpen size={18} />
            </button>
          </div>
        </label>

        <label>
          ADB 命令或完整路径
          <div className="path-picker">
            <input
              value={draft.adb_path}
              onChange={(event) => onDraftChange({ ...draft, adb_path: event.target.value })}
              placeholder="adb 或 C:\\Android\\Sdk\\platform-tools\\adb.exe"
            />
            <button
              onClick={() => onPickToolPath("adb_path", "选择 adb.exe")}
              aria-label="选择 ADB"
            >
              <FolderOpen size={18} />
            </button>
          </div>
        </label>

        <label>
          HDC 命令或完整路径（可选）
          <div className="path-picker">
            <input
              value={draft.hdc_path}
              onChange={(event) => onDraftChange({ ...draft, hdc_path: event.target.value })}
              placeholder="hdc 或 DevEco SDK 的 hdc.exe"
            />
            <button
              onClick={() => onPickToolPath("hdc_path", "选择 hdc.exe")}
              aria-label="选择 HDC"
            >
              <FolderOpen size={18} />
            </button>
          </div>
        </label>

        <div className="remote-panel">
          <Wifi size={18} />
          <div>
            <strong>手机遥控连接</strong>
            <div className="copy-row">
              <code>{remoteInfo?.address || "服务启动后显示地址"}</code>
              <button
                type="button"
                className="copy-button"
                disabled={!remoteInfo?.address}
                onClick={() => onCopyText("address", remoteInfo?.address || "")}
                aria-label="复制地址"
              >
                {copiedKey === "address" ? <Check size={15} /> : <Copy size={15} />}
              </button>
            </div>
            <div className="copy-row">
              <code>配对令牌：{remoteInfo?.token || "--------"}</code>
              <button
                type="button"
                className="copy-button"
                disabled={!remoteInfo?.token}
                onClick={() => onCopyText("token", remoteInfo?.token || "")}
                aria-label="复制令牌"
              >
                {copiedKey === "token" ? <Check size={15} /> : <Copy size={15} />}
              </button>
            </div>
          </div>
        </div>

        <div className="settings-hint">
          <CircleAlert size={16} />
          手机和电脑需在同一局域网。若手机连不上，请允许 Windows 防火墙放行本程序。
        </div>

        <div className="modal-actions">
          <button className="secondary-button" onClick={onClose}>
            取消
          </button>
          <button className="save-button" onClick={onSave}>
            保存设置
          </button>
        </div>
      </section>
    </div>
  );
}
