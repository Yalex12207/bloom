# BLOOM 第三轮：电影式滚动时间轴

第三轮扩展现有五章节与第二轮花朵，没有创建新的路由或重建项目。原生 DOM 页面仍负责内容、链接与滚动；一个延迟加载的固定 Canvas 持续承载花朵、灯光、相机和深度文字。

## 滚动区间与关键点

叙事进度定义在 `[0, 1]`。章节边界固定为 `0、0.2、0.4、0.6、0.8、1`，每个区间映射到页面上该章节的实际滚动距离，而不是假设所有章节等高。`TIMELINE_CHAPTERS` 中的关键点使用绝对叙事进度。

| 区间 | 章节 | 画面与关键点 |
| --- | --- | --- |
| 0–0.2 | 00 / THE AWAKENING | 暗红核心、闭合花朵；`0.025 signal-in-the-dark`、`0.12 title-unmasked`、`0.2 first-petal-visible`。dissolve 从 1 降到 0.1，相机 Z 从 12 推进至 9.6。 |
| 0.2–0.4 | 01 / GENESIS | 花瓣分层绽放，bloom 从 0 至 1；`0.28 camera-orbit`、`0.4 full-bloom`。花朵从偏左构图进入中央。 |
| 0.4–0.6 | 02 / FRACTURE | 花瓣从中央散开，scatter 从 0 至 1；`0.455 red-shock` 为有界短冲击，`0.6 petals-in-flight` 时镜头退至 Z=13。 |
| 0.6–0.8 | 03 / METAMORPHOSIS | 爆散量下降，sculpture 从 0 至 1；`0.73 spiral-observation`、`0.8 compact-helix`。花瓣收拢为抽象螺旋雕塑，相机沿半径收缩的参数化螺旋前进；两端速度归零。 |
| 0.8–1 | 04 / REBIRTH | sculpture 降至 0，重返完全绽放；`0.895 red-wave`、`1 quiet-distance`。红色波纹消退，镜头退至 Z=13，保留 Replay 操作。 |

插值在关键帧间使用 smoothstep。所有视觉参数由当前绝对进度计算，不依赖“已经播放过多少帧”；倒放、快速跳转与反复采样得到相同叙事姿态。chapter 和 chapterProgress 是区间元数据，会在章节边界切换；物理、材质和视觉通道连续。NaN、越界值与无穷值会被规范化到有效端点。

桌面主要花朵位置为开场 `(1.3, 1.2, 0)`、Genesis `(-1.4, 0, 0)`、Fracture `(0, 0, 0)`、Metamorphosis `(1.5, 0, 0.1)`、Rebirth `(1, 0.6, 0)`。相机和观察目标分别采样，以保留留白和画面偏移。相机 Z 全程不小于 9.6，花朵中心 Z 不超过 0.1；不会把轨迹直接穿过花朵中心。移动端缩小花朵并增加相机距离。

## 一个滚动所有者

`ExperienceProvider` 内的主时间轴是唯一滚动编排所有者，ScrollTrigger ID 为 `bloom-master`：

1. 测量五个原生章节的绝对位置、`scroll-margin-top` 和文档终点。
2. 按各章节的实际长度，为一个 GSAP timeline 创建五段线性 progress tween。
3. 一个 ScrollTrigger 驱动整条 timeline；普通模式使用 `scrub: 0.4`，减少动态效果模式直接跟随。
4. 将进度发布到共享 `CinematicRuntime`，DOM 样式、章节状态与 R3F 读取同一帧。
5. resize、字体完成、页面恢复及尺寸变化时刷新测量；重新加载或返回页面时直接采样当前滚动位置。

这里没有替换浏览器的滚轮、滚动条或页面触摸滚动。章节锚点继续由浏览器处理，CSS sticky 只改变构图。组件卸载会销毁 timeline / ScrollTrigger，移除监听与观察器，并恢复它设置的 DOM 内联样式。

## 共享叙事与局部交互

`CinematicContextProvider` 每次挂载只创建一个 `CinematicRuntime`。它保留同一个可变 `frame` 对象，通过 `update()`、`subscribe()` 与 `requestRender()` 连接 DOM 和 WebGL，不逐帧触发 React 状态更新。`sampleCinematic(progress, out, reducedMotion)` 在提供 out 时不创建新对象；Runtime 自身不使用浏览器全局监听、计时器或 React。

