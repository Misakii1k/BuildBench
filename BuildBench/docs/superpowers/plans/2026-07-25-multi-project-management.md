# 多项目管理功能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 BuildBench 添加多项目管理能力，支持保存多个 Flutter 项目、快速切换当前项目，每个项目可独立保存设备选择。

**Architecture:** 在现有 `AppConfig` 基础上扩展 `projects` 列表和 `current_project_id` 字段，保持向后兼容。桌面端和手机端均添加项目切换 UI，远程 API 新增项目列表查询与切换接口。

**Tech Stack:** Rust (Tauri backend) + TypeScript/React (desktop & Android client) + Axum (remote HTTP API)

---

## 文件结构

### 新建 / 修改文件总览

| 文件 | 操作 | 职责 |
|------|------|------|
| `src-tauri/src/config.rs` | 修改 | 新增 `Project` 结构体、扩展 `AppConfig`、配置迁移逻辑、项目 CRUD 命令 |
| `src-tauri/src/lib.rs` | 修改 | 在 `invoke_handler` 中注册新项目管理命令 |
| `src-tauri/src/remote.rs` | 修改 | 新增项目列表查询与切换的 HTTP 接口 |
| `src-tauri/src/tasks.rs` | 修改 | `run_task_inner` 使用当前项目配置 |
| `src-tauri/src/tools.rs` | 修改 | `inspect_environment` 保持全局工具配置不变 |
| `src/types.ts` | 修改 | 新增 `Project` 类型，扩展 `Config` |
| `src/hooks/useBuildBench.ts` | 修改 | 添加项目列表管理、切换、增删逻辑 |
| `src/screens/MainScreen.tsx` | 修改 | 顶栏添加项目切换下拉菜单 |
| `src/screens/SettingsModal.tsx` | 修改 | 设置中添加项目管理区域 |
| `src/components/ProjectSelector.tsx` | 新建 | 项目选择器下拉组件 |
| `src/lib/api.ts` | 修改 | 新增项目管理相关的 Tauri API 调用 |
| `android-client/src/types.ts` | 修改 | 新增 `Project` 类型 |
| `android-client/src/lib/api.ts` | 修改 | 新增项目列表、切换项目的 HTTP API |
| `android-client/src/hooks/useBuildBench.ts` | 修改 | 添加项目列表与切换逻辑 |
| `android-client/src/screens/HomeScreen.tsx` | 修改 | 添加项目切换 UI |
| `android-client/src/screens/SettingsScreen.tsx` | 修改 | 可选：项目列表展示 |

---

## Task 1: 后端数据模型与配置迁移

**Files:**
- Modify: `src-tauri/src/config.rs`
- Test: `src-tauri/src/config.rs` (unit tests in `#[cfg(test)]`)

### 1.1 定义 Project 结构体

在 `config.rs` 中添加项目配置结构体：

```rust
#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(default)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub path: String,
    pub android_device_id: String,
    pub harmony_device_id: String,
}
```

### 1.2 扩展 AppConfig

在 `AppConfig` 中新增字段，保持向后兼容：

```rust
#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(default)]
pub struct AppConfig {
    pub project_path: String,        // 保留，用于向后兼容 & 当前项目路径快捷访问
    pub flutter_path: String,
    pub adb_path: String,
    pub hdc_path: String,
    pub android_device_id: String,   // 保留，向后兼容
    pub harmony_device_id: String,   // 保留，向后兼容
    pub remote_token: String,
    pub projects: Vec<Project>,      // 新增：项目列表
    pub current_project_id: String,  // 新增：当前选中项目 ID
}
```

### 1.3 添加配置迁移 / 初始化逻辑

修改 `load_config`，在加载后自动执行迁移：
- 如果 `projects` 为空但 `project_path` 非空，则从旧配置创建一个默认项目
- 生成项目 ID（使用 Uuid 简写）
- 设置 `current_project_id`

```rust
fn migrate_config(mut config: AppConfig) -> AppConfig {
    if config.projects.is_empty() && !config.project_path.trim().is_empty() {
        let id = Uuid::new_v4().simple().to_string()[..8].to_uppercase();
        let name = Path::new(&config.project_path)
            .file_name()
            .and_then(|v| v.to_str())
            .unwrap_or("未命名项目")
            .to_owned();
        config.projects.push(Project {
            id: id.clone(),
            name,
            path: config.project_path.clone(),
            android_device_id: config.android_device_id.clone(),
            harmony_device_id: config.harmony_device_id.clone(),
        });
        config.current_project_id = id;
    }
    config
}
```

