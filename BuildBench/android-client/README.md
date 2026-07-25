# BuildBench Android 遥控端

React + Vite + Capacitor Android 实现的局域网遥控客户端。Windows 端默认服务地址为 `http://电脑局域网地址:48484`。

## 接口约定

所有受保护请求都携带 `X-BuildBench-Token`：

- `GET /api/status`
- `GET /api/devices`
- `GET /api/logs?after={id}`
- `POST /api/tasks/{action}`，请求体为 `{ "mode": "debug" | "release" }`

允许的任务：`android_build`、`android_install`、`flutter_test`、`flutter_clean`、`flutter_doctor`、`harmony_build`、`harmony_install`。

## 构建

```powershell
npm install
npm run build
npm run android:sync
$env:ANDROID_HOME = "C:\Android\Sdk"
$env:ANDROID_SDK_ROOT = "C:\Android\Sdk"
Set-Location android
.\gradlew.bat assembleDebug
```

Debug APK 输出到 `android/app/build/outputs/apk/debug/app-debug.apk`。

