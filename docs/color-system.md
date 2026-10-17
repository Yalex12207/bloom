# BLOOM 第四轮：统一色彩系统

第四轮在前轮持续 Canvas、真实曲面花朵和五章节主时间轴上加入六主题 Color Lab。换色控制花瓣物理表面、灯光、花心、粒子、3D 文字、氛围与 DOM 强调色，保留原有拖动、展开、脉冲、蓄力、导航和 Replay。

## 六主题与章节映射

| 主题 | accent | secondary | 表面方向 |
| --- | --- | --- | --- |
| CRIMSON | `#F04456` | `#8B172F` | 红色亮漆、暖主光 `#FFD8CB` |
| AZURE | `#168BFF` | `#80E2E8` | 蓝色透射玻璃、冷色轮廓 |
| VIOLET | `#A46BFF` | `#E6A3EF` | 紫色幻彩、柔和粉紫反射 |
| SILVER | `#C8DDE9` | `#A9C6DE` | 极简冷银、主光 `#EDF5FF` |
| DUALITY | `#F04456` | `#168BFF` | 红蓝双颜料与双色粒子 |
| NEBULA | `#168BFF` | `#A46BFF` | 蓝紫渐变玻璃，petalA `#2876DB`、petalB `#9062DA` |

AUTO 默认跟随已有 CinematicRuntime 的 chapter：

| 章节 | 自动主题 |
| --- | --- |
| 00 / THE AWAKENING | CRIMSON |
| 01 / GENESIS | SILVER |
| 02 / FRACTURE | AZURE |
| 03 / METAMORPHOSIS | NEBULA |
| 04 / REBIRTH | DUALITY |

选择任一主题立即进入 MANUAL。手动主题跨章节保持，继续滚动和 Replay 不会隐式取消它；点击 AUTO 恢复当前章节的目标主题。VIOLET 保留为可主动选择的主题。状态属于当前挂载的体验会话，没有写入 localStorage；刷新后按当前恢复的章节重新进入 AUTO。

桌面主要 PBR 参数如下。clearcoat 均为 1；更完整的灯光与氛围配置保存在 `THEMES`：

| 主题 | metalness | roughness | transmission | thickness | ior | iridescence | gradientMix |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CRIMSON | 0.58 | 0.19 | 0 | 0.18 | 1.52 | 0 | 0.22 |
| AZURE | 0.05 | 0.11 | 0.82 | 0.28 | 1.46 | 0 | 0.45 |
| VIOLET | 0.72 | 0.22 | 0 | 0.20 | 1.42 | 1 | 0.55 |
| SILVER | 0.96 | 0.20 | 0 | 0.15 | 1.50 | 0 | 0.20 |
| DUALITY | 0.68 | 0.18 | 0.12 | 0.20 | 1.48 | 0.20 | 0.12 |
| NEBULA | 0.18 | 0.20 | 0.58 | 0.24 | 1.46 | 0.85 | 1 |

## 一个配色状态与一个按需时钟

`ThemeProvider` 位于 `CinematicContextProvider` 内部，持有一个 ThemeController，并订阅同一个 cinematic.chapter。它不创建新的 ScrollTrigger，不单独计算章节，也不替换原生滚动。

控制器只保存纯逻辑：目标主题、AUTO / MANUAL、当前章节、渐变状态，以及复用的颜色与数值帧。ThemeProvider 只在 `transitioning === true` 且页面可见时添加一个 GSAP ticker 回调，向 `advance(seconds)` 提供增量时间；渐变结束、页面隐藏或卸载后移除回调。恢复标签页继续未完成的混合，不把隐藏时间一次性消耗为跳色。

一次过渡持续 1.2 秒，使用 smoothstep。新的选择会先捕获当前可见 frame，再从该值趋近下一个目标；快速连点不会回到上一个主题端点。重复选择同一目标不重新开始过渡。主题名和 MANUAL / AUTO 等元数据可立即改变，但视觉颜色通过同一渐变帧同步。

THREE.Color 将十六进制 sRGB 颜色转换到线性工作空间，再用 `lerpColors` 插值。场景以 `Color.copy()` 更新已存在的 Color / uniform；DOM 通过 `getStyle()` 输出可显示的 CSS 颜色。frame、其中十二个 Color 对象和材质实例不会随每帧混合重建。

颜色拥有独立的时间插值，花瓣几何和镜头仍由第三轮绝对滚动进度采样。滚动倒放会精确还原几何姿态；AUTO 的颜色是在章节目标变化后渐变到新主题，不是回放颜色的历史帧。手动换色不改变 progress、相机轨迹、花瓣随机种子或形变拓扑。

## API 与帧契约