叙事帧负责镜头、整体花朵位置与旋转、绽放 / 爆散 / 雕塑量、灯光、粒子范围、dissolve、文字揭幕和红色冲击。第二轮的拖动旋转、惯性、指针视差、点击脉冲与蓄力保存在局部 refs / FlowerController 中，作为偏移叠加；它们不会写回时间轴的 progress。

`CLOSED`、`BLOOM`、`OPEN` 和 UNFOLD 会取得局部绽放控制权。离开当前滚动位置后，这个覆盖权重平滑回到主时间轴；拖动结束并闲置后，旋转偏移也逐渐回到叙事朝向。材质、GLOW 和微粒开关继续可用。

`REPLAY EXPERIENCE` 通过 `resetInteraction()` 通知花朵清理局部旋转、蓄力和展开覆盖，然后原生滚动到开头。Replay 不直接把 Runtime progress 强制改成 0；滚动主时间轴持续作为进度所有者。减少动态效果模式直接回到开头，普通模式使用浏览器平滑滚动。

## 花瓣、材质与文字深度

固定种子 `48154` 生成桌面 42 / 移动 27 片曲面花瓣。三层共享带厚度的 Geometry，四个共享 MeshPhysicalMaterial 保留银色金属、蓝色玻璃、红色亮漆、紫色幻彩效果。`samplePetalPose()` 根据同一叙事帧，把持久网格从花形移动到爆散轨迹，再重排为紧凑螺旋：位置、旋转、缩放及闭合 morph 改变，几何拓扑不会焊接或重建。爆散花瓣分布在文字平面的前后两侧。

花瓣 dissolve 在 MeshPhysicalMaterial 的 `onBeforeCompile` 中注入，沿 morph 后的曲面坐标采样噪声、逐片元 discard，并绘制细红边。四种材质共用同一 dissolve uniform，晚于滚动首次切换到的材质也读取当前值。这保留物理灯光与透射，而不是用整体 opacity 替代显现。

`GENESIS`、`FRACTURE`、`REBORN` 是三个独立的真实深度文字平面。字形由本地 2D Canvas 使用系统字体生成 alpha 纹理，无需字体文件或图片请求。片元 Shader 用字形像素 alpha 与沿 UV 推进的揭幕遮罩计算可见像素；平面 depthTest 开启、depthWrite 关闭，与花瓣共用深度缓冲。字形透明区域不会遮住花瓣，位于文字前方的花瓣可以挡住字形。

文字平面相对花朵的 Z 偏移分别为 `-0.4、0.2、-0.25`，并朝向当前相机。Genesis 在 `.215–.29` 揭幕、`.375–.43` 淡出；Fracture 在 `.41–.48` 揭幕、`.59–.65` 淡出；Reborn 在 `.815–.89` 揭幕。结尾以 DOM 的 REBORN 为主要标题，3D Reborn 仅在桌面保留很淡的回声；移动端隐藏该回声，避免重复字形。前两张文字平面不会在 Rebirth 保持全部可见。

## 生命周期与性能边界

场景固定覆盖整个视口，滚动进入下一章节不会创建新的 Canvas 或花朵。Canvas 保留 `frameloop="demand"`；普通模式中可见页面会继续请求下一帧，以支持局部惯性、蓄力和微粒。隐藏页面后暂停，滚动采样、控制操作与恢复可见时请求绘制。固定视口场景不应理解为“离开首页 Hero 就停止渲染”。

| 成本控制 | 桌面 | 移动端 |
| --- | --- | --- |
| DPR 上限 | 1.5 | 1.15 |
| 花瓣数量 | 42 | 27 |
| 花瓣曲面分段 | 34 × 14 | 22 × 8 |
| transmissionResolutionScale | 0.5 | 0.35 |
| Lightformer 环境分辨率 | 128，生成一帧 | 64，生成一帧 |
| 每张文字纹理 | 2048 × 256，无 mipmaps | 1024 × 128，无 mipmaps |

玻璃透射仍需要额外场景渲染与缓冲；全视口 Canvas 的像素填充成本随视口面积和 DPR 的平方增长。三张文字纹理仅 RGBA 像素约为桌面 6 MiB / 移动端 1.5 MiB，此外还有环境、透射缓冲与几何 / morph 数据。当前限制质量但不承诺所有移动 GPU 都能保持同样帧率。

Geometry、Material、字形纹理、订阅、计时器与事件监听在所属组件卸载时释放。三张文字平面共享平面 Geometry；第二轮花瓣继续共享层级 Geometry 和材质，不在 scroll 或帧循环中重建 Mesh。项目尚未加入全屏 Bloom、景深、色差或多级后处理链。

