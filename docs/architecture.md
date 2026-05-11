# 跑团助手 — 架构文档

## 项目结构

```
paotuan/
├── .github/workflows/
│   └── deploy.yml                # GitHub Actions: 自动构建部署到 GitHub Pages
├── src/                          # Astro 源码
│   ├── layouts/
│   │   └── MainLayout.astro      # 主布局: <html>, <head>, 导航, 页脚
│   ├── pages/
│   │   └── index.astro           # SPA 入口: 组合所有页面区段
│   ├── components/
│   │   ├── Nav.astro             # 导航栏 (5 个页面标签, 主题徽章)
│   │   ├── Footer.astro          # 页脚 (版权 + GitHub 链接)
│   │   ├── HomeSection.astro     # 首页: AI KP 聊天, RPG 选择, 剧本库
│   │   ├── CharacterSection.astro # 人物卡: 属性/技能/法术/装备/先攻
│   │   ├── DiceSection.astro     # 骰子: d4-d100 投掷器, 投掷记录
│   │   ├── NotesSection.astro    # 笔记: 会话笔记编辑器
│   │   └── MultiplayerSection.astro # 联机: 房间创建/加入, 玩家列表, KP 面板
│   └── styles/                   # CSS 模块 (10 个文件)
│       ├── reset.css             # CSS reset, :root 变量, 滚动条
│       ├── themes.css            # 4 套 RPG 主题 data-theme
│       ├── layout.css            # 布局, 导航, 粒子, RPG 网格
│       ├── components.css        # 面板, 表单, 按钮, 标签, toast
│       ├── character.css         # 人物卡 3 栏布局
│       ├── dice.css              # 骰子条, 结果, 记录
│       ├── kp.css                # AI KP 聊天界面
│       ├── multiplayer.css       # 多人联机界面
│       ├── coc.css               # CoC 专属样式
│       └── responsive.css        # 响应式 + 打印样式
├── public/                       # Astro 静态资源 (直接复制到 dist/)
│   ├── CNAME                     # 自定义域名: ttrpg.183107.xyz
│   └── js/                       # 客户端 JavaScript (ES Modules)
│       ├── app.js                # 模块入口
│       ├── init.js               # 初始化, 事件绑定, 键盘快捷键
│       ├── state.js              # 全局状态, 常量, 技能定义
│       ├── kp.js                 # AI KP 引擎 (Prompt 构建, API 调用, 流式解析)
│       ├── character.js          # 人物卡 CRUD
│       ├── dice.js               # 骰子投掷器
│       ├── theme.js              # 主题切换 + SPA 页面导航
│       ├── commands.js           # AI 指令解析 (SAN, HP, 特质, 记忆)
│       ├── check-resolver.js     # CoC D100 检定两遍解析
│       ├── coc-rules.js          # CoC 7e 规则 (幸运, 孤注, 技能成长)
│       ├── coc-status.js         # CoC 状态条渲染
│       ├── san.js                # CoC SAN 疯狂机制
│       ├── saves.js              # 游戏存档系统
│       ├── scenario.js           # 剧本知识库
│       ├── notes.js              # 会话笔记
│       ├── memory-bank.js        # 结构化记忆库
│       ├── particles.js          # Canvas 星空粒子
│       ├── api-browser.js        # D&D 5e API 浏览器
│       ├── utils.js              # 工具函数
│       ├── dom.js                # 懒加载 DOM 引用
│       ├── prompts/              # AI Prompt 文件 (可单独编辑)
│       │   ├── shared-preamble.js # 通用前缀 (4 系统共享, 缓存优化)
│       │   ├── dnd.js            # D&D 5e 系统 Prompt
│       │   ├── coc.js            # CoC 7e 系统 Prompt
│       │   ├── cyberpunk.js      # CP:R 系统 Prompt
│       │   └── pathfinder.js     # PF2e 系统 Prompt
│       └── multiplayer/          # 多人联机模块
│           ├── index.js          # 命名空间 + API
│           ├── connection.js     # WebSocket 连接 + 重连
│           ├── host.js           # 房主逻辑
│           ├── client.js         # 客户端逻辑
│           ├── ui.js             # 联机 UI 渲染
│           ├── combat.js         # CoC 战斗管理器
│           ├── chase.js          # CoC 追逐管理器
│           └── game-start.js     # AI 开场叙述
├── cloudflare/
│   ├── worker.js                 # CF Worker: API 代理 + WS 中继
│   └── wrangler.toml             # Wrangler 配置
├── astro.config.mjs              # Astro 构建配置
├── package.json                  # npm 依赖 + 脚本
├── server.js                     # Node.js 本地服务器 + API 代理
├── TTRPG.bat                     # Windows 启动器
├── index.html                    # 原始 SPA 入口 (向后兼容)
├── CLAUDE.md                     # Claude Code 配置
└── docs/
    └── architecture.md           # 本文档
```

## 架构原则

### SPA 单页应用
所有 5 个"页面"(首页/人物卡/骰子/笔记/联机) 实际是同一个 HTML 文档中的 `<section>` 区段。客户端 JS (`theme.js`) 通过 CSS 类 (`active`) 控制区段的显示/隐藏。这保证了:
- AI KP 聊天的 SSE 流在页面切换时不中断
- WebSocket 多人连接保持在线
- 全局状态 (`state.js`) 在页面切换时保持

### Prompt 架构 (缓存优化)
`buildSystemPrompt()` 按固定顺序组装最终 Prompt:
```
KP_SHARED_PREAMBLE (固定 ~2500 字符, 4 系统完全相同)
  + 系统专属 Prompt (~200-800 字符)
  + 动态 extra (角色数据, 剧本库, 记忆库)
```
共享前言放在位置 0 确保了 Anthropic Prompt Cache 在所有 RPG 系统切换时都可复用。

### CSS 架构
- 10 个 CSS 模块按依赖顺序加载
- `:root` 自定义属性定义在 `reset.css`
- 4 套 RPG 主题通过 `body[data-theme]` 选择器切换
- Astro 构建时 CSS 被优化合并

## 本地开发

```bash
# Astro 开发模式 (HMR 热更新)
npm run dev

# 或使用 Node.js 本地服务器 + API 代理
node server.js

# 构建生产版本
npm run build

# 预览生产构建
npm run preview
```

Windows 用户双击 `TTRPG.bat` 选择启动模式。

## 部署

### GitHub Pages (自动)
推送到 `main` 分支时, GitHub Actions 自动:
1. 安装依赖 (`npm ci`)
2. 构建 (`astro build`)
3. 部署到 GitHub Pages (`dist/` 目录)

**GitHub Pages 设置:** Settings → Pages → **Build and deployment** → Source 选择 **GitHub Actions**

### Cloudflare Worker
```bash
cd cloudflare
npx wrangler deploy
```
Worker 提供:
- `POST /api/proxy` — AI API 代理 (白名单: Anthropic/OpenAI/DeepSeek)
- `WS /room/:id` — 多人 WebSocket 中继 (Durable Objects)