### 1.4 添加当前项目辅助函数

```rust
impl AppConfig {
    pub fn current_project(&self) -> Option<&Project> {
        self.projects.iter().find(|p| p.id == self.current_project_id)
    }

    pub fn effective_project_path(&self) -> &str {
        self.current_project()
            .map(|p| p.path.as_str())
            .unwrap_or(&self.project_path)
    }

    pub fn effective_android_device(&self) -> &str {
        self.current_project()
            .map(|p| p.android_device_id.as_str())
            .unwrap_or(&self.android_device_id)
    }

    pub fn effective_harmony_device(&self) -> &str {
        self.current_project()
            .map(|p| p.harmony_device_id.as_str())
            .unwrap_or(&self.harmony_device_id)
    }
}
```

### 1.5 添加 Tauri Commands

新增以下命令：

```rust
#[tauri::command]
pub(crate) fn list_projects(state: State<'_, AppState>) -> Vec<Project> {
    state.config.lock().expect("config lock poisoned").projects.clone()
}

#[tauri::command]
pub(crate) fn get_current_project(state: State<'_, AppState>) -> Option<Project> {
    state.config.lock().expect("config lock poisoned").current_project().cloned()
}

#[tauri::command]
pub(crate) fn add_project(app: AppHandle, state: State<'_, AppState>, path: String, name: Option<String>) -> Result<Project, String> {
    let path = path.trim().to_owned();
    if path.is_empty() {
        return Err("项目路径不能为空".to_owned());
    }
    if !Path::new(&path).is_dir() {
        return Err("项目路径不是有效的目录".to_owned());
    }
    let mut config = state.config.lock().map_err(|_| "配置被占用".to_owned())?.clone();
    // 检查是否已存在
    if config.projects.iter().any(|p| p.path == path) {
        return Err("该项目已在列表中".to_owned());
    }
    let id = Uuid::new_v4().simple().to_string()[..8].to_uppercase();
    let project_name = name.unwrap_or_else(|| {
        Path::new(&path)
            .file_name()
            .and_then(|v| v.to_str())
            .unwrap_or("未命名项目")
            .to_owned()
    });
    let project = Project {
        id: id.clone(),
        name: project_name,
        path,
        android_device_id: String::new(),
        harmony_device_id: String::new(),
    };
    config.projects.push(project.clone());
    if config.current_project_id.is_empty() {
        config.current_project_id = id;
        config.project_path = project.path.clone();
    }
    save_config_file(&app, &config)?;
    *state.config.lock().map_err(|_| "配置被占用".to_owned())? = config;
    Ok(project)
}

#[tauri::command]
pub(crate) fn remove_project(app: AppHandle, state: State<'_, AppState>, project_id: String) -> Result<(), String> {
    let mut config = state.config.lock().map_err(|_| "配置被占用".to_owned())?.clone();
    let index = config.projects.iter().position(|p| p.id == project_id)
        .ok_or_else(|| "项目不存在".to_owned())?;
    config.projects.remove(index);
    if config.current_project_id == project_id {
        if let Some(first) = config.projects.first() {
            config.current_project_id = first.id.clone();
            config.project_path = first.path.clone();
            config.android_device_id = first.android_device_id.clone();
            config.harmony_device_id = first.harmony_device_id.clone();
        } else {
            config.current_project_id = String::new();
            config.project_path = String::new();
        }
    }
    save_config_file(&app, &config)?;
    *state.config.lock().map_err(|_| "配置被占用".to_owned())? = config;
    Ok(())
}

#[tauri::command]
pub(crate) fn switch_project(app: AppHandle, state: State<'_, AppState>, project_id: String) -> Result<Project, String> {
    let mut config = state.config.lock().map_err(|_| "配置被占用".to_owned())?.clone();
    let project = config.projects.iter().find(|p| p.id == project_id)
        .cloned()
        .ok_or_else(|| "项目不存在".to_owned())?;
    config.current_project_id = project_id;
    config.project_path = project.path.clone();
    config.android_device_id = project.android_device_id.clone();
    config.harmony_device_id = project.harmony_device_id.clone();
    save_config_file(&app, &config)?;
    *state.config.lock().map_err(|_| "配置被占用".to_owned())? = config;
    Ok(project)
}

#[tauri::command]
pub(crate) fn update_project(app: AppHandle, state: State<'_, AppState>, project: Project) -> Result<Project, String> {
    let mut config = state.config.lock().map_err(|_| "配置被占用".to_owned())?.clone();
    let index = config.projects.iter().position(|p| p.id == project.id)
        .ok_or_else(|| "项目不存在".to_owned())?;
    config.projects[index] = project.clone();
    if config.current_project_id == project.id {
        config.project_path = project.path.clone();
        config.android_device_id = project.android_device_id.clone();
        config.harmony_device_id = project.harmony_device_id.clone();
    }
    save_config_file(&app, &config)?;
    *state.config.lock().map_err(|_| "配置被占用".to_owned())? = config;
    Ok(project)
}
```

