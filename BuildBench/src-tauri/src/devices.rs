use serde::Serialize;
use tauri::State;

use crate::config::AppConfig;
use crate::tools::{command_output, program};
use crate::AppState;

#[derive(Clone, Debug, Serialize)]
pub(crate) struct Device {
    id: String,
    name: String,
    state: String,
    connection: String,
    platform: String,
}

pub(crate) fn android_devices(config: &AppConfig) -> Vec<Device> {
    let adb = program(&config.adb_path, "adb");
    let Ok(output) = command_output(&adb, &["devices", "-l"], None) else {
        return Vec::new();
    };
    output
        .lines()
        .skip_while(|line| !line.starts_with("List of devices"))
        .skip(1)
        .filter_map(|line| {
            let line = line.trim();
            if line.is_empty() {
                return None;
            }
            let mut parts = line.split_whitespace();
            let id = parts.next()?.to_owned();
            let state = parts.next().unwrap_or("unknown").to_owned();
            let details = parts.collect::<Vec<_>>();
            let name = details
                .iter()
                .find_map(|item| item.strip_prefix("model:"))
                .map(|value| value.replace('_', " "))
                .unwrap_or_else(|| id.clone());
            Some(Device {
                connection: if id.contains(':') { "无线" } else { "USB" }.to_owned(),
                id,
                name,
                state,
                platform: "android".to_owned(),
            })
        })
        .collect()
}

#[tauri::command]
pub(crate) fn list_android_devices(state: State<'_, AppState>) -> Vec<Device> {
    let config = state.config.lock().expect("config lock poisoned").clone();
    android_devices(&config)
}

pub(crate) fn harmony_devices(config: &AppConfig) -> Vec<Device> {
    let hdc = program(&config.hdc_path, "hdc");
    let Ok(output) = command_output(&hdc, &["list", "targets"], None) else {
        return Vec::new();
    };
    output
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty() && !line.starts_with('['))
        .map(|id| Device {
            id: id.to_owned(),
            name: id.to_owned(),
            state: "device".to_owned(),
            connection: if id.contains(':') { "无线" } else { "USB" }.to_owned(),
            platform: "harmony".to_owned(),
        })
        .collect()
}

#[tauri::command]
pub(crate) fn list_harmony_devices(state: State<'_, AppState>) -> Vec<Device> {
    let config = state.config.lock().expect("config lock poisoned").clone();
    harmony_devices(&config)
}