`src/lib/ThemeController.ts` 导出 `THEME_IDS`、`ThemeId`、`ThemeMode`、`CHAPTER_THEMES`、`THEMES`、`ThemeDefinition`、`ThemeFrame`、`ThemeSnapshot` 与 `ThemeController`。

| API | 用途 |
| --- | --- |
| `readonly frame` | 同一个可变主题帧，供场景和 DOM 读取 |
| `getSnapshot()` | 返回稳定元数据 `{ theme, mode, chapter, transitioning }`；只有元数据改变才替换对象 |
| `subscribe(listener)` | 元数据订阅，返回清理函数，可用于 useSyncExternalStore |
| `subscribeFrame(listener)` | 每次帧推进或即时应用目标后的通知，返回清理函数 |
| `selectTheme(id)` | 选主题并进入 MANUAL |
| `setAuto(enabled)` | 切换模式；启用时回到当前章节主题 |
| `setChapter(index)` | 记录有效章节；仅 AUTO 改变主题目标 |
| `setReducedMotion(enabled)` | 启用时立即完成已有过渡，后续目标也即时应用 |
| `advance(seconds)` | 由外部时钟推进混合，无内部 RAF / GSAP / 浏览器监听 |
| `progress` | 当前过渡的归一化时间，初始和完成时为 1 |

ThemeFrame 的 Color 字段为 `accent`、`secondary`、`petalA`、`petalB`、`keyLight`、`rimLight`、`fillLight`、`core`、`particleA`、`particleB`、`atmosphereA`、`atmosphereB`。数字字段为 PBR 参数，以及 `gradientMix`、`particleIntensity`、`keyIntensity`、`rimIntensity`、`fillIntensity`、`coreIntensity`。控制器与 DOM / WebGL 资源所有权分离，不持有 Mesh、Material、Texture 或窗口事件。

## 表面、灯光与 DOM 同步

实时花瓣使用两份持续存在的 MeshPhysicalMaterial，按 `index % 2` 交错分配。primary 与 secondary 共享两种 pigment 色、dissolve 和主题 accent uniform，曲面渐变方向相反。片元 Shader 在 PBR 灯光计算前根据 morph 后的曲面位置混合颜料，保留 transmission、clearcoat、iridescence 和原先的噪声 dissolve；dissolve 边缘现在跟随主题 accent。

渐变量、Color 和 PBR 数值直接更新既有材质。transmission / iridescence 是否为零会影响物理 Shader 功能分支，跨越此类边界可能需要对应 Shader 版本；不会每帧强制重编译，也不会每次选色重建几何或材质。

主光、边缘光、补光与核心光从 ThemeFrame 复制 Color，并把主题倍率与第三轮叙事强度组合。粒子同时读取 particleA / particleB 与 particleIntensity；3D 标题读取 accent / secondary。反射环境使用中性 Lightformer、`frames={1}`，主题变化不会反复生成环境贴图。

ThemeProvider 在 `.theme-root` 输出：

- `--theme-accent`
- `--theme-secondary`
- `--theme-atmosphere-a`
- `--theme-atmosphere-b`
- `--crimson`，作为第一轮原有强调色 Token 的兼容入口

原有链接、仪表、导航和装饰继承强调 Token，氛围层读取同一对背景色。`--crimson` 的名称继续兼容既有设计，实际值跟随当前主题。色彩系统不需要 WebGL 才能更新 DOM。

## Color Lab 与原有控制

Color Lab 提供六主题与 AUTO / MANUAL 切换，原有四个材质快捷钮也调用同一个 `selectTheme()`。两个入口的主题选择、模式与状态提示保持同步。移动端展开 Color Lab 时暂时隐藏原花朵控制面板，收起后恢复，减少重叠和误触；桌面展开时原花朵控制面板继续可用。

桌面默认展开，手机默认折叠；标题按钮使用 aria-expanded / aria-controls。主题按钮提供 aria-pressed，自动模式按钮使用 switch 语义，状态文案为低频 aria-live 通知。Escape 收起并在需要时恢复焦点，面板不是锁住页面的模态对话框。触屏拖动区域之外继续原生页面滚动。

## 成本与降级

配色本身只插值十二个 Color 与十四个数字，不分配 GPU 几何或新贴图；两种颜料和灯光通过既有引用更新。全视口 Canvas 的填充、玻璃透射缓冲和第三轮三张字形纹理仍是主要成本。

| 质量项目 | 桌面 | 移动端 |
| --- | --- | --- |
| 花瓣数量 | 42 | 27 |
| DPR 上限 | 1.5 | 1.15 |
| transmission | 读取主题目标 | 始终为 0，避免透射场景 Pass |
| roughness | 读取主题目标 | 主题 roughness + 目标 transmission × 0.12 |
| thickness | 读取主题目标 | 目标 thickness × 0.45 |
| transmissionResolutionScale | 0.5 | 保留 0.35 配置；当前材质不启用透射 |
| 中性反射环境 | 128，只生成一帧 | 64，只生成一帧 |