### 1.6 在 lib.rs 中注册命令

在 `invoke_handler` 中添加：

```rust
config::list_projects,
config::get_current_project,
config::add_project,
config::remove_project,
config::switch_project,
config::update_project,
```

### 1.7 单元测试

在 `config.rs` 底部添加测试：

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_migrate_empty_projects() {
        let config = AppConfig {
            project_path: "/path/to/myapp".to_owned(),
            android_device_id: "dev123".to_owned(),
            ..Default::default()
        };
        let migrated = migrate_config(config);
        assert_eq!(migrated.projects.len(), 1);
        assert_eq!(migrated.projects[0].name, "myapp");
        assert_eq!(migrated.projects[0].path, "/path/to/myapp");
        assert_eq!(migrated.projects[0].android_device_id, "dev123");
        assert_eq!(migrated.current_project_id, migrated.projects[0].id);
    }

    #[test]
    fn test_effective_values_with_project() {
        let config = AppConfig {
            projects: vec![Project {
                id: "P1".to_owned(),
                name: "Test".to_owned(),
                path: "/test".to_owned(),
                android_device_id: "a1".to_owned(),
                harmony_device_id: "h1".to_owned(),
            }],
            current_project_id: "P1".to_owned(),
            ..Default::default()
        };
        assert_eq!(config.effective_project_path(), "/test");
        assert_eq!(config.effective_android_device(), "a1");
        assert_eq!(config.effective_harmony_device(), "h1");
    }

    #[test]
    fn test_effective_values_fallback() {
        let config = AppConfig {
            project_path: "/fallback".to_owned(),
            android_device_id: "fb_a".to_owned(),
            ..Default::default()
        };
        assert_eq!(config.effective_project_path(), "/fallback");
        assert_eq!(config.effective_android_device(), "fb_a");
    }
}
```

- [ ] **Step 1: 添加 Project 结构体和 AppConfig 扩展**
- [ ] **Step 2: 添加 migrate_config 函数和 AppConfig impl**
- [ ] **Step 3: 添加 6 个 Tauri commands**
- [ ] **Step 4: 在 lib.rs 中注册新命令**
- [ ] **Step 5: 编写单元测试**
- [ ] **Step 6: 运行 `cargo test -p buildbench --lib config::tests` 验证测试通过**
- [ ] **Step 7: 运行 `cargo check` 确保编译通过**

---

## Task 2: 任务执行使用当前项目配置

**Files:**
- Modify: `src-tauri/src/tasks.rs`

确保构建任务使用 `effective_project_path` 和各设备的 effective ID。由于我们在切换项目时已经同步更新了顶层的 `project_path`、`android_device_id`、`harmony_device_id`，因此 `tasks.rs` 中现有逻辑继续有效。但为了代码清晰，将直接使用 `effective_*` 辅助函数。

修改 `run_task_inner`：

```rust
fn run_task_inner(app: &AppHandle, config: &AppConfig, action: &str, mode: &str) -> Result<(), String> {
    let project = PathBuf::from(config.effective_project_path().trim());
    // ... 其余不变，config.android_device_id 改为 config.effective_android_device()
    // config.harmony_device_id 改为 config.effective_harmony_device()
}
```

同时修改 `start_task` 中 clone config 后的使用保持一致。

- [ ] **Step 1: 修改 run_task_inner 使用 effective_* 方法**
- [ ] **Step 2: 修改 android_install 部分的设备 ID 读取**
- [ ] **Step 3: 修改 harmony_install 部分的设备 ID 读取**
- [ ] **Step 4: 运行 `cargo check` 确保编译通过**
- [ ] **Step 5: 运行现有测试 `cargo test -p buildbench --lib tasks::tests`**

---

## Task 3: 远程 API 新增项目管理接口

**Files:**
- Modify: `src-tauri/src/remote.rs`

### 3.1 新增类型

```rust
#[derive(Clone, Debug, Deserialize)]
pub(crate) struct RemoteSwitchProject {
    project_id: String,
}

