mod config;
mod devices;
mod remote;
mod tasks;
mod tools;

use std::collections::VecDeque;
use std::sync::{atomic::AtomicU64, Mutex};

use tauri::{Emitter, Manager};
use uuid::Uuid;

use crate::config::{load_config, save_config_file, AppConfig};
use crate::remote::{remote_online, run_remote_server, RemoteLinkEvent, RemoteLog};
use crate::tasks::emit_log;

#[derive(Default)]
pub(crate) struct AppState {
    pub(crate) config: Mutex<AppConfig>,
    pub(crate) running: Mutex<bool>,
    pub(crate) logs: Mutex<VecDeque<RemoteLog>>,
    pub(crate) next_log_id: AtomicU64,
    pub(crate) last_remote_seen_ms: Mutex<u64>,
    pub(crate) child_pids: Mutex<Vec<u32>>,
}

pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let mut config = load_config(app.handle());
            if config.remote_token.trim().is_empty() {
                config.remote_token = Uuid::new_v4().simple().to_string()[..8].to_uppercase();
                save_config_file(app.handle(), &config)?;
            }
            app.manage(AppState {
                config: Mutex::new(config),
                running: Mutex::new(false),
                logs: Mutex::new(VecDeque::new()),
                next_log_id: AtomicU64::new(1),
                last_remote_seen_ms: Mutex::new(0),
                child_pids: Mutex::new(Vec::new()),
            });
            let server_app = app.handle().clone();
            std::thread::spawn(move || {
                let runtime = tokio::runtime::Builder::new_multi_thread()
                    .enable_all()
                    .build()
                    .expect("create remote runtime");
                if let Err(error) = runtime.block_on(run_remote_server(server_app.clone())) {
                    emit_log(&server_app, error, "error");
                }
            });
            let watcher_app = app.handle().clone();
            std::thread::spawn(move || loop {
                std::thread::sleep(std::time::Duration::from_millis(2_000));
                let state = watcher_app.state::<AppState>();
                let online = remote_online(&state);
                let _ = watcher_app.emit("remote-link", RemoteLinkEvent { online });
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            config::get_config,
            config::save_config,
            remote::get_remote_info,
            remote::get_remote_link,
            tools::inspect_environment,
            devices::list_android_devices,
            devices::list_harmony_devices,
            tasks::run_task,
        ])
        .build(tauri::generate_context!())
        .expect("运行本地构建台时发生错误");

    app.run(|app_handle, event| {
        if let tauri::RunEvent::ExitRequested { .. } = event {
            let state = app_handle.state::<AppState>();
            let pids: Vec<u32> = state
                .child_pids
                .lock()
                .map(|guard| guard.iter().copied().collect())
                .unwrap_or_default();
            for pid in pids.iter() {
                #[cfg(windows)]
                {
                    use std::os::windows::process::CommandExt;
                    let _ = std::process::Command::new("taskkill")
                        .args(["/F", "/PID", &pid.to_string()])
                        .creation_flags(0x08000000)
                        .spawn();
                }
                #[cfg(not(windows))]
                {
                    let _ = std::process::Command::new("kill")
                        .args(["-9", &pid.to_string()])
                        .spawn();
                }
            }
        }
    });
}
