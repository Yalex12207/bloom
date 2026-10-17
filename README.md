# BLOOM — The Art of Becoming

Every form begins with a fracture.

第五轮在现有五章节电影式滚动编排、交互式程序化 3D 花朵与六主题 Color Lab 上加入可选音频、音频响应、轻量 HDR Bloom / 景深和自适应质量。项目保留第一轮视觉、页面与导航，沿用 Next.js 16.4.1 App Router、React 19.2 和 TypeScript，没有重新初始化，也未新增运行时依赖。视觉与内置原创配乐均在项目内生成，不依赖外部模型、纹理、HDRI 或字体服务。

## 本地启动

推荐 Node.js 24 LTS，也支持 Node.js 20.19+ 或 22.13+ 的相应 LTS 版本。

```powershell
cd "C:\Users\48154\Documents\ChatGPT\New project\bloom"
npm ci
npm run dev
```

访问开发服务器输出的地址，默认 http://127.0.0.1:3000。如果默认端口占用，可运行 `npm run dev -- --port 3005`。

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run start
```

`npm run start` 使用构建好的生产版本，默认端口同为 3000；运行前关闭占用该端口的开发服务器，或传入 `-- --port 3005`。

测试使用 Node.js 24 的原生 TypeScript 类型擦除能力，覆盖固定种子、封闭曲面和 morph 数据、交互控制器、物理材质 dissolve、滚动采样、花瓣编排、六主题连续过渡，以及音频分析 / 生命周期和自适应质量。该命令可能输出模块类型自动检测提示，不影响测试运行。本轮构建与浏览器验收结果以交付时的实际运行记录为准。

## 保留的第一轮体验

- Next.js App Router、React、严格 TypeScript 与 Tailwind CSS 4。
- 全屏 Hero：BLOOM 巨型标题、逐字入场、展览式细节与滚动入口。
- 五章节：00 / THE AWAKENING、01 / GENESIS、02 / FRACTURE、03 / METAMORPHOSIS、04 / REBIRTH。
- 固定导航、Motion 章节菜单、原生章节锚点及随阅读位置变化的进度指示；第三轮统一由主时间轴发布当前章节。
- Zustand 保存章节和菜单状态；指针和场景动画不逐帧更新全局状态。
- GSAP + ScrollTrigger 的入场与滚动显现已汇入一个主时间轴；使用浏览器原生滚动，保留链接、滚轮、触屏与键盘行为。
- 自定义指针只在 `(hover: hover) and (pointer: fine)` 下启用。触屏保留原生操作。
- 统一 CSS Tokens，响应式移动端、桌面与大屏布局；SVG 和 CSS 构成独立的 2D 图形研究。
- 语义化标题、跳过导航、键盘焦点样式、Escape 关闭章节菜单。

## 第二轮：交互式数字花朵

首页的材质研究已替换为 Three.js + React Three Fiber + Drei 实时花朵。中央花蕊包含球形核心和实例化花粉；内、中、外三层花瓣使用带厚度的封闭弯曲曲面，具有杯状边缘与浅中央脊线。默认固定种子为 `48154`，为每片花瓣生成独立角度、半径、长宽、弯曲量、局部扭转、缩放、动画延迟及爆散位移。

花瓣网格在组件生命周期内持续复用。`CLOSED`、`BLOOMING`、`OPEN` 通过连续插值、分层延迟、旋转和 GPU morph targets 展开；闭合 morph 同时提供位置与法线，不依靠销毁、重建 Mesh 动画。蓄力由同一个动画时钟累积，松手触发短暂局部爆散并复原。

这些局部控制继续可用。主动调节展开状态会暂时覆盖花朵的绽放量；继续滚动后平滑归还主时间轴。拖动旋转、惯性、脉冲与蓄力保存在局部 refs 中，不反向修改滚动进度。

| 操作 | 结果 |
| --- | --- |
| 鼠标移入花朵区域并移动 | 轻微指针视差 |
| 鼠标或单指拖动花朵 | 自由旋转；松手后惯性逐渐衰减 |
| 点击花心 | 能量环与由内向外传播的花瓣脉冲 |
| 在花心静止长按约 260 ms 后松开 | 蓄力振动、局部爆散、自动复原 |
| 四种材质色钮 | 在银色金属、蓝色透射玻璃、红色亮漆、紫色幻彩之间切换 |
| `CLOSED` / `BLOOM` / `OPEN` | 闭合、重播绽放、展开 |
| `UNFOLD` / `GLOW` 滑块 | 连续调节展开程度、花心发光强度 |
| `HOLD TO CHARGE` | 直接以指针或键盘触发脉冲、蓄力及释放 |
| 重置按钮 / 微粒按钮 | 复位旋转 / 开关悬浮微粒 |

花朵区域可以获得键盘焦点：方向键旋转，按住 Shift 加大旋转步长，Home 复位，Enter 或空格触发脉冲。聚焦 `HOLD TO CHARGE` 后，可按住 Enter 或空格蓄力，松开释放。原生按钮与滑块均可使用键盘操作。

拖动使用原生 Pointer Events、指针捕获和取消处理；从花心拖动超过 6 px 会取消蓄力并切换为旋转。触摸手势只由花朵区域接管，页面其余区域保留原生滚动与链接行为。失焦、取消指针、隐藏页面和卸载会清理交互状态。

### 材质与灯光

第二轮的四种材质入口和物理表面效果继续保留。以下记录第二轮基础参数；第四轮的实时场景改为两个持续复用的 `MeshPhysicalMaterial` 接收统一 ThemeFrame，六主题与当前移动端降级见下方第四轮说明。

| 材质 | metalness | roughness | transmission | thickness | ior |
| --- | --- | --- | --- | --- | --- |
| SILVER / CHROME | 0.96 | 0.20 | 0 | 0.15 | 1.50 |
| AZURE / GLASS | 0.05 | 桌面 0.11 / 移动 0.18 | 桌面 0.82 / 移动 0.55 | 桌面 0.28 / 移动 0.12 | 1.46 |
| CRIMSON / LACQUER | 0.58 | 0.19 | 0 | 0.18 | 1.52 |
| VIOLET / IRIDESCENT | 0.72 | 0.22 | 0 | 0.20 | 1.42 |

紫色材质使用 iridescence 与 `180–620` 的膜厚范围。第二轮的银色 anisotropy、紫色 sheen 为材质研究的一部分；第四轮实时花瓣统一使用双材质渐变，移动端完全禁用 transmission，以降低透射负担。

灯光包括柔和环境光、暖白主光、冷色边缘光、红色侧光与花心局部点光。Drei Lightformer 在本地生成反射环境，无需下载 HDRI。ACES 色调映射配合核心 emissive、局部点光和自定义 GLSL 光晕提供可调发光；第五轮在桌面高质量模式额外加入真实 HDR Bloom / 景深，见下方第五轮说明。

### 性能、生命周期与降级

| 质量参数 | 桌面 | 移动端（宽度 ≤ 767 px） |
| --- | --- | --- |
| 花瓣数量（内 / 中 / 外） | 42（9 / 14 / 19） | 27（6 / 9 / 12） |
| 每片曲面分段（纵 / 横） | 34 / 14 | 22 / 8 |
| DPR 上限 | 1.5 | 1.15 |
| transmissionResolutionScale | 0.5 | 0.35 |
| 环境分辨率 | 128 | 64 |
| 花粉实例 / 悬浮微粒 | 76 / 56 | 40 / 24 |

上表保留第二轮基础质量参数。第五轮手机和触摸平板默认使用 27 片花瓣、18 个悬浮微粒；ECO 模式使用 27 片花瓣、10 个微粒并进一步降低 DPR。当前各档完整参数见[生产体验说明](docs/production-experience.md)。

三层花瓣分别共享一份 Geometry；第二轮的四种材质入口在第四轮接入同一个主题控制器，实时花瓣复用两个物理材质。花粉使用 InstancedMesh。帧循环以可变控制器与 refs 更新变换和 morph 权重，避免逐帧写入 React 或 Zustand 状态。组件卸载或移动端质量切换时释放自建 Geometry、Material 与粒子资源。

Canvas 使用 `frameloop="demand"`，在场景活跃且未启用减少动态效果时持续请求下一帧。第三轮 Canvas 固定覆盖视口，贯穿章节复用，滚动到下一章节不会卸载它；页面隐藏时暂停，滚动更新与控制操作会请求绘制。反射环境只生成一帧。客户端延迟加载保留首屏轮廓占位，并由错误边界与 WebGL2 能力检测处理不支持的设备及上下文丢失。

`prefers-reduced-motion` 下关闭自动漂浮、指针视差、惯性、悬浮微粒、脉冲及爆散位移，状态变化直接落到指定形态，保留手动控制、静态花朵和章节内容。无 WebGL2 时显示二维轮廓，章节导航与页面内容仍可访问。

## 第三轮：统一滚动叙事

五个章节的叙事区间为 `0–0.2`、`0.2–0.4`、`0.4–0.6`、`0.6–0.8`、`0.8–1`。一个 GSAP 主时间轴测量实际章节位置和 `scroll-margin-top`，将原生滚动距离映射为上述区间：黑暗中的红色核心与花瓣显现 → 分层绽放与相机绕行 → 爆散及短暂红色冲击 → 花瓣重排为紧凑螺旋雕塑 → 重返花形、红色波纹与镜头后退。

DOM 标题遮罩、灯光、相机、花瓣姿态、粒子与材质读取同一个可变 `CinematicRuntime.frame`。采样由绝对进度决定，支持倒放和任意跳转。场景沿用固定种子的真实曲面花瓣，雕塑通过既有网格的位置、旋转、缩放与 morph 重排而成，不会焊接网格或改变拓扑。

`GENESIS`、`FRACTURE`、`REBORN` 是同一深度缓冲中的三个文字平面，字形由系统字体在本地 Canvas 生成。片元 Shader 根据字形像素 alpha 和揭幕阈值绘制，真实花瓣可在文字前后穿行；前一章节文字会淡出，避免在结尾叠加。花瓣 dissolve 使用物理材质中的噪声裁切与红色边缘，不是整体透明度替代。

相机采样 Z 范围为 `9.6–13`，与花朵中心保持安全距离；移动端进一步后退镜头并缩小花朵。`REPLAY EXPERIENCE` 清理局部交互并原生滚动回开头，进度仍由滚动主时间轴发布。减少动态效果模式固定相机与花朵整体变换，关闭冲击、波纹与装饰运动，保留章节内容与叙事姿态。

完整关键点、架构、性能注意事项和手动验收步骤见 [电影式时间轴说明](docs/cinematic-timeline.md)，第三轮实际执行结果见 [第三轮验收记录](docs/verification-round3.md)。第三轮当时未引入全屏后处理；第五轮新增效果受质量档位、设备类型与减少动态效果偏好控制。

## 第四轮：统一色彩系统

Color Lab 提供 `CRIMSON #F04456`、`AZURE #168BFF`、`VIOLET #A46BFF`、`SILVER #C8DDE9`、`DUALITY #F04456 / #168BFF`、`NEBULA #168BFF / #A46BFF` 六主题。默认 AUTO 依次跟随五章节：CRIMSON → SILVER → AZURE → NEBULA → DUALITY。点击主题或第二轮材质快捷色钮切入 MANUAL，跨章节继续保持；AUTO 会回到当前章节的配色。

