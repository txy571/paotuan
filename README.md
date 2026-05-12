<h1 align="center">🎲 跑团助手 — TTRPG Companion</h1>

<p align="center">
  <strong>🌐 <a href="https://ttrpg.183107.xyz/">ttrpg.183107.xyz</a></strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Astro-6.x-BC52EE?style=for-the-badge&logo=astro&logoColor=white" alt="Astro">
  <img src="https://img.shields.io/badge/JavaScript-ES_Modules-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/Node.js-22.x-43853D?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js 22">
  <img src="https://img.shields.io/badge/Cloudflare_Workers-F38020?style=for-the-badge&logo=cloudflare&logoColor=white" alt="Cloudflare Workers">
  <img src="https://img.shields.io/badge/WebSocket-000000?style=for-the-badge&logo=socket.io&logoColor=white" alt="WebSocket">
  <img src="https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/Anthropic_Claude-000000?style=for-the-badge&logo=anthropic&logoColor=white" alt="Claude">
  <img src="https://img.shields.io/badge/OpenAI-412991?style=for-the-badge&logo=openai&logoColor=white" alt="OpenAI">
  <img src="https://img.shields.io/badge/Call_of_Cthulhu-7e-0d9488?style=for-the-badge" alt="CoC 7e">
  <img src="https://img.shields.io/badge/D&D-5e-d42020?style=for-the-badge" alt="D&D 5e">
</p>

<p align="center">
  <strong>一个 AI 驱动的桌面角色扮演游戏（TTRPG）辅助平台。</strong><br>
  支持多种规则系统、AI 主持人、多人联机、角色卡管理、骰子投掷——一切尽在浏览器中。
</p>

---

## 项目简介

**跑团助手（TTRPG Companion）** 是一个基于 Astro 框架的 SPA 应用，为桌面角色扮演游戏玩家提供一站式工具集合。接入 Anthropic Claude / OpenAI / DeepSeek 等大语言模型作为 AI 游戏主持人（KP/DM），实现自动叙事、实时判定、NPC 扮演等功能。

无论是单人冒险还是多人联机跑团，只需打开浏览器即可开始游戏。无需安装、无需服务器——通过 GitHub Pages 部署，借助 Cloudflare Worker 实现 API 代理与 WebSocket 多人中继。

应用提供 PWA 网页应用支持，您可以点击上面的链接后在支持的设备终端直接添加该应用到桌面或主屏幕。

---

## 游戏功能亮点

### AI 主持人（KP/DM）
- 支持 **Anthropic Claude**、**OpenAI 兼容**、**DeepSeek** 三种 API 提供商
- AI 自动适配当前规则系统，实时叙述场景、判定行动、扮演 NPC
- **智能上下文压缩**：长会话自动生成结构化摘要（NPC/线索/剧情/状态/悬念/决策/战斗 7 类），突破 token 限制
- **记忆库系统**：跨会话持久化 NPC、线索、剧情线程、地点信息
- 流式 SSE 响应，支持随时中断生成
- **语音输出 (TTS)**：对接小米 MiMo TTS API，流式预合成引擎按标点智能分句，当前句播放时下一句已就绪，体验流畅无间隔。可在游戏中随时开关，支持输出完毕自动静音。

### 四人跑团规则系统
| 规则系统 | 骰子机制 | 视觉主题 | 特色功能 |
|---------|---------|---------|---------|
| **D&D 5e** | d20 | 暗红史诗 | D&D 5e API 在线资源库、法术书 |
| **克苏鲁的呼唤 7e** | d100 | 墨绿诡秘 | SAN/HP/LUCK 系统、奖励骰/惩罚骰、技能成长、战斗/追逐阶段 |
| **赛博朋克 RED** | d10 | 霓虹科幻 | 义体追踪、企业阴谋、街头生存 |
| **开拓者 PF2e** | d20 | 暗金策略 | 3 动作经济、重击 ±10 机制 |

### 角色卡管理
- 百分制购点法属性系统（6 项核心属性）
- D&D 5e 技能熟练 + CoC 7e 百分制技能双重模式
- 角色肖像上传（支持拖拽，**自动压缩至 100KB 以内**）
- 装备/物品/法术书/特质/专长 完整管理
- 先攻追踪器
- 角色卡本地存储、导出/导入 JSON
- **CoC 时代背景预设**：1920s 经典 / 1890s 维多利亚 / 现代

