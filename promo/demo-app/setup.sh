#!/bin/sh
# 把演示项目复制成一个独立的 git 仓库，再在 5173 端口开一个本地网页。
# 用法：sh promo/demo-app/setup.sh   （默认放到 ~/Code/acme-console）
set -e
DEST="${1:-$HOME/Code/acme-console}"
SRC="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$DEST"
cp "$SRC/index.html" "$SRC/style.css" "$SRC/app.js" "$DEST/"
cd "$DEST"
[ -d .git ] || { git init -q && git add . && git commit -qm "Acme 控制台：设置页"; }
echo "演示项目在 $DEST"
echo "启动网页：cd \"$DEST\" && python3 -m http.server 5173"
echo "浏览器打开 http://localhost:5173"
