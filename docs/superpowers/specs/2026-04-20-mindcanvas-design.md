# MindCanvas 设计文档

> 可视化的 AI Prompt 调试画布工具
>
> 日期：2026-04-20

## 1. Context

### 背景
团队在日常工作中需要频繁调试和优化 AI 大模型的 Prompt，目前的痛点：
- 在 ChatGPT/通义千问等聊天界面中调试 prompt，无法直观看到多个 prompt 之间的上下文依赖关系
- 无法方便地将一个模型的输出作为另一个模型的输入（链式调用）
- 调试好的 prompt 流程没有结构化的文档输出，难以在团队内复用

### 目标
创建一个 Web 应用，用户可以在可视化画布上通过拖拽创建对话窗口、连线建立上下文依赖，迭代调试 prompt，并将最终满意的流程导出为 Markdown 文档。

### 目标用户
团队内部成员，由管理员统一分配账号。

---

## 2. 技术选型

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端框架 | React 19 + TypeScript + Vite | 与团队现有项目一致 |
| 样式 | TailwindCSS 4 | 实用优先的原子化 CSS |
| 画布引擎 | React Flow | React 生态最成熟的节点画布库 |
| 状态管理 | Zustand | 轻量、与 React Flow 配合良好 |
| 后端框架 | FastAPI + SQLAlchemy 2.0 async + Pydantic v2 | 团队技术栈 |
| 数据库 | SQLite (aiosqlite) | 团队内部工具，无需 PostgreSQL |
| LLM 调用 | 后端统一代理 + SSE 流式转发 | API Key 不暴露给前端 |
| 认证 | JWT (python-jose + passlib) | 复用已有方案 |
| 密钥加密 | cryptography (Fernet) | 复用 ImageManager 方案 |
| 部署 | Docker Compose | 一键启动 |

---

## 3. 项目结构

```
MindCanvas/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Canvas/
│   │   │   │   ├── FlowCanvas.tsx        # React Flow 画布主组件
│   │   │   │   ├── ChatNode.tsx          # 对话节点自定义组件
│   │   │   │   ├── ChatNodeHeader.tsx    # 节点头部（模型选择、名称）
│   │   │   │   ├── ChatNodeMessages.tsx  # 节点对话消息列表
│   │   │   │   ├── ChatNodeInput.tsx     # 节点输入框
│   │   │   │   ├── CustomEdge.tsx        # 自定义连线（可配置 context_mode）
│   │   │   │   └── CanvasToolbar.tsx     # 画布工具栏
│   │   │   ├── AdminPanel/
│   │   │   │   ├── ModelProviders.tsx    # API Provider 管理
│   │   │   │   ├── ModelList.tsx         # 模型列表管理
│   │   │   │   └── UserManagement.tsx    # 用户管理
│   │   │   ├── ExportPanel/
│   │   │   │   └── ExportButton.tsx      # 导出 Markdown
│   │   │   ├── ProjectList/
│   │   │   │   └── ProjectList.tsx       # 项目列表页
│   │   │   └── Auth/
│   │   │       └── LoginPage.tsx         # 登录页
│   │   ├── stores/
│   │   │   ├── canvasStore.ts            # 画布状态（节点、连线）
│   │   │   ├── chatStore.ts              # 对话状态
│   │   │   └── authStore.ts              # 认证状态
│   │   ├── api/
│   │   │   ├── client.ts                 # Axios 实例 + JWT 拦截器
│   │   │   ├── project.ts                # 项目 API
│   │   │   ├── chat.ts                   # 对话 API (含 SSE)
│   │   │   └── admin.ts                  # 管理 API
│   │   ├── types/
│   │   │   └── index.ts                  # 类型定义
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
├── backend/
│   ├── routers/
│   │   ├── auth.py                       # 登录
│   │   ├── projects.py                   # 项目 CRUD
│   │   ├── nodes.py                      # 节点 CRUD + 对话
│   │   ├── admin.py                      # 管理员 API
│   │   └── export.py                     # 导出 Markdown
│   ├── services/
│   │   ├── llm_client.py                 # LLM 调用封装（多 Provider）
│   │   ├── context_builder.py            # 上下文拼接逻辑
│   │   └── markdown_exporter.py          # Markdown 生成
│   ├── models/
│   │   └── db.py                         # SQLAlchemy 模型
│   ├── core/
│   │   ├── config.py                     # 配置
│   │   ├── security.py                   # JWT + 加密
│   │   └── database.py                   # 数据库连接
│   ├── main.py
│   └── requirements.txt
├── docker-compose.yml
└── docs/
```

---

## 4. 数据模型

### 4.1 用户 (User)

```python
class User:
    id: int (PK)
    username: str (unique)
    password_hash: str
    is_admin: bool (default=False)
    created_at: datetime
```

### 4.2 模型提供者 (ModelProvider)