### 克苏鲁的呼唤 7e 完整支持
- SAN 值系统：临时疯狂 / 不定性疯狂 / 永久疯狂判定
- HP / LUCK / MP / 克苏鲁神话(CMI) 多维状态追踪
- **奖励骰 & 惩罚骰**：CoC 7e 核心机制完整实现
- 技能成长标记与模组结束提升掷骰
- 孤注一掷（Push the Roll）
- 战斗轮（DEX 排序、60s 超时、反击/闪避、枪械故障、穿刺伤害）
- 追逐轮（MOV 速度对比、障碍物检定、CON 耐力）
- 冒险编年史自动记录

### 多人联机
- **Cloudflare Worker WebSocket 中继**（基于 Durable Objects）
- 无需公网 IP、无需局域网——全球任意网络联机
- 房主/客户端架构，房主运行 AI 主持人
- 公开/秘密/Chat 三种消息模式
- 玩家准备就绪 → 房主开始游戏流程
- 自动断线重连（指数退避）
- 角色卡同步 & 状态实时广播
- CoC 7e 战斗/追逐阶段机器完整联机支持

### 更多亮点
- **浅色/深色模式切换**：四套 RPG 主题均支持明暗双色方案
- **PWA 支持**：可安装到主屏幕，manifest.json + 自适应图标
- **Markdown 笔记系统**：所见即所得实时渲染 + 多选导出导入 + AES-GCM 加密
- Canvas 2D 多层次星空粒子背景（星场/星云/极光/月亮/流星）
- 骰子投掷器：d4~d100 快速选择 + 自定义表达式（如 2d6+3）
- 跑团笔记（Markdown 格式，所见即所得）
- 游戏存档系统（含角色数据 + AI 上下文完整快照）
- 剧本知识库（NPC/地点/线索/剧情钩子——AI 会严格参考）
- CSS 变量驱动四套主题一键切换（点击顶栏主题徽章）
- 键盘快捷键：1-5 切换页面
- **语音输出 (TTS)**：流式预合成，按标点智能分句，小米 MiMo TTS API 驱动，游戏中随时开关
- 响应式布局（桌面/平板/手机，移动端原生主题选择器）
- 打印样式（角色卡可直接打印）

---

## 技术架构

```
┌─────────────────────────────────────────────────────────┐
│                    GitHub Pages (静态托管)                │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Astro 构建输出 (dist/)                           │  │
│  │  · SPA 入口 (index.html, CSS 构建合并)            │  │
│  │  · 25+ ES Module 客户端脚本 (public/js/)          │  │
│  │  · 5 个独立 Prompt 文件 (缓存优化)                 │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │              AI KP 引擎 (kp.js)                   │  │
│  │  · Prompt 组装 (共享前缀 + 系统专属 + 动态数据)    │  │
│  │  · SSE 流式响应解析                               │  │
│  │  · CoC 检定两遍检测 (check-resolver.js 掷骰)      │  │
│  │  · 智能上下文压缩 (7类结构化摘要)                  │  │
│  │  · 多 API 提供商统一调度                           │  │
│  └──────────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS + X-Proxy-Target
                       ▼
┌─────────────────────────────────────────────────────────┐
│         Cloudflare Worker (API 代理 + WS 中继)           │
│  ┌──────────────────┐  ┌────────────────────────────┐  │
│  │ POST /api/proxy   │  │  WebSocket /room/:id       │  │
│  │ · API白名单安全   │  │  · Durable Object 房间     │  │
│  │ · CORS 处理       │  │  · 广播/单播/排除发送者    │  │
│  │ · 流式透传        │  │  · 玩家加入/离开管理       │  │
│  └──────────────────┘  └────────────────────────────┘  │
└──────────┬──────────────────────┬───────────────────────┘
           │                      │
           ▼                      ▼
   ┌──────────────┐    ┌──────────────────┐
   │ Anthropic API │    │  浏览器 B         │
   │ OpenAI API    │    │  (其他玩家)       │
   │ DeepSeek API  │    └──────────────────┘
   └──────────────┘
```

**架构亮点：**
- **Astro 构建**：组件化 HTML/CSS，构建时优化合并，产物为纯静态文件
- **客户端 SPA**：ES Modules 驱动的单页应用，5 个页面区段无需刷新切换
- **双层部署**：GitHub Pages（Astro 静态输出）+ Cloudflare Worker（API 代理/WS 中继）
- **Prompt 缓存优化**：共享前言置于请求位置 0，4 系统切换时复用 Anthropic prompt cache
- **安全 API 代理**：Worker 仅允许白名单域名（api.anthropic.com, api.openai.com, api.deepseek.com），API Key 仅存浏览器 localStorage
- **WebSocket 中继**：基于 Cloudflare Durable Objects，自动广播/单播/排除，支持断线重连

