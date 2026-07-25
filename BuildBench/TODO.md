# 本地构建台实施清单

## 架构

- [x] Windows 端作为唯一构建执行端，负责调用 Flutter、ADB、HDC 与 Hvigor。
- [x] Android 端作为局域网遥控器，不在手机上安装构建工具链。
- [x] 远程接口只开放预定义任务，不接受任意命令文本。
- [x] 使用本机地址、固定端口和随机配对令牌连接两端。

## Windows 桌面端

- [x] 完成双栏操作页、设备卡片、构建模式与实时日志布局。
- [x] 支持保存项目目录及 Flutter、ADB、HDC 路径。
- [x] 支持 Android APK 构建、安装、Flutter 测试、清理和 Doctor。
- [x] 支持鸿蒙 HAP 构建及 HDC 安装。
- [x] 展示手机连接地址、配对令牌与远程服务状态。
- [x] 工具路径自动探测（PATH / ANDROID_HOME / 常见目录）。
- [x] 顶栏显示手机连接状态与工具状态。
- [x] 打包 Windows NSIS 安装程序。

## Android APK 端

- [x] 创建手机端连接页并安全保存电脑地址与配对令牌。
- [x] 展示 Windows 端在线状态、项目名与构建状态。
- [x] 展示 Android / 鸿蒙设备状态。
- [x] 支持 Android 构建安装、Flutter 测试、清理与鸿蒙构建安装。
- [x] 轮询并展示实时构建日志。
- [x] 展示电脑端 Flutter / ADB / HDC 工具状态。
- [x] 生成可安装 APK。

## 验证与交付

- [x] 通过前端类型检查和生产构建。
- [x] 通过 Rust 编译与桌面端启动。
- [x] 验证未配置 Flutter / ADB 时的降级提示。
- [x] 验证未配对手机无法调用任务。
- [x] 检查 Windows 和 Android 界面截图 (仅桌面端主界面截图)。
- [x] 关闭构建期间启动的 Node.js 等后台进程。
