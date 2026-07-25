use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};
use tauri::{AppHandle, Manager, State};

use crate::AppState;

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(default)]
pub struct AppConfig {
    pub project_path: String,
    pub flutter_path: String,
    pub adb_path: String,
    pub hdc_path: String,
    pub android_device_id: String,
    pub harmony_device_id: String,
    pub remote_token: String,
}

pub(crate) fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = app
        .path()
        .app_config_dir()
        .map_err(|error| format!("无法定位配置目录：{error}"))?;
    fs::create_dir_all(&directory).map_err(|error| format!("无法创建配置目录：{error}"))?;
    Ok(directory.join("settings.json"))
}

pub(crate) fn load_config(app: &AppHandle) -> AppConfig {
    config_path(app)
        .ok()
        .and_then(|path| fs::read_to_string(path).ok())
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or_default()
}

pub(crate) fn save_config_file(app: &AppHandle, config: &AppConfig) -> Result<(), String> {
    let json = serde_json::to_string_pretty(config)
        .map_err(|error| format!("无法序列化设置：{error}"))?;
    fs::write(config_path(app)?, json).map_err(|error| format!("无法写入设置：{error}"))
}

#[tauri::command]
pub(crate) fn get_config(state: State<'_, AppState>) -> AppConfig {
    state.config.lock().expect("config lock poisoned").clone()
}

#[tauri::command]
pub(crate) fn save_config(
    app: AppHandle,
    state: State<'_, AppState>,
    config: AppConfig,
) -> Result<AppConfig, String> {
    save_config_file(&app, &config)?;
    *state.config.lock().map_err(|_| "配置被占用".to_owned())? = config.clone();
    Ok(config)
}