---

## 快速开始

### 方式一：Astro 开发模式（推荐）

```bash
npm install
npx astro dev          # 启动开发服务器，HMR 热更新，http://localhost:4321
```

### 方式二：本地服务器 + API 代理

```bash
npm run build          # 先构建 dist/
node server.js         # 启动 Node.js 服务器 + API 代理，http://127.0.0.1:8080
```

零依赖（仅 Node.js 内置模块），自动打开浏览器。

### 方式三：Windows 一键启动

双击 `TTRPG.bat`，选择启动模式。

### 使用 AI 主持人

1. 在「人物卡」页面创建角色（至少填写姓名）
2. 回到首页，点击 AI 主持人横幅
3. 点击齿轮图标 → 填入 API Key → 保存
4. 开始对话冒险！

### 使用语音输出 (TTS)

1. 在 KP 聊天面板点击"设置" → 找到"语音输出"区域
2. 前往 [xiaomimimo.com](https://xiaomimimo.com) 注册并获取 MiMo API Key
3. 填入 API Key，选择音色，点击保存
4. 点击面板顶栏的喇叭图标 🔇 开启语音
5. AI 主持人的回复将自动朗读，按标点智能分句
6. 勾选"播完静音"可在每段 AI 输出结束后自动关闭语音

---

## 项目结构

```
paotuan/
├── astro.config.mjs            # Astro 构建配置
├── package.json                # npm 依赖与脚本
├── server.js                   # Node.js 本地服务器 + API 代理
├── TTRPG.bat                   # Windows 一键启动脚本
├── .github/workflows/
│   └── deploy.yml              # GitHub Actions 自动部署
├── src/                        # Astro 源码
│   ├── layouts/
│   │   └── MainLayout.astro    # 主布局（HTML5 shell, 全局 CSS, 导航, 页脚）
│   ├── pages/
│   │   └── index.astro         # SPA 入口（组合所有 5 个页面区段）
│   ├── components/
│   │   ├── Nav.astro           # 导航栏（5 页面标签 + 主题徽章）
│   │   ├── Footer.astro        # 页脚（版权 + GitHub 链接）
│   │   ├── HomeSection.astro   # 首页（AI KP 聊天, RPG 选择, 剧本库, 存档）
│   │   ├── CharacterSection.astro  # 人物卡（3 栏布局）

│   │   ├── NotesSection.astro  # 跑团笔记
│   │   └── MultiplayerSection.astro # 多人联机
│   └── styles/                 # 10 个 CSS 模块（构建时合并优化）
├── public/                     # Astro 静态资源（直接复制到 dist/）
│   ├── CNAME                   # 自定义域名 ttrpg.183107.xyz
│   ├── manifest.json           # PWA 清单文件
│   ├── icons/                  # PWA 图标 (需自行准备: 192x192, 512x512, maskable 512, apple-touch-icon 180, favicon 32)
│   └── js/                     # 客户端 ES Modules（25+ 文件）
│       ├── app.js              # 模块入口
│       ├── state.js            # 全局状态 + 常量 + 技能定义
│       ├── kp.js               # AI KP 引擎
│       ├── prompts/            # AI Prompt 文件（5 个，独立可编辑）
│       │   ├── shared-preamble.js  # 4 系统共享前缀（缓存优化）
│       │   ├── dnd.js          # D&D 5e 系统 Prompt
│       │   ├── coc.js          # CoC 7e 系统 Prompt
│       │   ├── cyberpunk.js    # CP:R 系统 Prompt
│       │   └── pathfinder.js   # PF2e 系统 Prompt
│       └── multiplayer/        # 多人联机模块（8 个）
├── cloudflare/
│   ├── worker.js               # CF Worker（API 代理 + WebSocket 中继）
│   └── wrangler.toml           # Wrangler 配置
└── docs/
    └── architecture.md         # 架构文档
```

## 浏览器兼容性

| Chrome | Edge | Firefox | Safari |
|--------|------|---------|--------|
| ✓ 90+  | ✓ 90+ | ✓ 90+   | ✓ 15+  |

需要 ES Modules 和 WebSocket 支持。

---

## License

MIT

---

<p align="center">
  <sub>跑团助手 — 让每一次冒险都独一无二</sub><br>
  <sub>© 2025 txy571. All rights reserved.</sub>
</p>
