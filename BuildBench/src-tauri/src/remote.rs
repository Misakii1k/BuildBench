use axum::{
    extract::{Path as AxumPath, Query, State as AxumState},
    http::{HeaderMap, StatusCode},
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::{
    net::UdpSocket,
    path::Path,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, Manager, State};
use tower_http::cors::{Any, CorsLayer};

use crate::devices::{android_devices, harmony_devices, Device};
use crate::tasks::start_task;
use crate::tools::{inspect_tools, ToolStatus};
use crate::AppState;

const REMOTE_PORT: u16 = 48_484;

#[derive(Clone, Debug, Serialize)]
pub(crate) struct RemoteLog {
    pub(crate) id: u64,
    pub(crate) timestamp_ms: u128,
    pub(crate) message: String,
    pub(crate) level: String,
}

#[derive(Clone, Debug, Serialize)]
pub(crate) struct RemoteInfo {
    address: String,
    port: u16,
    token: String,
}

#[derive(Clone, Debug, Serialize)]
pub(crate) struct RemoteStatus {
    online: bool,
    running: bool,
    project_name: String,
    version: String,
    tools: Vec<ToolStatus>,
}

#[derive(Clone, Debug, Serialize)]
pub(crate) struct RemoteDevices {
    android: Vec<Device>,
    harmony: Vec<Device>,
}

#[derive(Clone, Debug, Deserialize)]
pub(crate) struct RemoteTaskRequest {
    mode: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
pub(crate) struct RemoteLogQuery {
    after: Option<u64>,
}

#[derive(Clone, Debug, Serialize)]
pub(crate) struct RemoteLinkState {
    online: bool,
    last_seen_ms: u64,
}

#[derive(Clone, Debug, Serialize)]
pub(crate) struct RemoteLinkEvent {
    pub(crate) online: bool,
}

pub(crate) fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |duration| duration.as_millis() as u64)
}

fn local_address() -> String {
    UdpSocket::bind("0.0.0.0:0")
        .and_then(|socket| {
            socket.connect("1.1.1.1:80")?;
            socket.local_addr()
        })
        .map(|address| address.ip().to_string())
        .unwrap_or_else(|_| "127.0.0.1".to_owned())
}

#[tauri::command]
pub(crate) fn get_remote_info(state: State<'_, AppState>) -> RemoteInfo {
    let config = state.config.lock().expect("config lock poisoned");
    RemoteInfo {
        address: format!("http://{}:{REMOTE_PORT}", local_address()),
        port: REMOTE_PORT,
        token: config.remote_token.clone(),
    }
}

fn remote_authorized(headers: &HeaderMap, app: &AppHandle) -> bool {
    let provided = headers
        .get("x-buildbench-token")
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default();
    let state = app.state::<AppState>();
    let ok = state
        .config
        .lock()
        .map(|config| !config.remote_token.is_empty() && provided == config.remote_token)
        .unwrap_or(false);
    if ok {
        if let Ok(mut seen) = state.last_remote_seen_ms.lock() {
            *seen = now_ms();
        }
        let _ = app.emit("remote-link", RemoteLinkEvent { online: true });
    }
    ok
}

pub(crate) fn remote_online(state: &AppState) -> bool {
    let last = state.last_remote_seen_ms.lock().map(|v| *v).unwrap_or(0);
    last != 0 && now_ms().saturating_sub(last) <= 6_000
}

#[tauri::command]
pub(crate) fn get_remote_link(state: State<'_, AppState>) -> RemoteLinkState {
    let last = state.last_remote_seen_ms.lock().map(|v| *v).unwrap_or(0);
    let online = last != 0 && now_ms().saturating_sub(last) <= 6_000;
    RemoteLinkState { online, last_seen_ms: last }
}

async fn remote_ping() -> Json<serde_json::Value> {
    Json(serde_json::json!({ "name": "BuildBench", "version": env!("CARGO_PKG_VERSION") }))
}

async fn remote_status(
    AxumState(app): AxumState<AppHandle>,
    headers: HeaderMap,
) -> Result<Json<RemoteStatus>, StatusCode> {
    if !remote_authorized(&headers, &app) {
        return Err(StatusCode::UNAUTHORIZED);
    }
    let state = app.state::<AppState>();
    let running = *state.running.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let config = state
        .config
        .lock()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .clone();
    let project_name = Path::new(&config.project_path)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("未选择项目")
        .to_owned();
    Ok(Json(RemoteStatus {
        online: true,
        running,
        project_name,
        version: env!("CARGO_PKG_VERSION").to_owned(),
        tools: inspect_tools(&config),
    }))
}

async fn remote_devices(
    AxumState(app): AxumState<AppHandle>,
    headers: HeaderMap,
) -> Result<Json<RemoteDevices>, StatusCode> {
    if !remote_authorized(&headers, &app) {
        return Err(StatusCode::UNAUTHORIZED);
    }
    let config = app
        .state::<AppState>()
        .config
        .lock()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .clone();
    Ok(Json(RemoteDevices {
        android: android_devices(&config),
        harmony: harmony_devices(&config),
    }))
}

async fn remote_logs(
    AxumState(app): AxumState<AppHandle>,
    headers: HeaderMap,
    Query(query): Query<RemoteLogQuery>,
) -> Result<Json<Vec<RemoteLog>>, StatusCode> {
    if !remote_authorized(&headers, &app) {
        return Err(StatusCode::UNAUTHORIZED);
    }
    let after = query.after.unwrap_or(0);
    let logs = app
        .state::<AppState>()
        .logs
        .lock()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .iter()
        .filter(|item| item.id > after)
        .cloned()
        .collect();
    Ok(Json(logs))
}

async fn remote_task(
    AxumState(app): AxumState<AppHandle>,
    headers: HeaderMap,
    AxumPath(action): AxumPath<String>,
    Json(request): Json<RemoteTaskRequest>,
) -> Result<(StatusCode, Json<serde_json::Value>), StatusCode> {
    if !remote_authorized(&headers, &app) {
        return Err(StatusCode::UNAUTHORIZED);
    }
    let allowed = matches!(
        action.as_str(),
        "android_build"
            | "android_install"
            | "flutter_test"
            | "flutter_clean"
            | "flutter_doctor"
            | "harmony_build"
            | "harmony_install"
    );
    if !allowed {
        return Err(StatusCode::NOT_FOUND);
    }
    let mode = request.mode.unwrap_or_else(|| "debug".to_owned());
    if mode != "debug" && mode != "release" {
        return Err(StatusCode::BAD_REQUEST);
    }
    start_task(app, action, mode).map_err(|error| {
        if error.contains("正在执行") {
            StatusCode::CONFLICT
        } else {
            StatusCode::BAD_REQUEST
        }
    })?;
    Ok((StatusCode::ACCEPTED, Json(serde_json::json!({ "accepted": true }))))
}

pub(crate) async fn run_remote_server(app: AppHandle) -> Result<(), String> {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);
    let router = Router::new()
        .route("/api/ping", get(remote_ping))
        .route("/api/status", get(remote_status))
        .route("/api/devices", get(remote_devices))
        .route("/api/logs", get(remote_logs))
        .route("/api/tasks/{action}", post(remote_task))
        .layer(cors)
        .with_state(app);
    let listener = tokio::net::TcpListener::bind(("0.0.0.0", REMOTE_PORT))
        .await
        .map_err(|error| format!("无法启动手机遥控服务：{error}"))?;
    axum::serve(listener, router)
        .await
        .map_err(|error| format!("手机遥控服务已停止：{error}"))
}