## 减少动态效果与触屏

`prefers-reduced-motion` 固定相机、花朵根位置、朝向和整体缩放，关闭 shock、wave、sweep、微粒与自动惯性；保留随阅读位置变化的叙事形态。DOM 内容保持可见，标题不再逐步裁切，3D 文字在进入可见阶段时直接揭幕。手动按钮、滑块、键盘旋转与章节链接继续可用。无 WebGL2 或上下文丢失时使用现有二维轮廓，保留页面导航与文本。

触屏只有投影到花朵附近的拖动区域设置 `touch-action: none` 并捕获单指旋转；区域外保留原生页面触摸滚动。控制面板不属于拖动区域；滑块和长按按钮使用自身事件。核心长按、拖动超出阈值、pointercancel、失焦与页面隐藏均有取消路径。

## 文件职责

| 文件 | 职责 |
| --- | --- |
| `src/components/effects/experience-provider.tsx` | 主时间轴、实际滚动区间、刷新与 DOM 显现 |
| `src/components/effects/cinematic-context.tsx` | 每个体验一个 Runtime |
| `src/components/effects/cinematic-overlay.tsx` | 暗幕、信箱边框、速度线与 Replay |
| `src/lib/cinematic-state.ts` | 五章节关键点、纯帧采样及 Runtime |
| `src/lib/petal-cinematic-pose.ts` | 可逆花瓣爆散及螺旋姿态采样 |
| `src/components/scene/scene-stage.tsx` | 持续 Canvas 容器、延迟加载与回退 |
| `src/components/scene/flower/FlowerScene.tsx` | Canvas、动态灯光、控制面板、局部覆盖 |
| `src/components/scene/flower/CinematicCamera.tsx` | 镜头、移动端构图、交互区域投影与诊断值 |
| `src/components/scene/flower/CinematicTypography.tsx` | 深度文字、CanvasTexture 与片元揭幕 |
| `src/components/scene/flower/ProceduralFlower.tsx` | 叙事姿态与局部互动叠加、花心与微粒 |
| `src/components/scene/flower/FlowerMaterials.ts` | 四种物理材质及共享 dissolve uniform |
| `src/styles/cinematic.css` | 章节留白、sticky 排布、遮罩及减少动态效果样式 |

## 本地命令与手动验收

```powershell
npm ci
npm run dev
```

使用开发服务器输出的地址。生产与静态检查命令：

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run start
```

`npm test` 使用 Node.js 原生测试运行器，覆盖花瓣几何和控制器、材质 dissolve、任意进度 / 倒放 / 连续性 / 安全相机距离、Runtime 清理及花瓣前后景与雕塑姿态。测试结果、构建结果和真实浏览器验收在最终交付记录中报告；本指南不预先声明通过。

手动检查建议：

1. 在支持 WebGL2 的浏览器从开头慢速走完五章节，观察显现、绽放、爆散、雕塑、重生和三个文字平面的前后遮挡。
2. 从 Rebirth 连续倒滚回 Awakening；在 `.4、.6、.8` 附近来回滚动，确认没有跳变、不可逆残留或叠字。
3. 快速拖动滚动条，并通过章节菜单连续跳到非相邻章节；确认文案、章节指示、镜头与花瓣仍对应同一位置。
4. 在页面中段刷新，测试带 `#fracture`、`#metamorphosis`、`#rebirth` 的地址及浏览器前进 / 后退；改变窗口大小后重复锚点导航。
5. 在不同章节使用四种材质、拖动、点击花心、长按松开、展开滑块与键盘控制；继续滚动观察局部覆盖归还叙事。
6. 在结尾点击 REPLAY EXPERIENCE，确认返回开头并清理局部旋转和蓄力；重复操作不应增加主 ScrollTrigger 或 Canvas 数量。
7. 在移动视口与真实触屏测试：花朵附近单指旋转、拖动区域外原生滚动、控制面板操作、快速滑动和横竖屏切换；确认没有整页手势锁定。
8. 开启减少动态效果，复查章节阅读、静态相机、手动控制与 Replay；隐藏 / 恢复标签页，并测试 WebGL2 不可用的二维回退。

后续范围包括艺术节奏、设备性能与材质细节的继续打磨，以及音频或完整后处理的独立扩展。螺旋雕塑仍由原有花瓣重排构成，未实现拓扑融合或体积模拟。