移动端保留双色、渐变、清漆与轮廓，把玻璃视觉近似为成本更低的物理表面。减少动态效果模式即时切换主题并移除 Color Lab 动画；旧有静态镜头、章节阅读和键盘控制继续有效。WebGL2 不可用或上下文丢失时显示二维回退，Color Lab 的模式与 DOM 强调色仍可更新。

ThemeProvider 卸载时移除 ticker、帧 / 元数据 / 章节订阅、媒体与可见性监听。场景资源按各组件原有生命周期释放；不按主题创建新的 Canvas、环境、文字纹理或花瓣几何。

## 文件职责

| 文件 | 职责 |
| --- | --- |
| `src/lib/ThemeController.ts` | 六主题配置、模式、线性渐变、稳定帧和订阅 |
| `src/lib/ThemeController.test.mjs` | 主色规范、主题终点、连续中断、模式恢复、引用与降级测试 |
| `src/components/theme/ThemeProvider.tsx` | 共享主题 Context、章节订阅、条件 GSAP ticker、CSS Tokens |
| `src/components/theme/ColorLab.tsx` | 六主题、AUTO / MANUAL、可折叠与可访问界面 |
| `src/components/theme/color-lab.module.css` | 桌面与手机面板、颜色提示、减少动态效果样式 |
| `src/components/scene/flower/FlowerMaterials.ts` | 双持久 PBR、反向曲面 pigment、共享 dissolve 与移动端近似 |
| `src/components/scene/flower/FlowerScene.tsx` | 主题灯光、材质快捷钮与渲染失效通知 |
| `src/components/scene/flower/ProceduralFlower.tsx` | 花瓣表面、花心、能量与双色粒子更新 |
| `src/components/scene/flower/CinematicTypography.tsx` | 3D 标题同步读取主题颜色 |
| `src/components/effects/experience-provider.tsx` | 原有滚动主时间轴及 Provider 嵌套，不新增 ScrollTrigger |

## 命令与手动验证

```powershell
npm ci
npm run dev
```

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run start
```

单独运行主题逻辑测试：

```powershell
node --experimental-strip-types --test src/lib/ThemeController.test.mjs
```

测试覆盖六主题精确终点、指定主色与 NEBULA 蓝紫规范、线性工作空间插值、快速中断连续性、重复目标、AUTO / MANUAL / 倒序章节、引用稳定、订阅清理及减少动态效果。材质测试覆盖双材质复用、渐变 / dissolve uniform、移动端 transmission=0 和物理功能边界。浏览器与生产构建结果由最终交付记录报告，本指南不预先声明完成真实浏览器验收。

手动验证建议：

1. 慢速走完五章节，确认 AUTO 对应 CRIMSON → SILVER → AZURE → NEBULA → DUALITY，灯光、花心、粒子、文字和 UI 强调色同步趋近目标。
2. 在 1.2 秒内快速连点 CRIMSON、AZURE、NEBULA、SILVER，观察中间颜色持续衔接，没有回跳到旧端点；重复点击当前目标不会重启。
3. 手动选 VIOLET 后跨过多个章节，再 Replay；模式和主题继续保持 MANUAL。点击 AUTO，应回到此刻所在章节的主题。
4. 从结尾倒滚到开头并快速跳转非相邻章节；几何姿态继续由绝对 scroll 决定，颜色仅在当前目标之间独立混合。
5. 在 `#fracture`、`#metamorphosis`、`#rebirth` 刷新或恢复页面，确认 AUTO 跟随恢复后的章节；隐藏标签页再恢复，确认没有时间跳跃。
6. 展开 / 收起 Color Lab，检查主题键盘操作、AUTO 与 Escape 焦点；移动端收起后原花朵控制面板应恢复，桌面展开时它应继续可用。原四材质快捷钮应同步切入 MANUAL。
7. 用真实触屏测试手机默认折叠、按钮操作、面板滚动和花朵区域外的页面滚动；选择 AZURE / NEBULA 检查降级玻璃仍有清晰轮廓。
8. 开启减少动态效果，确认主题即时完成、面板无过渡而手动控制仍可用；模拟 WebGL 上下文丢失，确认二维回退、DOM 配色和章节导航可访问。

后续仍可打磨配色节奏、具体设备上的玻璃近似和艺术细节。主题系统不增加音频、完整后处理链、几何拓扑重建或另一条滚动时间轴。
