#!/usr/bin/env bash
# ============================================================
# LightScan 服务器一键安装脚本
# 支持 Ubuntu 20.04 / 22.04 (x86_64)
# 在服务器上运行：bash server-install.sh
# 项目代码需已上传至 INSTALL_DIR（默认 /opt/lightscan）
# ============================================================
set -euo pipefail

# ── 配置 ────────────────────────────────────────────────────
INSTALL_DIR="/opt/lightscan"
VENV_DIR="$INSTALL_DIR/venv"
BACKEND_DIR="$INSTALL_DIR/src/backend"
FRONTEND_PUBLIC="$INSTALL_DIR/src/frontend/public"
MODEL_PATH="$INSTALL_DIR/models/weights/best.pt"
SERVICE_NAME="lightscan"
SERVICE_PORT="8000"

DB_NAME="lightscandb"
DB_USER="lightscan"
DB_PASS="$(openssl rand -base64 18 | tr -d '/+=')"

# ── 颜色输出 ─────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()  { echo -e "${BLUE}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[ OK ]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERR ]${NC}  $*"; exit 1; }

# ── 权限检查 ─────────────────────────────────────────────────
[[ $EUID -ne 0 ]] && error "请使用 root 或 sudo 运行本脚本"

# ── 检查项目目录 ─────────────────────────────────────────────
[[ ! -d "$BACKEND_DIR" ]] && error "找不到 $BACKEND_DIR，请先将项目上传至 $INSTALL_DIR"

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║      LightScan 服务器安装程序 v1.0           ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ── 1. 系统包 ────────────────────────────────────────────────
info "安装系统依赖..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq \
    python3 python3-pip python3-venv python3-dev \
    postgresql postgresql-contrib \
    nginx \
    git curl wget unzip \
    libgl1-mesa-glx libglib2.0-0 \
    build-essential libpq-dev \
    ufw \
    > /dev/null 2>&1
ok "系统依赖安装完成"

# ── 2. PostgreSQL ────────────────────────────────────────────
info "配置 PostgreSQL..."
systemctl enable postgresql --now > /dev/null 2>&1 || true
sleep 1

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1; then
    sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" > /dev/null
    ok "数据库用户 $DB_USER 已创建"
else
    sudo -u postgres psql -c "ALTER USER $DB_USER WITH PASSWORD '$DB_PASS';" > /dev/null
    warn "数据库用户已存在，已更新密码"
fi

if ! sudo -u postgres psql -lqt | cut -d'|' -f1 | grep -qw "$DB_NAME"; then
    sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" > /dev/null
    ok "数据库 $DB_NAME 已创建"
else
    warn "数据库 $DB_NAME 已存在，跳过创建"
fi

DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}"

# ── 3. Python 虚拟环境 ───────────────────────────────────────
info "创建 Python 虚拟环境..."
python3 -m venv "$VENV_DIR"
ok "venv 创建完成：$VENV_DIR"

info "安装 Python 依赖（可能需要数分钟）..."
"$VENV_DIR/bin/pip" install --upgrade pip -q

# PaddleOCR 体积大，跳过；如需 OCR 请手动安装
grep -v "^paddlepaddle\|^paddleocr" "$INSTALL_DIR/requirements.txt" > /tmp/ls_req.txt
"$VENV_DIR/bin/pip" install -r /tmp/ls_req.txt -q \
    --extra-index-url https://download.pytorch.org/whl/cpu \
    2>&1 | tail -3
ok "Python 依赖安装完成（paddleocr 已跳过）"

# ── 4. .env 文件 ─────────────────────────────────────────────
info "生成 .env 配置..."
ENV_FILE="$INSTALL_DIR/src/.env"
SECRET_KEY="$(openssl rand -hex 32)"

cat > "$ENV_FILE" << EOF
# LightScan 环境配置（由 server-install.sh 自动生成）
DATABASE_URL=${DATABASE_URL}
SECRET_KEY=${SECRET_KEY}
ALGORITHM=HS256
ENVIRONMENT=production
CORS_ORIGINS=["*"]
CORS_ALLOW_CREDENTIALS=true
PRELOAD_OCR=false
ACCESS_TOKEN_EXPIRE_MINUTES=10080
EOF

chmod 600 "$ENV_FILE"
ok ".env 已写入 $ENV_FILE"

# ── 5. 模型权重检查 ──────────────────────────────────────────
if [[ ! -f "$MODEL_PATH" ]]; then
    warn "模型权重不存在：$MODEL_PATH"
    warn "检测功能不可用，请手动上传后重启服务："
    warn "  scp best.pt root@<IP>:$MODEL_PATH"
    mkdir -p "$(dirname "$MODEL_PATH")"
else
    ok "模型权重已就绪"
fi

# ── 6. 前端静态文件检查 ──────────────────────────────────────
if [[ ! -d "$FRONTEND_PUBLIC" ]] || [[ -z "$(ls -A "$FRONTEND_PUBLIC" 2>/dev/null)" ]]; then
    warn "前端构建产物不存在：$FRONTEND_PUBLIC"
    warn "请先在本地执行 npm run build 并上传（或运行 deploy.sh）"
    mkdir -p "$FRONTEND_PUBLIC"