主题由一个外部时钟驱动的 ThemeController 在 1.2 秒内以 smoothstep 混合，快速连点从当前可见颜色继续。ThemeProvider 订阅既有 CinematicRuntime 的 chapter，不增加 ScrollTrigger；只在页面可见且有待完成渐变时挂载一个 GSAP ticker 回调。颜色、PBR 参数、灯光、花心、双色粒子、3D 文字、氛围与 DOM 强调色同步更新，frame 和 THREE.Color 引用始终复用。

两份物理材质按花瓣索引交错使用，曲面 Shader 以反向渐变组合两种颜料，并保留原 dissolve。NEBULA 是蓝紫渐变玻璃；SILVER 使用极简冷光。反射环境为中性 Lightformer，只生成一帧。移动端将 transmission 设为 0，roughness 加上目标 transmission × 0.12，thickness 乘 0.45，DPR 与花瓣数量沿用前轮。颜色的时间渐变独立于绝对滚动几何姿态，换色不会改动镜头路径或章节进度。

Color Lab 在桌面可展开，在手机默认折叠，支持键盘与 Escape 收起。完整主题配置、API、成本与手动验收说明见 [色彩系统说明](docs/color-system.md)，本轮实际执行结果见 [第四轮验收记录](docs/verification-round4.md)。减少动态效果模式即时应用配色；无 WebGL 时 DOM 配色与导航仍可使用。

