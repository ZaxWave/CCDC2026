# src/backend/app/db/database.py
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# PostgreSQL 连接字符串格式: postgresql://用户名:密码@主机:端口/数据库名
SQLALCHEMY_DATABASE_URL = "postgresql://postgres:lightscan@localhost:5432/lightscandb"

# 创建数据库引擎
engine = create_engine(SQLALCHEMY_DATABASE_URL)

# 创建会话工厂
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 声明基类，所有数据模型都继承自它
Base = declarative_base()

# FastAPI 依赖项：获取数据库会话
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()