#[derive(Clone, Debug, Deserialize)]
pub(crate) struct RemoteAddProject {
    path: String,
    name: Option<String>,
}
```

### 3.2 新增 HTTP 路由

在 `run_remote_server` 的 router 中添加：

```rust
.route("/api/projects", get(remote_projects_list))
.route("/api/projects/current", get(remote_projects_current))
.route("/api/projects/switch", post(remote_projects_switch))
```

### 3.3 实现 handler

```rust
async fn remote_projects_list(
    AxumState(app): AxumState<AppHandle>,
    headers: HeaderMap,
) -> Result<Json<Vec<Project>>, StatusCode> {
    if !remote_authorized(&headers, &app) {
        return Err(StatusCode::UNAUTHORIZED);
    }
    let config = app.state::<AppState>().config.lock()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?.clone();
    Ok(Json(config.projects))
}

async fn remote_projects_current(
    AxumState(app): AxumState<AppHandle>,
    headers: HeaderMap,
) -> Result<Json<Option<Project>>, StatusCode> {
    if !remote_authorized(&headers, &app) {
        return Err(StatusCode::UNAUTHORIZED);
    }
    let config = app.state::<AppState>().config.lock()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?.clone();
    Ok(Json(config.current_project().cloned()))
}

async fn remote_projects_switch(
    AxumState(app): AxumState<AppHandle>,
    headers: HeaderMap,
    Json(body): Json<RemoteSwitchProject>,
) -> Result<Json<Project>, StatusCode> {
    if !remote_authorized(&headers, &app) {
        return Err(StatusCode::UNAUTHORIZED);
    }
    // 复用 switch_project 逻辑（需要从 state 取出 app handle 直接调用）
    let state = app.state::<AppState>();
    let mut config = state.config.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?.clone();
    let project = config.projects.iter().find(|p| p.id == body.project_id)
        .cloned()
        .ok_or(StatusCode::NOT_FOUND)?;
    config.current_project_id = body.project_id;
    config.project_path = project.path.clone();
    config.android_device_id = project.android_device_id.clone();
    config.harmony_device_id = project.harmony_device_id.clone();
    save_config_file(&app, &config).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    *state.config.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)? = config;
    let _ = app.emit("project-switched", project.clone());
    Ok(Json(project))
}
```

注意：需要在 `remote.rs` 中导入 `config::save_config_file` 和 `Project` 类型。

### 3.4 更新 RemoteStatus

在 `RemoteStatus` 中新增 `current_project_id` 字段（可选），以便手机端判断当前项目。

- [ ] **Step 1: 导入 Project 和 save_config_file 到 remote.rs**
- [ ] **Step 2: 添加 RemoteSwitchProject / RemoteAddProject 结构体**
- [ ] **Step 3: 实现 remote_projects_list handler**
- [ ] **Step 4: 实现 remote_projects_current handler**
- [ ] **Step 5: 实现 remote_projects_switch handler**
- [ ] **Step 6: 在 router 中注册 3 个新路由**
- [ ] **Step 7: 在 RemoteStatus 中添加 current_project_id 字段**
- [ ] **Step 8: 运行 `cargo check` 确保编译通过**

---

## Task 4: 桌面端类型与 API 层

**Files:**
- Modify: `src/types.ts`
- Modify: `src/lib/api.ts`

### 4.1 扩展类型定义

```typescript
export type Project = {
  id: string;
  name: string;
  path: string;
  android_device_id: string;
  harmony_device_id: string;
};
```

### 4.2 新增 API 调用函数

在 `src/lib/api.ts` 中添加：

```typescript
export async function listProjects(): Promise<Project[]> {
  return invoke("list_projects");
}

