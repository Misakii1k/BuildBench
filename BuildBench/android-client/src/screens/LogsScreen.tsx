import { useEffect, useRef } from "react";
import { Radio, Terminal, Trash2 } from "lucide-react";
import type { ConnectionState, RemoteLog } from "../types";

interface LogsScreenProps {
  connection: ConnectionState;
  logs: RemoteLog[];
  onClear: () => void;
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "--:--:--";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

export function LogsScreen({ connection, logs, onClear }: LogsScreenProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [logs]);

  return (
    <main className="screen logs-screen">
      <div className="screen-titlebar">
        <div>
          <span className={connection.kind === "online" ? "live-indicator online" : "live-indicator"}>
            <Radio size={15} aria-hidden="true" />
            {connection.kind === "online" ? "实时" : "已暂停"}
          </span>
          <h1>构建日志</h1>
          <p>{logs.length} 条本地显示记录</p>
        </div>
        <button
          className="icon-button"
          type="button"
          title="清空本地日志"
          aria-label="清空本地日志"
          disabled={logs.length === 0}
          onClick={onClear}
        >
          <Trash2 size={20} />
        </button>
      </div>

      <section className="log-console" aria-live="polite">
        {logs.length === 0 ? (
          <div className="empty-state">
            <Terminal size={30} aria-hidden="true" />
            <strong>暂无日志</strong>
            <span>新的构建输出会显示在这里</span>
          </div>
        ) : (
          logs.map((log) => (
            <div className={`log-entry log-${log.level}`} key={log.id}>
              <time>{formatTime(log.timestamp_ms)}</time>
              <span>{log.message}</span>
            </div>
          ))
        )}
        <div ref={endRef} />
      </section>
    </main>
  );
}

