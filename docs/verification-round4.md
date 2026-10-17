# 第四轮验收记录

验收日期：2026-10-16 至 2026-10-17。最终生产构建与最终主题浏览器检查于 2026-10-17 完成。保留原项目、持续 Canvas 和第三轮主时间轴；未新增运行依赖。

## 工程检查

| 检查 | 结果 |
| --- | --- |
| `npm run lint` | 通过，零 warning |
| `npm run typecheck` | 通过 |
| `npm test` | 28 / 28 通过 |
| `npm run build` | 最终版本通过，首页静态生成成功 |

单元测试覆盖花瓣几何与交互、可逆滚动采样、六主题规范与精确终点、线性工作空间颜色插值、过渡中断连续性、重复目标、自动与手动模式、引用与订阅清理、双物理材质渐变、移动端零透射及物理 Shader 功能边界。Node 的模块类型自动识别提示不影响结果。

## 最终主题浏览器验收

使用本机 Edge 的 Playwright 无头会话，对最终生产构建执行，13 / 13 通过：

1. Color Lab 包含六个可访问主题按钮，初始 AUTO 对应 CRIMSON，Canvas 无 CSS filter。
2. 六主题全部改变实际 PBR 颜色和参数，并同步花心、灯光、粒子与 CSS；同一个 Canvas 持续复用，WebGL 无错误。
3. 在未完成的渐变中连续选择主题，从当前可见值继续，目标按约 1.2 秒完成。
4. 手动主题跨越五章节保持；AUTO 恢复当前章节，倒序返回时遵守同一映射。
5. DUALITY 保留清晰的红蓝交错，NEBULA 使用蓝紫曲面渐变；两个 Material 的 UUID 在反复切换后保持一致。
6. 原四种材质快捷按钮进入同一手动主题状态，键盘可选择主题，当前主题只有一个 aria-pressed 按钮。
7. 换色保留主时间轴、倒滚姿态、花心脉冲与 Replay；桌面页脚返回顶部链接可点击。
8. 在结尾刷新后恢复当前章节 AUTO，主 ScrollTrigger 数量仍为一个。
9. 减少动态效果下立即应用主题，实际材质仍能按需重绘。
10. 手机面板默认折叠，展开后可选六主题；收起后保留原生触摸滚动，无水平溢出。
11. 移动端全部主题 transmission 为 0，花瓣数为 27，DPR 不超过 1.15；320 / 430 / 390 宽度切换、Escape 和手机页脚返回顶部可用。
12. WebGL 上下文丢失后进入二维轮廓模式，Color Lab、DOM 配色及五章节仍可使用。
13. 无 hydration、浏览器运行时或 Shader 编译错误。

第三轮完整的 14 项浏览器回归检查也已通过，覆盖五章节、反向快滚、刷新与锚点、手动展开、拖动、点击与长按、材质切换、Replay、减少动态效果、移动触控和 WebGL 回退。最终主题检查再次覆盖滚动兼容、Replay 和新增面板周围链接的可达性。

## 资源与设备范围

预热全部主题后重复切换，几何体数保持 25、纹理数保持 11、Shader program 数保持 17，两个花瓣物理材质实例未改变。上述计数反映所测试操作期间没有持续增长，不替代长时间内存分析。

桌面 AZURE / NEBULA 使用真实透射，仍有额外场景 Pass；移动端用较高粗糙度、较低厚度和清漆轮廓近似玻璃，避免该 Pass。环境只生成一帧，主题不生成新模型或贴图。移动检查为桌面 GPU 上的触屏模拟，真实低端手机和 Safari 的帧率仍需设备验证。

## 重跑方法

```powershell
cd "C:\Users\48154\Documents\ChatGPT\New project\bloom"
npm run lint
npm run typecheck
npm test
npm run build
npm run start
```

开发使用 `npm run dev`。手动操作按 [色彩系统说明](color-system.md) 的验收步骤执行。

本机浏览器脚本、执行结果与截图保存在 Git 忽略的 `artifacts/`：`verify-theme.mjs`、`theme-verification.json`、`cinematic-verification.json` 和 `round4-*.png`。浏览器脚本使用环境中已有的 Playwright 与 Edge；这些工具不属于网站运行依赖。
