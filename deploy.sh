#!/bin/bash
# 一键部署到远程服务器
# 用法: bash deploy.sh [用户名] [密码]
# 例：  bash deploy.sh root mypassword

SERVER="39.105.106.58"
REMOTE_USER="${1:-root}"
REMOTE_PASS="$2"

if [ -z "$REMOTE_PASS" ]; then
  echo -n "服务器密码: "
  read -s REMOTE_PASS
  echo
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_DIR="$SCRIPT_DIR/src/frontend/public"
BACKEND_FILES=(
  "src/backend/app/api/v1/disease.py"
  "src/backend/app/main.py"
  "src/backend/app/services/clustering_service.py"
)

# 找远程项目路径
echo "→ 查找服务器项目路径…"
REMOTE_PATH=$(sshpass -p "$REMOTE_PASS" ssh -o StrictHostKeyChecking=no \
  "${REMOTE_USER}@${SERVER}" \
  "find / -name 'disease.py' -path '*/api/v1/disease.py' 2>/dev/null | head -1" 2>/dev/null)

if [ -z "$REMOTE_PATH" ]; then
  echo "  找不到 disease.py，使用默认路径"
  REMOTE_BASE="/opt/lightscan"
else
  REMOTE_BASE="${REMOTE_PATH%/src/backend/app/api/v1/disease.py}"
fi

echo "  项目路径: $REMOTE_BASE"

# 上传后端关键文件
echo "→ 上传后端文件…"
for rel in "${BACKEND_FILES[@]}"; do
  sshpass -p "$REMOTE_PASS" ssh -o StrictHostKeyChecking=no \
    "${REMOTE_USER}@${SERVER}" \
    "mkdir -p '$REMOTE_BASE/$(dirname "$rel")'"
  sshpass -p "$REMOTE_PASS" scp -o StrictHostKeyChecking=no \
    "$SCRIPT_DIR/$rel" \
    "${REMOTE_USER}@${SERVER}:$REMOTE_BASE/$rel"
done

# 上传前端构建产物
echo "→ 上传前端 build…"
sshpass -p "$REMOTE_PASS" ssh -o StrictHostKeyChecking=no \
  "${REMOTE_USER}@${SERVER}" \
  "mkdir -p '$REMOTE_BASE/src/frontend/public'"
sshpass -p "$REMOTE_PASS" scp -o StrictHostKeyChecking=no -r \
  "$FRONTEND_DIR/"* \
  "${REMOTE_USER}@${SERVER}:${REMOTE_BASE}/src/frontend/public/"

# 重启后端
echo "→ 重启后端…"
sshpass -p "$REMOTE_PASS" ssh -o StrictHostKeyChecking=no \
  "${REMOTE_USER}@${SERVER}" \
  "pkill -f 'uvicorn app.main:app' || true; sleep 1; cd '$REMOTE_BASE/src/backend' && nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 > /tmp/uvicorn.log 2>&1 &"

sleep 2
echo "→ 验证部署…"
curl -s "http://${SERVER}/api/v1/disease/orders" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print(f'  工单数量: {len(d)} 条')" 2>/dev/null
echo "✓ 部署完成"
