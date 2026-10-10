#!/bin/zsh
set -e
project_dir=${0:A:h}
cd "$project_dir"
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
[[ -f conf.yaml && -x .venv/bin/python && -f live2d-ui/dist/web/index.html ]] || { print 'Run setup-macos.command first.'; exit 1; }
cd live2d-ui
/bin/zsh native/glass/build.sh
swiftc resources/screen-ocr.swift -o resources/screen-ocr
npm run build
npx electron-builder --mac --arm64 --dir --publish never --config.electronDist=node_modules/electron/dist
mkdir -p "$HOME/Applications"
ditto 'release/0.1.0/mac-arm64/Emma Darwin.app' "$HOME/Applications/Emma Darwin.app"
cd "$project_dir"
.venv/bin/python - <<'PY'
from pathlib import Path
import json
path=Path.home()/'Applications/Emma Darwin.app/Contents/Resources/local-project.json'
path.write_text(json.dumps({'directory':str(Path.cwd())}))
PY
print 'Installed ~/Applications/Emma Darwin.app. Open it to meet Emma.'
