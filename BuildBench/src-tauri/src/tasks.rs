use serde::Serialize;
use std::{
    fs,
    io::{BufRead, BufReader},
    path::{Path, PathBuf},
    process::Stdio,
    sync::atomic::Ordering,
};
use tauri::{AppHandle, Emitter, Manager};

use crate::config::AppConfig;
use crate::remote::{now_ms, RemoteLog};
use crate::tools::{prepared_command, program};
use crate::AppState;

#[derive(Clone, Debug, Serialize)]
struct LogEvent {
    message: String,
    level: String,
}

#[derive(Clone, Debug, Serialize)]
struct TaskStatus {
    running: bool,
}

pub(crate) fn emit_log(app: &AppHandle, message: impl Into<String>, level: &str) {
    let message = message.into();
    let state = app.state::<AppState>();
    let id = state.next_log_id.fetch_add(1, Ordering::Relaxed);
    if let Ok(mut logs) = state.logs.lock() {
        logs.push_back(RemoteLog {
            id,
            timestamp_ms: now_ms() as u128,
            message: message.clone(),
            level: level.to_owned(),
        });
        while logs.len() > 1_000 {
            logs.pop_front();
        }
    }
    let _ = app.emit(
        "build-log",
        LogEvent {
            message,
            level: level.to_owned(),
        },
    );
}

fn run_process(app: &AppHandle, executable: &str, args: &[String], directory: &Path) -> Result<(), String> {
    emit_log(app, format!("> {} {}", executable, args.join(" ")), "command");
    let mut child = prepared_command(executable)
        .args(args)
        .current_dir(directory)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("无法启动 {executable}：{error}"))?;
    let pid = child.id();
    let state = app.state::<AppState>();
    if let Ok(mut pids) = state.child_pids.lock() {
        pids.push(pid);
    }
    let stdout = child.stdout.take().ok_or_else(|| "无法读取标准输出".to_owned())?;
    let stderr = child.stderr.take().ok_or_else(|| "无法读取标准错误".to_owned())?;
    let stdout_app = app.clone();
    let stdout_reader = std::thread::spawn(move || {
        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
            emit_log(&stdout_app, line, "info");
        }
    });
    let stderr_app = app.clone();
    let stderr_reader = std::thread::spawn(move || {
        for line in BufReader::new(stderr).lines().map_while(Result::ok) {
            emit_log(&stderr_app, line, "error");
        }
    });
    let wait_result = child.wait();
    if let Ok(mut pids) = state.child_pids.lock() {
        pids.retain(|p| *p != pid);
    }
    let status = wait_result.map_err(|error| format!("等待任务结束时出错：{error}"))?;
    let _ = stdout_reader.join();
    let _ = stderr_reader.join();
    if status.success() {
        Ok(())
    } else {
        Err(format!(
            "命令退出码：{}",
            status.code().map_or_else(|| "未知".to_owned(), |code| code.to_string())
        ))
    }
}

fn newest_file_with_extension(directory: &Path, extension: &str) -> Option<PathBuf> {
    fn walk(directory: &Path, extension: &str, newest: &mut Option<(std::time::SystemTime, PathBuf)>) {
        let Ok(entries) = fs::read_dir(directory) else { return };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                walk(&path, extension, newest);
                continue;
            }
            let matches = path
                .extension()
                .and_then(|value| value.to_str())
                .is_some_and(|value| value.eq_ignore_ascii_case(extension));
            if !matches {
                continue;
            }
            let modified = entry
                .metadata()
                .and_then(|metadata| metadata.modified())
                .unwrap_or(std::time::SystemTime::UNIX_EPOCH);
            if newest.as_ref().is_none_or(|(current, _)| modified > *current) {
                *newest = Some((modified, path));
            }
        }
    }
    let mut newest = None;
    walk(directory, extension, &mut newest);
    newest.map(|(_, path)| path)
}

fn flutter_args(action: &str, mode: &str) -> Vec<String> {
    match action {
        "android_build" | "android_install" => {
            vec!["build".into(), "apk".into(), format!("--{mode}")]
        }
        "flutter_test" => vec!["test".into()],
        "flutter_clean" => vec!["clean".into()],
        "flutter_doctor" => vec!["doctor".into(), "-v".into()],
        _ => Vec::new(),
    }
}

