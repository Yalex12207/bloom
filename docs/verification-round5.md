# 第五轮验收记录

验收日期：2026-10-17。继续现有 BLOOM 工程，保留五章节、持续 Canvas、单一滚动主时间轴、花朵局部交互与六主题。未重新初始化，未增加应用运行时依赖。Vercel 配置和说明已交付，尚未上线。

## 工程检查

| 检查 | 实际结果 |
| --- | --- |
| `npm run lint` | 通过，零 warning |
| `npm run typecheck` | 通过 |
| `npm test` | 43 / 43 通过 |
| `npm run build` | 通过，首页静态生成成功 |
| 音轨生成器自检 | WAV 头、32 秒时长、峰值、RMS、首尾衔接通过 |

环境为 Windows、Node.js 24.21.0、Next.js 16.4.1。43 项单元测试包括原有几何、交互、可逆姿态与主题，以及 12 项音频测试、3 项质量预算测试。音频测试覆盖手势恢复、暂停偏移、复用上下文、取消竞态、损坏文件、解码失败、模拟 WebKit 回调与设备中断、静音归零和卸载清理。

Node 原生类型擦除会输出模块类型自动检测提示；该提示不影响退出结果。浏览器依赖也可能输出 Three.js 弃用或驱动精度 warning，正常流程未记录到未捕获错误、hydration 错误或 Shader 编译错误。

## 浏览器验收

使用 Playwright 驱动本机 Edge 155.0.4283.45 无头 Chromium，对生产构建执行共 **42 / 42** 项检查：

| 脚本 | 通过数量 | 范围 |
| --- | --- | --- |
| `scripts/verify-production.mjs` | 15 | 音频、后期、质量、响应式、减少动态效果、失败恢复 |
| `scripts/verify-cinematic.mjs` | 14 | 五章、主时间轴、反向与快速滚动、刷新、拖拽、花心、触控、Replay |
| `scripts/verify-theme.mjs` | 13 | 六主题、真实 PBR、双色、连续切换、AUTO / MANUAL、键盘与移动面板 |

实际覆盖以下行为：

- 初次访问没有 AudioContext，也没有 WAV 请求；点击 SOUND 后才建立一个音频图、加载并播放。
- 真实内置 WAV 的低、中、高频和包络均产生非零信号；花朵读取相同分析结果。
- 静音和暂停平滑回零；暂停后上下文为 suspended；继续播放复用上下文与已解码音轨。
- 本地文件可播放；损坏 WAV 显示可恢复错误；重试恢复内置曲目。音轨 404 与加载中取消不会导致后续自动播放。
- 音频、手动双色、正反向滚动和 Replay 同时工作；只有一个 `bloom-master` 和一个持续 Canvas。
- 鼠标拖动、点击花心、长按释放、旋转复位可用。单指拖动不滚动页面，花朵外侧触控保留原生滚动。
- 手机视口 320×844、390×844、412×915、430×932，以及平板视口 820×1180、1024×768 均无横向溢出。声音和 Color Lab 的主要触控目标至少 44 px。
- 手机抽屉互斥，Escape 收起并恢复焦点；终章旧控制条让出页脚，Replay 可达。
- 触摸设备使用 27 片花瓣、零 transmission、关闭后期；手动 ECO 限制 DPR、粒子与细节。
- 减少动态效果时仍可听音频，音频驱动的几何与灯光运动关闭；导航、主题和章节仍可用。
- 禁用 WebGL / Web Audio 后，二维轮廓和五章原生内容仍可访问。真实 WebGL context loss 也会进入轮廓模式。
- 故意破坏可选后期 Shader 后，原场景继续绘制、GL 状态恢复，并锁定 BALANCED 上限；故障截图已人工查看。
- 人为放慢 rAF 后，自动预算实际降至 ECO，章节导航继续工作。此测试验证降级逻辑，不代表真实低端设备跑分。

## 实测性能

GPU 查询结果为 NVIDIA GeForce RTX 5060 Laptop GPU，经 ANGLE / Direct3D11。桌面视口 1440×960，设备缩放 1.5，绘制缓冲 2160×1440，HIGH 档，真实 HDR Bloom / DOF 与音频开启。

以下是 rAF 帧间隔与渲染诊断，不是 GPU timer、功耗测试或真实手机 FPS：

