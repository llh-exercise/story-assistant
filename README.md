# Story Assistant

网文创作辅助工具：管理故事与卷章目录，结合 DeepSeek 自动生成目录与章节正文。

Monorepo 结构，前端 React + Ant Design，后端 NestJS + Fastify + Prisma + SQLite。

## 功能概览

### 故事管理（`/`）

- 故事列表展示、新建、编辑、删除
- 创建故事时填写**故事名称**与**故事总纲**
- 创建成功后自动调用 AI，根据总纲生成**卷 / 章目录**并写入数据库

### 写作页（`/story/:id`）

三栏布局：

| 区域 | 说明 |
|------|------|
| 左侧 | 卷章树形目录，默认展开并选中第一卷 |
| 中间 | 选中**卷** → 编辑卷细纲；选中**章** → 编辑章细纲与正文 |
| 右侧 | 预留扩展区 |

**卷节点（Juan）**

- 编辑卷细纲
- 保存细纲

**章节点（Write）**

- 编辑本章细纲、保存细纲
- 根据细纲 **流式生成** 本章正文（打字机效果）
- 保存正文

### AI 能力

基于 `@ai-sdk/deepseek` + Vercel AI SDK（`ai`）对接 DeepSeek：

1. **生成目录**：根据故事总纲输出 JSON 结构（卷 + 章），写入 `chapter` 表
2. **生成正文**：结合故事总纲、各卷大纲、所属卷、前五章细纲与本章细纲，流式输出正文

### 章节数据模型

- `parentId = null` → **卷**
- `parentId = 卷 id` → **章**
- `sortOrder` → 同级排序（支持后续手动插章、增卷、拖拽排序）

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19、Vite、TypeScript、Ant Design、React Router、Axios |
| 后端 | NestJS 11、Fastify、class-validator、Swagger |
| 数据库 | SQLite + Prisma ORM |
| AI | DeepSeek（`@ai-sdk/deepseek`、`ai`） |

## 快速开始

### 环境要求

- Node.js 18+
- npm（workspace）

### 安装与运行

```bash
npm install
npm run dev
```

- 前端：http://localhost:5173
- 后端 API：http://localhost:3000/api
- Swagger 文档：http://localhost:3000/api/docs

`npm run dev` 会同时启动前后端；后端启动时会自动执行 `prisma db push` 同步数据库。

### 环境变量

在 `backend/` 目录复制示例配置并填写：

```bash
cp backend/.env.example backend/.env
```

```env
DATABASE_URL="file:./dev.db"

# DeepSeek（AI 生成目录 / 正文必填）
DEEPSEEK_API_KEY=你的密钥
DEEPSEEK_API_BASE=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

未配置 `DEEPSEEK_API_KEY` 时，创建故事后的 AI 目录生成与章节正文生成会失败。

## 常用脚本

```bash
# 根目录
npm run dev          # 前后端并行开发
npm run build        # 构建前后端

# 后端 workspace
npm run dev -w backend
npm run prisma:push -w backend
npm run prisma:generate -w backend

# 前端 workspace
npm run dev -w frontend
npm run build -w frontend
```

## 开发说明

- 前端通过 Vite 代理将 `/api` 转发到 `http://localhost:3000`
- 后端全局前缀为 `/api`，使用 Fastify 驱动
- 章节阅读顺序以 `sortOrder` 为准，不再依赖 `createdAt`
- 流式生成接口直接返回文本流，不经过 `{ code, data, msg }` 包装