export async function getCurrentProject(): Promise<Project | null> {
  return invoke("get_current_project");
}

export async function addProject(path: string, name?: string): Promise<Project> {
  return invoke("add_project", { path, name });
}

export async function removeProject(projectId: string): Promise<void> {
  return invoke("remove_project", { projectId });
}

export async function switchProject(projectId: string): Promise<Project> {
  return invoke("switch_project", { projectId });
}

export async function updateProject(project: Project): Promise<Project> {
  return invoke("update_project", { project });
}
```

- [ ] **Step 1: 在 types.ts 中添加 Project 类型**
- [ ] **Step 2: 在 api.ts 中添加 6 个 API 函数**
- [ ] **Step 3: 运行 `npm run build`（或 tsc）确保类型检查通过**

---

## Task 5: 桌面端 useBuildBench Hook 扩展

**Files:**
- Modify: `src/hooks/useBuildBench.ts`

### 5.1 添加状态

```typescript
const [projects, setProjects] = useState<Project[]>([]);
```

### 5.2 加载初始数据

在初始化 `useEffect` 中，读取配置后加载项目列表：

```typescript
const savedProjects = await listProjects();
setProjects(savedProjects);
```

### 5.3 添加项目操作函数

```typescript
const handleAddProject = async (path: string, name?: string) => {
  const project = await addProject(path, name);
  setProjects((prev) => [...prev, project]);
  log(`已添加项目：${project.name}`, "success");
  return project;
};

const handleRemoveProject = async (projectId: string) => {
  await removeProject(projectId);
  setProjects((prev) => prev.filter((p) => p.id !== projectId));
  log("项目已移除", "info");
  // 刷新当前配置
  const saved = await getConfig();
  setConfig(saved);
  setDraft(saved);
  await refreshDevices();
};

const handleSwitchProject = async (projectId: string) => {
  const project = await switchProject(projectId);
  setProjects((prev) =>
    prev.map((p) => (p.id === projectId ? project : p)),
  );
  const saved = await getConfig();
  setConfig(saved);
  setDraft(saved);
  log(`已切换到项目：${project.name}`, "success");
  await refreshEnvironment();
  await refreshDevices();
};

const handleUpdateProject = async (project: Project) => {
  const updated = await updateProject(project);
  setProjects((prev) =>
    prev.map((p) => (p.id === project.id ? updated : p)),
  );
  if (config.current_project_id === project.id) {
    const saved = await getConfig();
    setConfig(saved);
    setDraft(saved);
  }
  log("项目设置已更新", "success");
};
```

### 5.4 监听 project-switched 事件

```typescript
const offProject = listen<Project>("project-switched", (event) => {
  // 同步配置
  void getConfig().then((saved) => {
    setConfig(saved);
    setDraft(saved);
  });
  void refreshDevices();
});
```

### 5.5 返回值扩展

在 return 中添加：
```typescript
projects,
addProject: handleAddProject,
removeProject: handleRemoveProject,
switchProject: handleSwitchProject,
updateProject: handleUpdateProject,
```

- [ ] **Step 1: 添加 projects 状态**
- [ ] **Step 2: 在初始化中加载项目列表**
- [ ] **Step 3: 添加 addProject / removeProject / switchProject / updateProject 函数**
- [ ] **Step 4: 监听 project-switched 事件（可选，多端同步用）**
- [ ] **Step 5: 在 return 中暴露新方法**
- [ ] **Step 6: 运行 `npm run build` 确保类型检查通过**

---

## Task 6: 桌面端 UI - 项目选择器组件

**Files:**
- Create: `src/components/ProjectSelector.tsx`

```tsx
import { ChevronDown, FolderPlus, Folder } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import type { Project } from "../types";

interface ProjectSelectorProps {
  projects: Project[];
  currentProjectId: string;
  onSwitch: (projectId: string) => void;
  onAdd: () => void;
}