fn run_task_inner(app: &AppHandle, config: &AppConfig, action: &str, mode: &str) -> Result<(), String> {
    let project = PathBuf::from(config.project_path.trim());
    if action != "flutter_doctor" && !project.is_dir() {
        return Err("项目目录不存在，请在设置中重新选择。".to_owned());
    }
    let flutter = program(&config.flutter_path, "flutter");
    match action {
        "android_build" | "android_install" | "flutter_test" | "flutter_clean" | "flutter_doctor" => {
            let directory = if action == "flutter_doctor" && !project.is_dir() {
                Path::new(".")
            } else {
                project.as_path()
            };
            run_process(app, &flutter, &flutter_args(action, mode), directory)?;
            if action == "android_install" {
                let expected = project
                    .join("build")
                    .join("app")
                    .join("outputs")
                    .join("flutter-apk")
                    .join(format!("app-{mode}.apk"));
                let apk = if expected.is_file() {
                    expected
                } else {
                    newest_file_with_extension(&project.join("build"), "apk")
                        .ok_or_else(|| "构建成功但未找到 APK 文件。".to_owned())?
                };
                let adb = program(&config.adb_path, "adb");
                let mut args = Vec::new();
                if !config.android_device_id.trim().is_empty() {
                    args.extend(["-s".to_owned(), config.android_device_id.trim().to_owned()]);
                }
                args.extend(["install".to_owned(), "-r".to_owned(), apk.display().to_string()]);
                run_process(app, &adb, &args, &project)?;
                emit_log(app, "Android APK 已构建并安装完成。", "success");
            }
        }
        "harmony_build" | "harmony_install" => {
            let ohos = if project.join("ohos").is_dir() { project.join("ohos") } else { project.clone() };
            let wrapper_name = if cfg!(windows) { "hvigorw.bat" } else { "hvigorw" };
            let local_wrapper = ohos.join(wrapper_name);
            let hvigor = if local_wrapper.is_file() {
                local_wrapper.display().to_string()
            } else {
                wrapper_name.to_owned()
            };
            run_process(app, &hvigor, &["assembleHap".to_owned()], &ohos)?;
            if action == "harmony_install" {
                let hap = newest_file_with_extension(&ohos, "hap")
                    .ok_or_else(|| "构建成功但未找到 HAP 文件。".to_owned())?;
                let hdc = program(&config.hdc_path, "hdc");
                let mut args = Vec::new();
                if !config.harmony_device_id.trim().is_empty() {
                    args.extend(["-t".to_owned(), config.harmony_device_id.trim().to_owned()]);
                }
                args.extend(["install".to_owned(), "-r".to_owned(), hap.display().to_string()]);
                run_process(app, &hdc, &args, &ohos)?;
                emit_log(app, "鸿蒙 HAP 已构建并安装完成。", "success");
            }
        }
        _ => return Err("未知任务。".to_owned()),
    }
    Ok(())
}

pub(crate) fn start_task(app: AppHandle, action: String, mode: String) -> Result<(), String> {
    let state = app.state::<AppState>();
    {
        let mut running = state.running.lock().map_err(|_| "任务状态被占用".to_owned())?;
        if *running {
            return Err("已有任务正在执行，请等待完成。".to_owned());
        }
        *running = true;
    }
    let config = state.config.lock().map_err(|_| "配置被占用".to_owned())?.clone();
    let task_app = app.clone();
    std::thread::spawn(move || {
        emit_log(&task_app, format!("开始执行：{action}"), "command");
        match run_task_inner(&task_app, &config, &action, &mode) {
            Ok(()) => emit_log(&task_app, "任务执行完成。", "success"),
            Err(error) => emit_log(&task_app, format!("任务失败：{error}"), "error"),
        }
        if let Ok(mut running) = task_app.state::<AppState>().running.lock() {
            *running = false;
        }
        let _ = task_app.emit("task-status", TaskStatus { running: false });
    });
    let _ = app.emit("task-status", TaskStatus { running: true });
    Ok(())
}

#[tauri::command]
pub(crate) fn run_task(app: AppHandle, action: String, mode: String) -> Result<(), String> {
    start_task(app, action, mode)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tools::is_batch;

    #[test]
    fn parses_flutter_actions() {
        assert_eq!(flutter_args("android_build", "release"), ["build", "apk", "--release"]);
        assert_eq!(flutter_args("flutter_test", "debug"), ["test"]);
    }

    #[test]
    fn detects_batch_files_case_insensitively() {
        if cfg!(windows) {
            assert!(is_batch(r"C:\\tools\\flutter.BAT"));
            assert!(!is_batch(r"C:\\tools\\adb.exe"));
        }
    }
}