## 第五轮：声音与生产体验

默认 `SOUND OFF`，初次访问不创建 AudioContext，也不请求音轨。用户点击 SOUND 后，在原始用户手势内调用 `resume()`，再延迟加载、解码并循环播放内置配乐。声音面板提供音量、频段仪表和本地文件选择；本地音频只在浏览器内解码，不上传。标签页隐藏时暂停，返回后需要再次主动播放。

内置 `BLOOM — Study No. 1` 为 32 秒、22050 Hz、mono PCM16 原创合成 WAV，约 1.4 MB，授权见 [CC0 说明](public/audio/LICENSE.md)。运行 `npm run audio:generate` 可确定性重建。自选音频上限为 12 MiB、120 秒、双声道和 48 MiB 解码内存，实际格式支持取决于浏览器。

一个 AudioController 与 AudioSignal 复用频谱、波形和四个平滑数值，AudioProvider 仅在播放或收尾衰减时挂载一个条件 GSAP ticker。低频 / RMS 驱动有界的花心、整体呼吸与主光变化，中频映射花瓣摆动和细微粗糙度变化，高频映射粒子闪动与微振动。声音、主题与滚动分别持有状态；音频不会修改五章节进度或相机姿态。减少动态效果时关闭音频视觉映射，仍可主动收听。