| 测量 | 样本 | 平均频率 | 帧间隔中位数 | P95 | 最大间隔 |
| --- | --- | --- | --- | --- | --- |
| 五章连续正向滚动，AUTO 配色 | 1200 帧 / 7.97 s | 150.6 fps | 6.1 ms | 12.1 ms | 72.8 ms |
| 五章连续反向滚动，AUTO 配色 | 1200 帧 / 7.85 s | 152.9 fps | 6.1 ms | 12.1 ms | 96.9 ms |
| SILVER / AZURE / NEBULA / DUALITY 固定章节 | 每组 240 帧 | 约 164.9 fps | 6.1 ms | 6.2 ms | 未出现 >33.4 ms 帧 |
| 390×844 触控模拟，AZURE | 240 帧 | 约 165.0 fps | 6.1 ms | 6.2 ms | 未出现 >33.4 ms 帧 |
| 820×1180 触控模拟，AZURE | 240 帧 | 约 165.0 fps | 6.1 ms | 6.2 ms | 未出现 >33.4 ms 帧 |

正向有 5 / 1200 帧、反向有 2 / 1200 帧超过 33.4 ms。最初测试发现首次材质编译约 697 ms 的停顿，因此增加加载阶段的物理材质、透射背面与输出空间预热，并提前上传字形纹理。最终采样未重现该峰值，但仍存在上述少量长帧，不能声称全程恒定 60 FPS 或完全没有卡顿。

触控模拟仍使用同一台 Windows 电脑和显卡，**不能推断 iPhone、Android 或平板真机达到该帧率**。

## 资源压力循环

先预热主题和两个质量系列，再进行四轮 SILVER → AZURE → NEBULA → DUALITY、跨章节、Replay、音频暂停 / 继续和 ECO 开关。每轮回到相同 NEBULA 进度，执行 GC 后读取诊断：

| 轮次 | Geometry | Texture | Program | JS heap 字节 | DOM nodes |
| --- | --- | --- | --- | --- | --- |
| 1 | 26 | 13 | 24 | 13,067,488 | 722 |
| 2 | 26 | 13 | 24 | 12,993,028 | 722 |
| 3 | 26 | 13 | 24 | 13,383,824 | 722 |
| 4 | 26 | 13 | 24 | 13,472,212 | 722 |

循环前 heap 为 12,586,300 字节，最后增加约 0.85 MiB；中间有回落，GPU 计数和节点没有逐轮增长。材质预热池是有意保留的有限程序缓存。该结果支持本轮循环内资源稳定，不是无限时长或所有设备零泄漏的证明；资源计数也不等于 VRAM 字节数。

桌面透射主题约 92–93 draw calls，银色约 49；手机 AZURE 降级约 33。玻璃和 HDR / depth 目标仍是主要成本，因此移动端关闭透射和后期，ECO 降低分辨率及几何细节。

## 重复运行

在 BLOOM 根目录运行工程检查：

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run start -- --port 3016
```

另开终端执行可选浏览器测试。测试脚本默认读取本地安装的 Playwright / Chromium，也支持传入现有工具和浏览器的绝对路径。本次使用环境提供的 Playwright 与 Edge，没有新增应用依赖：

```powershell
$playwrightModule = "C:\Users\48154\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\playwright\index.mjs"
$browserExecutable = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
npm run test:browser -- $playwrightModule $browserExecutable
npm run test:cinematic -- $playwrightModule $browserExecutable
npm run test:themes -- $playwrightModule $browserExecutable
npm run test:performance -- $playwrightModule $browserExecutable
```

可追加第三个参数指定基础 URL；默认 `http://127.0.0.1:3016`。换到其他机器，需要另行提供 Playwright 与其可用 Chromium，或传入对应路径；它们不属于生产构建所需依赖。

结果写入自动创建且被 Git 忽略的 `artifacts/`：`production-verification.json`、`cinematic-verification.json`、`theme-verification.json`、`production-performance.json` 及各视口截图。性能脚本包含正反向整段滚动、固定章节、四轮资源压力和触控视口采样。

## 未验证范围

真实 iPhone / Android / 平板、Safari / WebKit、Firefox、持续发热与低电量、真实音频设备中断、长时间运行和 Vercel 云端部署尚未验证。模拟 WebKit 音频单元测试不等于 Safari 真机验收。

启动、生产构建与本机浏览器验收已完成。部署步骤和 Preview 复测要求见[部署指南](../DEPLOYMENT.md)，实现和质量参数见[生产体验说明](production-experience.md)。