```python
class ModelProvider:
    id: int (PK)
    name: str                    # 显示名称，如 "通义千问", "Kimi"
    base_url: str                # API 地址，如 "https://dashscope.aliyuncs.com/compatible-mode/v1"
    api_key_encrypted: str       # Fernet 加密的 API Key
    created_at: datetime
```

### 4.3 模型 (Model)

```python
class Model:
    id: int (PK)
    provider_id: int (FK -> ModelProvider)
    model_id: str                # 实际调用的模型 ID，如 "qwen-plus"
    display_name: str            # 界面显示名称
    is_enabled: bool (default=True)
```

### 4.4 项目 (Project)

```python
class Project:
    id: int (PK)
    name: str
    owner_id: int (FK -> User)
    created_at: datetime
    updated_at: datetime
```

### 4.5 节点 (Node)

```python
class Node:
    id: int (PK)
    project_id: int (FK -> Project)
    model_id: int (FK -> Model)
    label: str                   # 节点名称，如 "市场分析"
    position_x: float            # React Flow 画布 X 坐标
    position_y: float            # React Flow 画布 Y 坐标
    width: float (default=400)
    height: float (default=500)
```

### 4.6 连线 (Edge)

```python
class Edge:
    id: int (PK)
    project_id: int (FK -> Project)
    source_node_id: int (FK -> Node)
    target_node_id: int (FK -> Node)
    context_mode: str            # "full_history" | "last_reply"
```

### 4.7 消息 (Message)

```python
class Message:
    id: int (PK)
    node_id: int (FK -> Node)
    role: str                    # "user" | "assistant"
    content: str
    created_at: datetime
```

### ER 关系

```
User 1──N Project
Project 1──N Node
Project 1──N Edge
Node 1──N Message
Node N──1 Model
Model N──1 ModelProvider
Edge N──1 Node (source)
Edge N──1 Node (target)
```

---

## 5. API 设计

### 5.1 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/auth/login | 登录，返回 JWT |
| GET | /api/auth/me | 获取当前用户信息 |

### 5.2 项目

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/projects | 列出当前用户的项目 |
| POST | /api/projects | 创建项目 |
| GET | /api/projects/{id} | 获取项目详情（含节点、连线） |
| PUT | /api/projects/{id} | 更新项目名称 |
| DELETE | /api/projects/{id} | 删除项目 |

### 5.3 节点 & 对话

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/projects/{id}/nodes | 创建节点 |
| PUT | /api/projects/{id}/nodes/{nid} | 更新节点（位置、模型、尺寸等） |
| DELETE | /api/projects/{id}/nodes/{nid} | 删除节点 |
| POST | /api/projects/{id}/nodes/{nid}/chat | 发送消息，SSE 流式返回 |
| GET | /api/projects/{id}/nodes/{nid}/messages | 获取节点对话历史 |

### 5.4 连线

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/projects/{id}/edges | 创建连线 |
| PUT | /api/projects/{id}/edges/{eid} | 更新连线（context_mode） |
| DELETE | /api/projects/{id}/edges/{eid} | 删除连线 |

### 5.5 导出

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/projects/{id}/export | 导出为 Markdown，返回文件内容 |

### 5.6 管理员

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/admin/providers | 列出模型提供者 |
| POST | /api/admin/providers | 添加模型提供者 |
| PUT | /api/admin/providers/{id} | 编辑模型提供者 |
| DELETE | /api/admin/providers/{id} | 删除模型提供者 |
| GET | /api/admin/models | 列出所有模型 |
| POST | /api/admin/models | 添加模型 |
| PUT | /api/admin/models/{id} | 编辑模型 |
| DELETE | /api/admin/models/{id} | 删除模型 |
| GET | /api/admin/users | 列出用户 |
| POST | /api/admin/users | 创建用户 |
| DELETE | /api/admin/users/{id} | 删除用户 |

---

## 6. LLM 调用流程

### 发送消息 (POST /api/projects/{id}/nodes/{nid}/chat)

```
前端发送: { message: "用户输入内容" }
    │
    ▼
后端处理:
  1. 查询节点信息，获取 model_id
  2. 查询该节点的所有入边 (Edge where target_node_id = nid)
  3. 构建上下文:
     - 无入边: 上下文为空
     - 有入边: 遍历每条入边的 source_node:
       - context_mode="full_history": 取 source_node 的全部 Message
       - context_mode="last_reply": 只取 source_node 最后一条 role=assistant 的 Message
     - 多条入边按 Edge id 排序拼接，每段之间加分隔提示
  4. 组装 messages 数组:
     [
       { role: "system", content: system_prompt },   # 可选
       { role: "user", content: "[来自节点X的上下文]\n..." },  # 上游上下文
       { role: "assistant", content: "..." },         # 当前节点历史...
       { role: "user", content: "新的用户消息" }
     ]
  5. 解密该 Model 对应 Provider 的 API Key
  6. 调用 LLM API (SSE 流式)
  7. 边生成边通过 SSE 推给前端
  8. 生成完毕，将 user message 和完整 assistant message 存入 Message 表
    │
    ▼
SSE 事件流推给前端:
  event: token     data: {"content": "生"}
  event: token     data: {"content": "成的"}
  event: token     data: {"content": "文本..."}
  event: done      data: {"message_id": 123}
```