else
    ok "前端静态文件已就绪"
fi

# ── 7. systemd 服务 ──────────────────────────────────────────
info "配置 systemd 服务..."
cat > "/etc/systemd/system/${SERVICE_NAME}.service" << EOF
[Unit]
Description=LightScan FastAPI Backend
After=network.target postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=${BACKEND_DIR}
ExecStart=${VENV_DIR}/bin/uvicorn app.main:app --host 127.0.0.1 --port ${SERVICE_PORT} --workers 2
Restart=always
RestartSec=5
EnvironmentFile=${ENV_FILE}
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"

# 等待服务进入 active 状态（torch/ultralytics 冷启动可能需要 30-60s）
info "等待服务启动（首次加载模型约需 30-60 秒）..."
for i in $(seq 1 20); do
    sleep 3
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        ok "服务启动成功（${i}×3s）"
        break
    fi
    if [ "$i" -eq 20 ]; then
        warn "服务尚未就绪，但可能仍在加载模型，请稍后确认：systemctl status $SERVICE_NAME"
    fi
done

# ── 8. Nginx 反向代理 ────────────────────────────────────────
info "配置 Nginx..."
cat > "/etc/nginx/sites-available/${SERVICE_NAME}" << 'NGINXEOF'
server {
    listen 80;
    server_name _;

    client_max_body_size 200M;
    proxy_read_timeout 300s;
    proxy_send_timeout 300s;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINXEOF

rm -f /etc/nginx/sites-enabled/default
ln -sf "/etc/nginx/sites-available/${SERVICE_NAME}" "/etc/nginx/sites-enabled/${SERVICE_NAME}"

if nginx -t -q 2>/dev/null; then
    systemctl reload nginx
    ok "Nginx 配置完成"
else
    warn "Nginx 配置测试失败，请检查 /etc/nginx/sites-available/${SERVICE_NAME}"
fi

# ── 9. 防火墙 ────────────────────────────────────────────────
info "配置防火墙..."
ufw allow ssh    > /dev/null 2>&1 || true
ufw allow 80/tcp > /dev/null 2>&1 || true
ufw --force enable > /dev/null 2>&1 || true
ok "防火墙已开放 22/80 端口"

# ── 10. 创建默认管理员账号 ───────────────────────────────────
info "初始化默认管理员账号..."
sleep 2
ADMIN_PASS="Ls$(openssl rand -base64 8 | tr -d '/+=')"

"$VENV_DIR/bin/python3" - << PYEOF 2>/dev/null || warn "管理员账号初始化失败，请稍后手动创建"
import sys, os
sys.path.insert(0, '${BACKEND_DIR}')
sys.path.insert(0, '${INSTALL_DIR}')
os.chdir('${BACKEND_DIR}')
from dotenv import load_dotenv
load_dotenv('${ENV_FILE}')
from app.db.database import SessionLocal, engine
from app.db import models
from app.services.security import get_password_hash

# 确保表已创建，不依赖服务启动时序
models.Base.metadata.create_all(bind=engine)

db = SessionLocal()
existing = db.query(models.User).filter(models.User.username == 'admin').first()
if not existing:
    user = models.User(
        username='admin',
        hashed_password=get_password_hash('${ADMIN_PASS}'),
        role='admin',
        source_type='camera',
    )
    db.add(user)
    db.commit()
db.close()
PYEOF

# ── 安装摘要 ─────────────────────────────────────────────────
SERVER_IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║                  安装完成 ✓                              ║"
echo "╠══════════════════════════════════════════════════════════╣"
printf "║  访问地址    http://%-36s║\n" "${SERVER_IP}"
printf "║  管理员账号  %-42s║\n" "admin"
printf "║  管理员密码  %-42s║\n" "${ADMIN_PASS}"
printf "║  数据库      %-42s║\n" "${DB_NAME} @ localhost"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║  常用命令：                                              ║"
printf "║    查看日志  %-42s║\n" "journalctl -u lightscan -f"
printf "║    重启服务  %-42s║\n" "systemctl restart lightscan"
printf "║    上传模型  %-42s║\n" "scp best.pt root@IP:${MODEL_PATH}"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# 保存安装信息到文件（包含敏感信息，chmod 600）
cat > "$INSTALL_DIR/INSTALL_INFO.txt" << EOF
安装时间: $(date '+%Y-%m-%d %H:%M:%S')
访问地址: http://${SERVER_IP}
管理员账号: admin
管理员密码: ${ADMIN_PASS}
数据库名: ${DB_NAME}
数据库用户: ${DB_USER}
数据库密码: ${DB_PASS}
SECRET_KEY: ${SECRET_KEY}
EOF
chmod 600 "$INSTALL_DIR/INSTALL_INFO.txt"
info "凭据已保存至 $INSTALL_DIR/INSTALL_INFO.txt（权限 600）"
