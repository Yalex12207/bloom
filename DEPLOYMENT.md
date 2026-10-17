# BLOOM 部署指南

项目已准备 Vercel 配置，当前没有实际部署，也没有生产 URL。本指南说明如何由项目拥有者创建 Preview、验收，再发布生产版本。现有工程使用 Next.js 16.4.1 App Router、React 19.2 和 TypeScript；无需环境变量、数据库、API 密钥或额外服务。

## 提交前准备

在包含 `package.json`、`package-lock.json`、`next.config.ts` 和 `vercel.json` 的 BLOOM 根目录运行：

```powershell
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm run start
```

按实际输出打开生产服务器，完成[第五轮手动验收](docs/production-experience.md#手动验收)。这些命令是部署前步骤；本文不代表它们已经执行或通过。将源码、锁文件、`public/audio/bloom-study-v1.wav` 及授权文件一并提交至自己的 Git 仓库。

内置音轨已随项目交付，部署不需要重新生成。需要重建时，运行 `npm run audio:generate`；不要在构建期间下载外部音频。

## 使用 Vercel 和 Git

Vercel 原生支持 Next.js，可以使用框架集成完成部署，见 [Next.js on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs)。在 Vercel Dashboard 选择 **Add New → Project**，连接 Git 服务并导入 BLOOM 所在仓库。

| 设置 | BLOOM 使用值 |
| --- | --- |
| Root Directory | 仓库包含 `bloom/` 子目录时填 `bloom`；仓库根就是 BLOOM 内容时用 `./` |
| Framework Preset | `Next.js` |
| Node.js Version | `24.x` |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | 保持框架自动配置，关闭手动覆盖 |
| Environment Variables | 留空 |

Root Directory 必须指向应用的 `package.json` 所在目录。框架识别后，Vercel 自动配置输出目录；无需把 `public`、`dist` 或 `.next` 手动填入该项。根目录、构建与安装命令的配置方式见 [Configuring a Build](https://vercel.com/docs/builds/configure-a-build)。

`24.x` 是目前 Vercel 支持的 Node.js 主版本；在 **Settings → Build and Deployment → Node.js Version** 中确认。平台自动管理该主版本的补丁更新，见 [Supported Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)。项目现有 `engines.node` 范围兼容 24.x。

仓库内的 `vercel.json` 已声明 `framework: nextjs`、`installCommand: npm ci`、`buildCommand: npm run build`。保留现有 Next.js 构建方式，不需要静态导出或重写所有路由到 HTML。

## Preview 与生产发布

先使用开发分支的 Preview Deployment 检查实际构建日志和预览地址。若仓库首次导入产生的是生产部署，在正式使用域名前仍需按同一清单验收；后续改动通过分支 Preview 复核。

1. 首次进入页面保持静音，五章节、文字与导航完整可用；检查 3D 成功加载及二维回退。
2. 拖动、花心点击 / 长按、绽放、材质、六主题 AUTO / MANUAL、Replay 均正常；控制面板不遮挡主要导航。
3. 点击 SOUND 后才能请求并播放 `/audio/bloom-study-v1.wav`；音量、本地音频、错误恢复及切走标签页后的暂停有效。
4. 检查桌面高质量后期、ECO、移动端触控、减少动态效果和低质量回退；查看浏览器控制台与网络失败。
5. 使用实际 iOS / Android 设备及 Safari 补测，记录设备、浏览器、问题和实际观察；不要把桌面模拟当作真机结果。

验收后，再由项目拥有者在 Vercel 中将确认的部署提升为生产版本，或合并到已配置的生产分支。当前文档和配置的交付不表示已经执行上述发布操作。

## 音轨缓存与版本

`next.config.ts` 为 `/audio/bloom-study-v1.wav` 声明 `Cache-Control: public, max-age=31536000, immutable`。该文件约 1.4 MB，只有用户主动播放时才会被请求。检查 Preview 的音轨请求返回成功，且响应内容为 WAV。

替换配乐内容时使用新文件名，例如 `bloom-study-v2.wav`，同步修改 AudioController 的内置 URL 与相应缓存规则后重新部署。不要在保持同一版本 URL 的情况下替换已缓存内容。本地文件只由浏览器读取，与部署存储和服务器上传无关。

## 可选 CLI

也可以在 BLOOM 根目录使用 Vercel CLI 创建部署：

```powershell
npx vercel
```

按提示登录并选择项目，确认应用根目录和 Next.js 设置，先生成 Preview，再按上文验收。本次交付没有执行该命令、登录账号或创建远程项目。

常见问题：找不到 `package.json` 时检查 Root Directory；音轨 404 时检查 WAV 是否提交以及请求路径；构建错误时先用相同 Node.js 24.x 在本地运行对应命令；声音不能自动开始是预期行为，需要一次用户点击。
