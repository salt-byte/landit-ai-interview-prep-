# LandIt Backend — AI Career Engine v2

FastAPI 后端，对应前端 `landit---ai-interview-prep`。

## 快速启动

```bash
cd /Users/zy/Downloads/landit-ai-interview-prep--main/landit-backend

# 1. 创建虚拟环境
python3 -m venv venv
source venv/bin/activate

# 2. 安装依赖
pip install -r requirements.txt

# 3. 配置 API Key
cp .env.example .env
# 编辑 .env，至少填入 ANTHROPIC_API_KEY

# 4. 启动
uvicorn main:app --reload --port 8000
```

访问 `http://localhost:8000/docs` 查看 API 文档。

---

## 架构层级

| 层 | 功能 | 技术 |
|---|---|---|
| Layer 1 | 用户输入 & 文件存储 | SQLite + 本地文件 (可换 PostgreSQL + S3) |
| Layer 2-3 | LLM 提取：简历→结构化字段，JD→15维度模型 | Claude API (Function Calling) |
| Memory | 短期记忆 (Session) + 长期记忆 (跨 Session) | DB + WeaknessVector |
| Layer 4 | 纯后端计算：Ability聚合、Gap矩阵、Match分数 | Pure Python |
| Layer 5 | LLM 生成：面试题库、实时反馈 | Claude API |

---

## API 端点

### 个人档案
- `GET /api/profile` — 获取档案
- `PUT /api/profile` — 更新档案
- `POST /api/profile/documents/upload` — 上传文件
- `POST /api/profile/documents/upload-and-parse` — 上传简历并 AI 解析
- `GET /api/profile/documents` — 文件列表
- `DELETE /api/profile/documents/{id}` — 删除文件

### 目标职位
- `GET /api/roles` — 职位列表
- `POST /api/roles` — 创建职位
- `PUT /api/roles/{id}` — 更新职位
- `DELETE /api/roles/{id}` — 删除职位
- `POST /api/roles/parse-link` — URL 解析 JD
- `POST /api/roles/{id}/analyze-jd` — LLM 分析 JD → 15维度模型
- `GET /api/roles/{id}/dimension-model` — 获取维度模型

### 计算引擎 (Layer 4)
- `GET /api/compute/gap-matrix/{role_id}` — Gap 矩阵 + Match 分数
- `GET /api/compute/user-dimensions` — 用户15维度分数
- `POST /api/compute/extract-user-dimensions` — LLM 从档案提取维度分数
- `GET /api/compute/weakness-vector` — 弱点向量 (长期记忆)
- `GET /api/compute/ability-curve` — 能力曲线历史

### 面试题库 (Layer 5)
- `POST /api/prep/{role_id}/generate` — AI 生成题库
- `GET /api/prep/{role_id}` — 获取已保存内容
- `PUT /api/prep/{role_id}` — 保存用户编辑版本
- `POST /api/prep/{role_id}/chat` — 对话式优化内容

### Mock 面试
- `POST /api/interview/sessions` — 创建面试 Session
- `GET /api/interview/sessions` — Session 列表
- `WS /api/interview/sessions/{id}/stream` — WebSocket 实时面试
- `GET /api/interview/sessions/{id}/feedback` — 获取反馈

---

## 前端对接

在前端 `.env` 或 config 中设置：
```
VITE_API_URL=http://localhost:8000
```

前端也兼容：
```
VITE_API_BASE_URL=http://localhost:8000
```

## 部署配置

### Render

建议至少配置：
```bash
ANTHROPIC_API_KEY=...
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-0-us-west-1.pooler.supabase.com:6543/postgres
ALLOWED_ORIGINS=https://aistudio.google.com,http://localhost:5173,http://localhost:3000
ALLOWED_ORIGIN_REGEX=https://.*\\.vercel\\.app
DEBUG=false
```

`DATABASE_URL` 填 Supabase Postgres 连接串即可；代码会自动补 asyncpg 和 SSL。

### Vercel

前端环境变量：
```bash
VITE_API_URL=https://landit-ai-interview-prep.onrender.com
```
