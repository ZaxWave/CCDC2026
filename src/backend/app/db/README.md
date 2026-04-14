### 📄 src/backend/app/db/README.md

```markdown
# 🗄️ 数据库持久化层 (Database Layer)

本目录负责管理 LightScan 系统的所有持久化逻辑，采用 **PostgreSQL** 作为核心数据库，通过 **SQLAlchemy (ORM)** 实现对象关系映射。

## 🏗️ 架构组成

1. **`database.py`**: 数据库连接引擎配置。
   - 驱动程序：采用 `pg8000`（纯 Python 实现），解决了 Windows 环境下 `psycopg2` 常见的编码与编译冲突问题。
   - 连接池：管理数据库会话（Session）的创建与自动释放。
2. **`models.py`**: 数据表结构定义。
   - 定义了 `disease_records` 表，用于存储病害的时空属性（经纬度、时间戳、置信度等）。

## 📊 核心数据表：`disease_records`

系统会自动根据模型创建表结构，关键字段如下：

| 字段 | 类型 | 说明 |
| :--- | :--- | :--- |
| `id` | Integer | 自增主键 |
| `filename` | String | 关联的原始图片文件名 |
| `timestamp` | DateTime | 检测发生的时间（UTC） |
| `lat` / `lng` | Float | 空间坐标（用于高德地图大屏展示） |
| `label_cn` | String | 病害中文分类（如：坑槽、纵向裂缝） |
| `confidence` | Float | AI 模型推理的置信度 |
| `bbox` | JSONB | 像素级检测框坐标 `[x1, y1, x2, y2]` |

## 🚀 维护指令

### 1. 依赖安装
如果尚未安装数据库相关依赖，请执行：
```bash
pip install sqlalchemy
pip install psycopg2-binary
```

### 2. 数据库初始化
本项目采用 **Schema-First** 逻辑，在 `app/main.py` 启动时会自动执行以下指令：
```python
# 自动同步模型到 PostgreSQL
models.Base.metadata.create_all(bind=engine)
```
*注：请确保在连接前，PostgreSQL 中已手动创建名为 `lightscandb` 的数据库。*

## ⚠️ 注意事项
* **坐标安全**：地理位置信息由 `services/geo_service.py` 提取。若图片无 GPS 信息，数据库将存储经纬度为 `0.0` 或模拟散点，前端大屏会自动过滤无效坐标以防渲染崩溃。
```

---
