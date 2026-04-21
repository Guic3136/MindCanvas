# MindCanvas

可视化的 AI Prompt 调试画布工具。通过拖拽节点、连线的方式构建多模型对话流程，支持上下文传递、实时流式响应和 Markdown 导出。

## 功能特性

- **可视化画布**：基于 React Flow 的拖拽式节点编辑器
- **多模型对话**：支持 GPT-4、通义千问等多种 LLM 同时接入
- **上下文传递**：节点间通过连线传递对话历史（全部历史 / 仅最后回复）
- **流式响应**：SSE 实时流式输出，无等待感
- **加密存储**：API 密钥使用 Fernet 加密存储
- **Markdown 导出**：一键导出完整对话流程文档
- **管理后台**：模型配置、用户管理

## 技术栈

- **前端**：React 18 + TypeScript + Vite + React Flow + Tailwind CSS + Zustand
- **后端**：FastAPI + SQLAlchemy 2.0 (async) + aiosqlite + python-jose
- **部署**：Docker Compose

## 快速开始

### 方式一：本地开发

```bash
# 1. 克隆仓库
git clone https://github.com/Guic3136/MindCanvas.git
cd MindCanvas

# 2. 启动后端
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
python main.py

# 3. 另开一个终端启动前端
cd frontend
npm install
npm run dev
```

浏览器访问 http://localhost:5173

### 方式二：Docker Compose

```bash
docker-compose up --build
```

浏览器访问 http://localhost:5173

## 首次使用配置

新环境的数据库为空，首次使用需要：

1. **注册账号**：访问登录页注册第一个用户
2. **配置模型**：进入 `/admin` 管理后台
   - 添加模型提供商（如 DashScope）
   - 添加具体模型（如 `qwen3.6-plus`）
3. **创建项目**：回到首页创建项目，开始画布编辑

## 环境变量

复制 `backend/.env.example` 为 `backend/.env`，按需修改：

| 变量 | 说明 | 默认值 |
|---|---|---|
| `DATABASE_URL` | SQLite 数据库路径 | `sqlite+aiosqlite:///./mindcanvas.db` |
| `SECRET_KEY` | JWT 密钥 | 随机生成 |
| `ENCRYPTION_KEY` | API 密钥加密密钥 | 随机生成 |
| `ADMIN_USERNAME` | 管理员账号 | `admin` |
| `ADMIN_PASSWORD` | 管理员密码 | `admin` |

## 项目结构

```
MindCanvas/
├── backend/          # FastAPI 后端
│   ├── core/         # 配置、数据库、安全
│   ├── models/       # SQLAlchemy 数据模型
│   ├── routers/      # API 路由
│   ├── schemas/      # Pydantic 数据校验
│   └── services/     # 业务逻辑（LLM 调用、导出等）
├── frontend/         # React 前端
│   ├── src/api/      # API 客户端
│   ├── src/components/  # UI 组件
│   └── src/stores/   # Zustand 状态管理
└── docker-compose.yml
```

## 许可证

MIT