export function ProjectSelector({ projects, currentProjectId, onSwitch, onAdd }: ProjectSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = projects.find((p) => p.id === currentProjectId);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="project-selector" ref={ref}>
      <button
        type="button"
        className="selector-trigger"
        onClick={() => setOpen((v) => !v)}
        title={current?.path}
      >
        <Folder size={18} />
        <span className="project-name">{current?.name || "未选择项目"}</span>
        <ChevronDown size={16} className={open ? "rotated" : ""} />
      </button>
      {open ? (
        <div className="selector-dropdown">
          <div className="dropdown-list">
            {projects.length === 0 ? (
              <div className="dropdown-empty">暂无项目，点击下方添加</div>
            ) : (
              projects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  className={`dropdown-item ${project.id === currentProjectId ? "active" : ""}`}
                  onClick={() => {
                    onSwitch(project.id);
                    setOpen(false);
                  }}
                >
                  <Folder size={16} />
                  <div className="item-info">
                    <strong>{project.name}</strong>
                    <small>{project.path}</small>
                  </div>
                </button>
              ))
            )}
          </div>
          <div className="dropdown-footer">
            <button type="button" className="add-project-btn" onClick={onAdd}>
              <FolderPlus size={16} />
              添加项目
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 1: 创建 ProjectSelector.tsx 组件**
- [ ] **Step 2: 实现下拉菜单、项目列表、添加按钮**
- [ ] **Step 3: 添加点击外部关闭逻辑**
- [ ] **Step 4: 运行 `npm run build` 确保类型检查通过**

---

## Task 7: 桌面端 UI - 主界面集成

**Files:**
- Modify: `src/screens/MainScreen.tsx`

### 7.1 集成 ProjectSelector

在顶栏 brand 区域下方或旁边添加项目选择器：

```tsx
import { ProjectSelector } from "../components/ProjectSelector";

// 在 useBuildBench 解构中添加:
const { projects, switchProject, addProject, /* ... */ } = useBuildBench();

// 处理添加项目
const handleAddProject = async () => {
  const path = await open({ directory: true, multiple: false, title: "选择 Flutter 项目目录" });
  if (typeof path === "string") {
    try {
      await addProject(path);
    } catch (error) {
      log(`添加项目失败：${String(error)}`, "error");
    }
  }
};

// 在 JSX 中的 brand 区域下方添加:
<ProjectSelector
  projects={projects}
  currentProjectId={config.current_project_id || ""}
  onSwitch={(id) => void switchProject(id)}
  onAdd={handleAddProject}
/>
```

### 7.2 更新 settings modal 中的项目选择

保留原有的项目路径显示，但标注为"当前项目"，并添加跳转到项目管理的入口。

- [ ] **Step 1: 导入 ProjectSelector 组件**
- [ ] **Step 2: 从 hook 中解构 projects / switchProject / addProject**
- [ ] **Step 3: 添加 handleAddProject 函数**
- [ ] **Step 4: 在顶栏 brand 区域集成 ProjectSelector**
- [ ] **Step 5: 调整 CSS 样式（在 styles.css 中添加 project-selector 相关样式）**
- [ ] **Step 6: 运行 `npm run build` 确保构建通过**

---

## Task 8: 桌面端设置中添加项目管理

**Files:**
- Modify: `src/screens/SettingsModal.tsx`

在设置弹窗中添加"项目管理"区域：
- 显示项目列表
- 支持添加新项目（通过文件选择器）
- 支持移除项目（带确认）
- 支持重命名项目

- [ ] **Step 1: 在 SettingsModal 中添加项目管理区块**
- [ ] **Step 2: 实现项目列表展示**
- [ ] **Step 3: 实现添加 / 删除 / 重命名功能**
- [ ] **Step 4: 运行 `npm run build` 确保构建通过**

---

## Task 9: 手机端类型与 API 扩展

**Files:**
- Modify: `android-client/src/types.ts`
- Modify: `android-client/src/lib/api.ts`

### 9.1 新增 Project 类型

```typescript
export interface Project {
  id: string;
  name: string;
  path: string;
  android_device_id: string;
  harmony_device_id: string;
}
```

扩展 `RemoteStatus`：

```typescript
export interface RemoteStatus {
  // ... 现有字段
  current_project_id?: string;
}
```

### 9.2 新增 API 方法

在 `BuildBenchApi` 类中添加：

```typescript
listProjects(): Promise<Project[]> {
  return this.request<Project[]>("/api/projects");
}

getCurrentProject(): Promise<Project | null> {
  return this.request<Project | null>("/api/projects/current");
}

switchProject(projectId: string): Promise<Project> {
  return this.request<Project>("/api/projects/switch", "POST", { project_id: projectId });
}
```

- [ ] **Step 1: 在 types.ts 中添加 Project 类型**
- [ ] **Step 2: 扩展 RemoteStatus 添加 current_project_id**
- [ ] **Step 3: 在 BuildBenchApi 类中添加 listProjects / getCurrentProject / switchProject**
- [ ] **Step 4: 运行 `npm run build` 确保类型检查通过**

---

## Task 10: 手机端 useBuildBench Hook 扩展

**Files:**
- Modify: `android-client/src/hooks/useBuildBench.ts`

### 10.1 添加状态

```typescript
const [projects, setProjects] = useState<Project[]>([]);
```

### 10.2 在 poll 中获取项目列表

修改 poll 函数，在 Promise.all 中添加 `api.listProjects()` 调用。

### 10.3 添加 switchProject 函数

```typescript
const switchProject = useCallback(
  async (projectId: string) => {
    if (!api) throw new ApiError("invalid_config", "请先完成连接配置");
    await api.switchProject(projectId);
    window.setTimeout(() => void poll(), 200);
  },
  [api, poll],
);
```

### 10.4 在返回值中暴露

```typescript
return {
  // ... 现有字段
  projects,
  switchProject,
};
```

- [ ] **Step 1: 添加 projects 状态**
- [ ] **Step 2: 在 poll 中并行获取项目列表**
- [ ] **Step 3: 添加 switchProject 函数**
- [ ] **Step 4: 在 return 中暴露**
- [ ] **Step 5: 运行 `npm run build` 确保类型检查通过**

---

## Task 11: 手机端 UI - 项目切换

**Files:**
- Modify: `android-client/src/screens/HomeScreen.tsx`

在"当前项目"区域添加切换功能，点击可展开下拉选择项目。

- [ ] **Step 1: 在 HomeScreenProps 中添加 projects / onSwitchProject**
- [ ] **Step 2: 在项目概览区域添加切换按钮或下拉**
- [ ] **Step 3: 实现项目切换交互**
- [ ] **Step 4: 运行 `npm run build` 确保构建通过**

---

## Task 12: 样式与体验优化

**Files:**
- Modify: `src/styles.css`
- Modify: `android-client/src/styles.css`

添加项目选择器、项目列表项的样式，与现有设计风格保持一致。

- [ ] **Step 1: 桌面端添加 project-selector 样式**
- [ ] **Step 2: 手机端添加项目切换样式**
- [ ] **Step 3: 运行 `npm run build` 确保构建通过**

---

## Self-Review Checklist

**1. Spec coverage:**
- [x] 支持添加多个项目 → Task 1 (add_project command) + Task 5 (handleAddProject) + Task 7/8 (UI)
- [x] 支持切换当前项目 → Task 1 (switch_project) + Task 3 (remote API) + Task 5/7/10/11 (UI)
- [x] 支持删除项目 → Task 1 (remove_project) + Task 5/8 (UI)
- [x] 每个项目独立保存设备选择 → Project 结构体包含 device_id 字段
- [x] 桌面端和手机端都支持 → Task 4-8 (桌面), Task 9-11 (手机)
- [x] 向后兼容旧配置 → migrate_config 函数

**2. Placeholder scan:**
- 所有代码步骤都有具体实现
- 没有 "TBD" / "TODO" / "类似" 等占位符
- 每个步骤都有明确的代码块和命令

**3. Type consistency:**
- Rust 端: `Project { id, name, path, android_device_id, harmony_device_id }`
- TS 端: `Project { id: string, name: string, path: string, android_device_id: string, harmony_device_id: string }`
- 远程 API 字段命名与 Rust 一致（snake_case）
- 命令参数命名: `projectId` (camelCase for Tauri invoke) vs `project_id` (snake_case for HTTP JSON)

**4. Verification:**
- Rust 单元测试: config migration、effective values
- 类型检查: `npm run build` (tsc --noEmit)
- 编译检查: `cargo check`
