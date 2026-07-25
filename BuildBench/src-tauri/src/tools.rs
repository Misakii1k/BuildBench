use serde::Serialize;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::State;

use crate::config::AppConfig;
use crate::AppState;

#[derive(Clone, Debug, Serialize)]
pub(crate) struct ToolStatus {
    name: String,
    available: bool,
    detail: String,
}

pub(crate) fn env_var(name: &str) -> Option<String> {
    std::env::var(name).ok().filter(|value| !value.trim().is_empty())
}

pub(crate) fn first_existing(candidates: impl IntoIterator<Item = PathBuf>) -> Option<PathBuf> {
    candidates.into_iter().find(|path| path.is_file())
}

pub(crate) fn discover_tool(tool: &str) -> Option<PathBuf> {
    if cfg!(windows) {
        if let Ok(output) = Command::new("where.exe").arg(tool).output() {
            if output.status.success() {
                if let Some(found) = String::from_utf8_lossy(&output.stdout).lines().next() {
                    let path = PathBuf::from(found.trim());
                    if path.is_file() {
                        return Some(path);
                    }
                }
            }
        }
    } else if let Ok(output) = Command::new("which").arg(tool).output() {
        if output.status.success() {
            if let Some(found) = String::from_utf8_lossy(&output.stdout).lines().next() {
                let path = PathBuf::from(found.trim());
                if path.is_file() {
                    return Some(path);
                }
            }
        }
    }

    let user_profile = env_var("USERPROFILE").or_else(|| env_var("HOME")).unwrap_or_default();
    let local_app = env_var("LOCALAPPDATA").unwrap_or_default();
    let android_home = env_var("ANDROID_HOME")
        .or_else(|| env_var("ANDROID_SDK_ROOT"))
        .or_else(|| {
            [
                PathBuf::from(r"C:\Android\Sdk"),
                PathBuf::from(format!(r"{local_app}\Android\Sdk")),
                PathBuf::from(format!(r"{user_profile}\AppData\Local\Android\Sdk")),
            ]
            .into_iter()
            .find(|path| path.is_dir())
            .map(|path| path.display().to_string())
        });
    let flutter_home = env_var("FLUTTER_HOME")
        .or_else(|| env_var("FLUTTER_ROOT"))
        .or_else(|| {
            [
                PathBuf::from(r"C:\src\flutter"),
                PathBuf::from(r"C:\flutter"),
                PathBuf::from(format!(r"{user_profile}\flutter")),
                PathBuf::from(format!(r"{user_profile}\development\flutter")),
                PathBuf::from(format!(r"{local_app}\flutter")),
            ]
            .into_iter()
            .find(|path| path.is_dir())
            .map(|path| path.display().to_string())
        });

    match tool {
        "adb" => {
            let mut candidates = Vec::new();
            if let Some(sdk) = android_home {
                candidates.push(PathBuf::from(&sdk).join("platform-tools").join("adb.exe"));
                candidates.push(PathBuf::from(&sdk).join("platform-tools").join("adb"));
            }
            candidates.extend([
                PathBuf::from(r"C:\Android\Sdk\platform-tools\adb.exe"),
                PathBuf::from(format!(r"{local_app}\Android\Sdk\platform-tools\adb.exe")),
            ]);
            first_existing(candidates)
        }
        "flutter" => {
            let mut candidates = Vec::new();
            if let Some(root) = flutter_home {
                candidates.push(PathBuf::from(&root).join("bin").join("flutter.bat"));
                candidates.push(PathBuf::from(&root).join("bin").join("flutter"));
            }
            candidates.extend([
                PathBuf::from(r"C:\src\flutter\bin\flutter.bat"),
                PathBuf::from(r"C:\flutter\bin\flutter.bat"),
                PathBuf::from(format!(r"{user_profile}\flutter\bin\flutter.bat")),
            ]);
            first_existing(candidates)
        }
        "hdc" => {
            let mut candidates = Vec::new();
            if let Some(sdk) = env_var("HOS_SDK_HOME").or_else(|| env_var("OHOS_SDK_HOME")) {
                candidates.push(PathBuf::from(&sdk).join("toolchains").join("hdc.exe"));
                candidates.push(PathBuf::from(&sdk).join("toolchains").join("hdc"));
            }
            candidates.extend([
                PathBuf::from(r"C:\Program Files\Huawei\DevEco Studio\sdk\default\openharmony\toolchains\hdc.exe"),
                PathBuf::from(format!(
                    r"{local_app}\Huawei\Sdk\default\openharmony\toolchains\hdc.exe"
                )),
            ]);
            first_existing(candidates)
        }
        _ => None,
    }
}

pub(crate) fn program(configured: &str, fallback: &str) -> String {
    let configured = configured.trim();
    if !configured.is_empty() {
        return configured.to_owned();
    }
    discover_tool(fallback)
        .map(|path| path.display().to_string())
        .unwrap_or_else(|| fallback.to_owned())
}

pub(crate) fn is_batch(executable: &str) -> bool {
    cfg!(windows)
        && Path::new(executable)
            .extension()
            .and_then(|value| value.to_str())
            .is_some_and(|value| value.eq_ignore_ascii_case("bat") || value.eq_ignore_ascii_case("cmd"))
}

pub(crate) fn prepared_command(executable: &str) -> Command {
    if is_batch(executable) {
        let mut command = Command::new("cmd.exe");
        command.args(["/D", "/S", "/C", executable]);
        command
    } else {
        Command::new(executable)
    }
}

fn probe(executable: &str, args: &[&str]) -> Result<String, String> {
    let output = prepared_command(executable)
        .args(args)
        .output()
        .map_err(|error| error.to_string())?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_owned());
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let text = if stdout.trim().is_empty() { stderr.trim() } else { stdout.trim() };
    Ok(text.lines().next().unwrap_or("已找到").to_owned())
}

pub(crate) fn inspect_tools(config: &AppConfig) -> Vec<ToolStatus> {
    [
        ("Flutter", program(&config.flutter_path, "flutter"), vec!["--version"]),
        ("ADB", program(&config.adb_path, "adb"), vec!["version"]),
        ("HDC", program(&config.hdc_path, "hdc"), vec!["version"]),
    ]
    .into_iter()
    .map(|(name, executable, args)| match probe(&executable, &args) {
        Ok(detail) => ToolStatus {
            name: name.to_owned(),
            available: true,
            detail: format!("{detail} · {executable}"),
        },
        Err(error) => ToolStatus {
            name: name.to_owned(),
            available: false,
            detail: if error.is_empty()
                || error.contains("系统找不到")
                || error.contains("not found")
                || error.contains("不是内部或外部命令")
            {
                format!("未找到 {executable}。可在设置中填写完整路径。")
            } else {
                error
            },
        },
    })
    .collect()
}

#[tauri::command]
pub(crate) fn inspect_environment(state: State<'_, AppState>) -> Vec<ToolStatus> {
    let config = state.config.lock().expect("config lock poisoned").clone();
    inspect_tools(&config)
}

pub(crate) fn command_output(executable: &str, args: &[&str], directory: Option<&Path>) -> Result<String, String> {
    let mut command = prepared_command(executable);
    command.args(args);
    if let Some(directory) = directory {
        command.current_dir(directory);
    }
    let output = command.output().map_err(|error| error.to_string())?;
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
}