桌面高质量模式使用 HDR / depth RenderTarget 和屏幕 Shader 实现轻量 Bloom 与景深；手机、触摸平板、减少动态效果、BALANCED / ECO 档位关闭后期。FrameBudget 经过预热和持续慢帧窗口后逐档降低质量，ECO 按钮可手动降低分辨率、粒子、曲面细节和透射成本。原始场景和五章导航在后期失败时继续可用。

模块、映射幅度、质量矩阵、生命周期与手动验收步骤见[生产体验说明](docs/production-experience.md)。本机生产构建、浏览器与性能结果见[第五轮验收记录](docs/verification-round5.md)。项目已提供 Vercel 配置与[部署指南](DEPLOYMENT.md)，当前未实际部署。

可选浏览器测试提供 `test:browser`、`test:cinematic`、`test:themes` 和 `test:performance`。它们读取 Playwright 和浏览器路径，不向应用增加运行时依赖。先在另一个终端运行 `npm run start -- --port 3016`，再按[验收记录中的命令](docs/verification-round5.md#重复运行)执行。截图和原始 JSON 写入被 Git 忽略的 `artifacts/` 目录。

## 目录

```text
src/
  app/                 # App Router、metadata、图标
  audio/
    AudioController.ts # 用户手势启动、音源 / 解码 / 增益 / 分析与资源清理
    AudioSignal.ts     # 复用 FFT / 波形存储、低中高频与 RMS attack / release
  components/
    audio/
      AudioProvider.tsx # 单一音频控制器、条件 GSAP ticker 与可见性暂停
      AudioDock.tsx     # 默认静音、音量、频段仪表和本地文件
    effects/
      experience-provider.tsx # 单一 GSAP 主时间轴、实际章节测量及 DOM 显现
      cinematic-context.tsx   # 一个共享 CinematicRuntime
      cinematic-overlay.tsx   # 暗幕、信箱边框、速度线与 Replay
      custom-cursor.tsx       # 桌面自定义光标
    layout/            # Hero 与章节布局
    navigation/        # 固定导航、章节进度
    theme/
      ThemeProvider.tsx # 共享主题控制器、条件 GSAP ticker 与 DOM Tokens
      ColorLab.tsx      # 六主题、AUTO / MANUAL 与可折叠面板
      color-lab.module.css # 响应式仪表样式
    scene/
      scene-stage.tsx  # 客户端延迟加载、可见性检测、轮廓回退与错误边界
      flower/
        FlowerScene.tsx       # Canvas、灯光、渲染生命周期与控制面板
        ProceduralFlower.tsx  # 花心、三层持久网格、花粉、微粒与能量效果
        PetalGeometry.ts      # 有厚度的曲面及闭合 position/normal morph
        FlowerMaterials.ts    # 双持久 PBR、曲面双色渐变、dissolve 与释放
        FlowerController.ts   # 固定种子、花瓣描述符及无 React 状态动画控制器
        CinematicCamera.tsx   # 滚动相机、移动端构图与拖动区域投影
        CinematicTypography.tsx # 三个深度文字平面、本地字形纹理及片元揭幕
        CinematicEffects.tsx  # 桌面 HDR Bloom、深度景深、透明合成及失败回退
        ScenePreparation.ts   # 加载阶段预热物理材质 / 透射背面程序和字形纹理
        flower.test.mjs       # 原生 Node 测试
        FlowerMaterials.test.mjs # 物理材质与 dissolve 生命周期测试
    typography/        # 章节标题
    ui/                # 原创 SVG 图形
  hooks/               # 减少动态效果偏好与 useFlowerInteraction 原生指针/键盘控制
  lib/
    chapters.ts        # 类型化章节元数据
    cinematic-state.ts # 可逆滚动采样、关键点、共享 Runtime
    petal-cinematic-pose.ts # 花瓣爆散与螺旋重排的纯函数
    ThemeController.ts # 六主题、线性空间渐变、模式与订阅
    FrameBudget.ts     # 持续慢帧降档、设备质量参数
    *.test.mjs         # 任意跳转、倒放、连续性、相机与姿态边界测试
  store/               # Zustand 体验状态
  styles/              # 设计 Tokens、响应式样式与 cinematic.css
docs/
  cinematic-timeline.md # 第三轮架构、关键点与手动验证指南
  color-system.md      # 第四轮色彩配置、API、降级与手动验证指南
  production-experience.md # 第五轮声音、后期、质量、生命周期和验收指南
public/audio/          # 原创版本化 WAV 与 CC0 授权
scripts/generate-score.mjs # 无外部样本的确定性配乐生成脚本
scripts/verify-production.mjs # 可选 Playwright 生产交互、布局及回退测试
scripts/measure-production.mjs # 实测帧时间及 GPU / heap 压力循环
DEPLOYMENT.md          # Vercel 配置、Preview 验收与部署步骤
vercel.json            # Next.js 框架、npm ci 与构建命令
```

主要 Tokens 位于 `src/styles/globals.css`：背景 `#0A0A0C`、Crimson `#F04456`、Azure `#168BFF`、Violet `#A46BFF`、Silver `#C8DDE9`。字体使用本地系统无衬线、Georgia 和等宽字体，避免远程字体阻塞首次呈现。

## 后续范围

五章节滚动编排、局部交互、六主题、可选声音与轻量桌面后期已接入同一持续场景。后续可继续打磨镜头、装置性能与艺术节奏；当前没有网格拓扑重建、体积流体或色差处理链。iOS / Android 真机及 Safari 仍需实测，不承诺固定帧率。

当前实现没有后端、账号、分析脚本或内容管理系统，无需环境变量或数据库。依赖解析版本由 `package-lock.json` 锁定。交付包含可本地运行的 Next.js 项目、Vercel 配置与部署文档，尚未上线。