### LLM Client (services/llm_client.py)

- 统一封装 OpenAI 兼容接口（DashScope、Kimi、MiMo 等都兼容 OpenAI SDK 格式）
- 使用 `openai.AsyncOpenAI` 客户端，动态传入 base_url 和 api_key
- 流式返回使用 `async for chunk in stream` 逐块 yield

### 上下文拼接 (services/context_builder.py)

- 按拓扑顺序收集上游节点的消息
- 支持 full_history 和 last_reply 两种模式
- 对多上游输入，加入 `[来自"{node_label}"的上下文]` 标记进行分隔

---

## 7. 前端画布交互

### 7.1 自定义节点 (ChatNode)

React Flow 自定义节点，包含：

```
┌─────────────────────────────────────┐
│ [模型下拉: qwen-plus ▼]  节点名称✏️ │  ← 头部
├─────────────────────────────────────┤
│                                     │
│  👤 用户消息内容...                  │  ← 消息列表
│  🤖 AI 回复内容...                   │    (可滚动)
│  👤 追问内容...                      │
│  🤖 追回复内容...                    │
│                                     │
├─────────────────────────────────────┤
│ [输入消息...]              [发送 ▶] │  ← 输入框
└─────────────────────────────────────┘
  ◉ (左侧 handle - 输入)    ◉ (右侧 handle - 输出)
```

### 7.2 连线交互

- 拖拽右侧 handle 到另一节点的左侧 handle 创建连线
- 点击连线弹出配置面板：context_mode 选择（整条历史 / 仅最后回复）
- 连线为贝塞尔曲线，带箭头

### 7.3 工具栏

- 画布顶部工具栏：
  - "新建节点"按钮：点击后在画布中央创建新节点
  - "保存"按钮：手动触发保存（自动保存也在做）
  - "导出 Markdown"按钮
  - 项目名称（可编辑）

### 7.4 节点右键菜单

- 重命名
- 复制节点（不含对话内容）
- 删除节点

---

## 8. 导出 Markdown 格式

```markdown
# {项目名称}

> 导出时间：2026-04-20 14:30

## 流程概览

节点A (qwen-plus) → 节点B (kimi-latest)
节点A (qwen-plus) → 节点C (qwen-max)

---

## 节点A：市场分析

**模型：** qwen-plus

### 对话

**用户：** 分析2024年中国电商行业趋势，重点关注直播电商和跨境出口两个方向。

**助手：** 2024年中国电商行业呈现以下关键趋势...

---

## 节点B：营销策略（依赖：节点A）

**模型：** kimi-latest

**上下文来源：** 节点A 的全部对话历史

### 对话

**用户：** 基于以上市场分析，为一个跨境鞋类卖家制定Q2营销策略。

**助手：** 根据前述市场分析，建议采取以下策略...

---
```

---

## 9. 用户系统

### 登录
- 简单的用户名+密码登录页面
- 后端签发 JWT Token，前端存 localStorage
- Axios 拦截器自动携带 Token

### 权限
- 普通用户：创建/编辑/删除自己的项目
- 管理员：管理模型配置 + 管理用户账号
- is_admin 字段区分角色

### 管理员后台
- 模型配置页面：添加 Provider（名称、地址、Key）→ 在 Provider 下添加具体模型
- 用户管理页面：创建账号（用户名+密码）、删除用户

---

## 10. 验证方案

### 功能验证步骤
1. 管理员登录 → 添加一个 Provider（如 DashScope）→ 添加模型（qwen-plus）
2. 普通用户登录 → 创建项目 → 在画布上创建节点 A → 选择 qwen-plus → 输入 prompt → 发送 → 验证流式回复
3. 创建节点 B → 从 A 连线到 B → 在 B 中输入 prompt → 验证 B 能看到 A 的上下文
4. 修改连线配置为"仅最后回复" → 重新在 B 中发送 → 验证上下文变化
5. 创建节点 C → 同时连入 A 和 B → 验证多上游上下文拼接
6. 点击导出 → 验证生成的 Markdown 内容正确

### 技术验证
- 前端：Vite dev server 启动，React Flow 画布可拖拽
- 后端：uvicorn 启动，API 文档可访问 (/docs)
- LLM 调用：确认 SSE 流式响应正常
- Docker Compose：docker-compose up 一键启动前后端
